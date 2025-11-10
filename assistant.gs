// =================================================================
//                 INTEGRATION ASSISTANT CHATGPT
// =================================================================
// Fournit une fonction utilitaire pour appeler l'API OpenAI et
// poster automatiquement la reponse dans l'onglet Chat.
// =================================================================

const CHAT_ASSISTANT_API_URL = 'https://api.openai.com/v1/chat/completions';
const CHAT_ASSISTANT_MODEL = 'gpt-4o';
const CHAT_ASSISTANT_HISTORY_LIMIT = 10;
const CHAT_ASSISTANT_SYSTEM_PROMPT = 'Vous \u00EAtes un assistant pour des pharmaciens qui livrent des m\u00E9dicaments en EHPAD.';
const CHAT_ASSISTANT_DEFAULT_VISIBILITY = 'pharmacy';

/**
 * Appelle l'API OpenAI en combinant le contexte et la question utilisateur.
 * @param {Array<{role:string, content:string}>} contextMessages
 * @param {string} userPrompt
 * @returns {string} Reponse texte ou message d'erreur lisible.
 */
function callChatGPT(contextMessages, userPrompt) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY');
  if (!apiKey) {
    Logger.log('[callChatGPT] OPENAI_API_KEY manquante dans les proprietes du script.');
    return 'Assistant indisponible : cle API manquante. Contactez l\'administrateur.';
  }

  const sanitizedPrompt = scrubChatMessage_(userPrompt);
  if (!sanitizedPrompt) {
    return 'Merci de formuler une question avant d\'interroger l\'assistant.';
  }

  const messages = [{
    role: 'system',
    content: CHAT_ASSISTANT_SYSTEM_PROMPT
  }];

  if (Array.isArray(contextMessages)) {
    contextMessages.forEach(msg => {
      if (!msg || !msg.role || !msg.content) {
        return;
      }
      const role = String(msg.role).toLowerCase() === 'assistant' ? 'assistant' : 'user';
      const content = scrubChatMessage_(msg.content);
      if (!content) {
        return;
      }
      messages.push({ role: role, content: content });
    });
  }

  messages.push({ role: 'user', content: sanitizedPrompt });

  const requestBody = {
    model: CHAT_ASSISTANT_MODEL,
    temperature: 0.3,
    messages: messages
  };

  try {
    const response = UrlFetchApp.fetch(CHAT_ASSISTANT_API_URL, {
      method: 'post',
      contentType: 'application/json',
      headers: {
        Authorization: 'Bearer ' + apiKey
      },
      payload: JSON.stringify(requestBody),
      muteHttpExceptions: true
    });

    const status = response.getResponseCode();
    const body = response.getContentText();
    if (status !== 200) {
      Logger.log('[callChatGPT] HTTP ' + status + ' - ' + body);
      return 'Assistant indisponible (erreur API). Merci de reessayer plus tard.';
    }

    const parsed = JSON.parse(body);
    const firstChoice = parsed && parsed.choices && parsed.choices[0];
    const messageContent = firstChoice && firstChoice.message && firstChoice.message.content;
    if (!messageContent) {
      Logger.log('[callChatGPT] Reponse vide ou incomplete: ' + body);
      return 'Assistant indisponible (reponse vide).';
    }

    return String(messageContent).trim();
  } catch (err) {
    Logger.log('[callChatGPT] ' + err);
    return 'Assistant indisponible pour le moment. Merci de reessayer plus tard.';
  }
}

/**
 * Recupere les derniers messages et poste la reponse de l'assistant.
 * @param {number} row Ligne cible (optionnelle).
 * @returns {string} Reponse envoyee.
 */
function askAssistant(row) {
  try {
    const ss = getMainSpreadsheet();
    const chatSheet = getChatSheet(ss);
    const lastRow = chatSheet.getLastRow();
    if (lastRow <= 1) {
      throw new Error('Aucun message disponible dans l\'onglet Chat.');
    }

    const targetRow = getAssistantTargetRow_(row, chatSheet, lastRow);
    const rowValues = chatSheet.getRange(targetRow, 1, 1, 9).getValues()[0];
    const status = String(rowValues[7] || '').toLowerCase();
    if (status && status !== 'active') {
      throw new Error('La ligne selectionnee est archivee.');
    }

    const question = scrubChatMessage_(rowValues[5]);
    if (!question) {
      throw new Error('La ligne selectionnee ne contient pas de question exploitable.');
    }

    if (typeof CFG_ENABLE_ASSISTANT === 'undefined' || !CFG_ENABLE_ASSISTANT) {
      throw new Error('Assistant désactivé.');
    }

    let threadId = sanitizeChatThreadId(rowValues[1] || '');
    if (!threadId) {
      const authorRef = String(rowValues[3] || '');
      if (authorRef.indexOf('CLIENT_') === 0) {
        threadId = buildChatThreadIdFromClient({ clientId: authorRef.replace('CLIENT_', '') }) || '';
      } else if (authorRef.indexOf('PHC_') === 0) {
        threadId = buildChatThreadIdFromCode(authorRef.replace('PHC_', '')) || '';
      }
    }
    threadId = sanitizeChatThreadId(threadId || '') || CHAT_THREAD_GLOBAL;

    const contextMessages = buildAssistantContext_(chatSheet, targetRow, threadId, CHAT_ASSISTANT_HISTORY_LIMIT);
    const assistantAnswer = callChatGPT(contextMessages, question) || 'Assistant indisponible.';
    const assistantSessionId = buildAssistantSessionId_(threadId);

    const payload = {
      authorType: 'assistant',
      authorPseudo: 'ChatGPT',
      message: assistantAnswer,
      visibleTo: CHAT_ASSISTANT_DEFAULT_VISIBILITY,
      threadId: threadId,
      sessionId: assistantSessionId
    };

    const result = chatPostMessage(payload);
    if (!result || !result.ok) {
      throw new Error('La reponse de l\'assistant n\'a pas pu etre enregistree (code: ' + (result && result.reason ? result.reason : 'inconnu') + ').');
    }

    return assistantAnswer;
  } catch (err) {
    Logger.log('[askAssistant] ' + err);
    throw err;
  }
}

/**
 * Fournit une réponse assistant pour un thread spécifique côté WebApp.
 * @param {{threadId?:string, question?:string, sessionId?:string, clientId?:string, clientEmail?:string, pharmacyCode?:string}} rawInput
 * @returns {{ok:boolean, reason?:string, answer?:string, question?:string, threadId?:string, history?:Array<Object>}}
 */
function askAssistantOnThread(rawInput) {
  if (typeof CFG_ENABLE_ASSISTANT === 'undefined' || !CFG_ENABLE_ASSISTANT) {
    return { ok: false, reason: 'UNCONFIGURED' };
  }

  try {
    const input = rawInput || {};
    const skipUserPost = input.skipUserPost === true;
    let safeThread = sanitizeChatThreadId(input.threadId || '');
    const safeSession = sanitizeScalar(input.sessionId || '', 64) || ('webapp:' + (safeThread || 'THREAD'));
    const baseQuestion = sanitizeMultiline(input.question, 1000);

    if (!baseQuestion) {
      return { ok: false, reason: 'EMPTY_MESSAGE' };
    }

    const payload = {
      authorType: 'pharmacy',
      message: baseQuestion,
      threadId: safeThread,
      sessionId: safeSession,
      clientId: sanitizeScalar(input.clientId, 64),
      clientEmail: sanitizeEmail(input.clientEmail),
      pharmacyCode: sanitizePharmacyCode(input.pharmacyCode)
    };

    if (!payload.clientId && !payload.clientEmail && !payload.pharmacyCode) {
      payload.pharmacyCode = sanitizePharmacyCode(computeAssistantFallbackCode_(safeSession));
    }

    let question = baseQuestion;

    if (!skipUserPost) {
      const postResult = chatPostMessage(payload);
      if (!postResult || !postResult.ok) {
        return postResult && postResult.reason ? postResult : { ok: false, reason: 'ERROR' };
      }
      question = sanitizeMultiline(postResult.message, 1000) || question;
      safeThread = sanitizeChatThreadId(postResult.threadId || safeThread) || safeThread;
    } else if (!safeThread) {
      safeThread = sanitizeChatThreadId(resolveChatThreadId(payload, null, payload.pharmacyCode));
    }

    if (!safeThread) {
      return { ok: false, reason: 'INVALID_THREAD' };
    }

    const contextMessages = buildAssistantThreadContext_(safeThread, CHAT_ASSISTANT_HISTORY_LIMIT);
    const assistantRaw = callChatGPT(contextMessages, question) || '';
    const assistantText = sanitizeMultiline(assistantRaw, 1200) || 'Assistant indisponible pour le moment.';

    const assistantPayload = {
      authorType: 'assistant',
      authorPseudo: 'Assistant',
      message: assistantText,
      visibleTo: CHAT_ASSISTANT_DEFAULT_VISIBILITY,
      threadId: safeThread,
      sessionId: buildAssistantSessionId_(safeThread)
    };

    const assistantPost = chatPostMessage(assistantPayload);
    if (!assistantPost || !assistantPost.ok) {
      return assistantPost && assistantPost.reason ? assistantPost : { ok: false, reason: 'ERROR' };
    }

    const history = buildAssistantHistorySnapshot_(safeThread, CHAT_ASSISTANT_HISTORY_LIMIT);

    return {
      ok: true,
      answer: assistantText,
      question: question,
      threadId: safeThread,
      history: history
    };
  } catch (err) {
    console.error('[askAssistantOnThread]', err);
    return { ok: false, reason: 'ERROR' };
  }
}

/**
 * Cree ou met a jour le menu permettant d'invoquer l'assistant.
 */
function menuAskAssistant() {
  const ui = SpreadsheetApp.getUi();
  try {
    const activeSheet = SpreadsheetApp.getActiveSheet();
    if (!activeSheet || activeSheet.getSheetName() !== SHEET_CHAT) {
      ui.alert('Assistant Chat', 'Selectionnez une ligne dans l\'onglet Chat avant d\'appeler l\'assistant.', ui.ButtonSet.OK);
      return;
    }
    const activeRange = activeSheet.getActiveRange();
    if (!activeRange) {
      ui.alert('Assistant Chat', 'Selectionnez une ligne contenant la question a poser.', ui.ButtonSet.OK);
      return;
    }
    const rowIndex = activeRange.getRow();
    const answer = askAssistant(rowIndex);
    ui.alert('Assistant Chat', 'Reponse envoyee dans le fil: \n\n' + answer, ui.ButtonSet.OK);
  } catch (err) {
    ui.alert('Assistant Chat', err.message || String(err), ui.ButtonSet.OK);
  }
}

/**
 * Construit la liste des 10 derniers messages (meme thread) pour fournir du contexte.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} chatSheet
 * @param {number} targetRow
 * @param {string} threadId
 * @param {number} limit
 * @returns {Array<{role:string, content:string}>}
 */
function buildAssistantContext_(chatSheet, targetRow, threadId, limit) {
  const endRow = Math.max(2, targetRow - 1);
  if (endRow < 2) {
    return [];
  }
  const startRow = Math.max(2, endRow - limit + 1);
  const rowCount = endRow - startRow + 1;
  if (rowCount <= 0) {
    return [];
  }

  const values = chatSheet.getRange(startRow, 1, rowCount, 8).getValues();
  const context = [];
  const safeThread = sanitizeChatThreadId(threadId || '');
  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const currentThread = sanitizeChatThreadId(row[1] || '');
    if (safeThread && currentThread !== safeThread) {
      continue;
    }
    const visibility = String(row[6] || CHAT_ASSISTANT_DEFAULT_VISIBILITY).toLowerCase();
    if (visibility !== 'pharmacy') {
      continue; // On evite d'exposer les fils internes admin.
    }
    const status = String(row[7] || '').toLowerCase();
    if (status && status !== 'active') {
      continue;
    }
    const sanitized = scrubChatMessage_(row[5]);
    if (!sanitized) {
      continue;
    }
    const authorType = String(row[2] || 'pharmacy').toLowerCase();
    const pseudo = anonymizeAssistantPseudo_(row[4], authorType);
    const role = authorType === 'assistant' ? 'assistant' : 'user';
    const label = pseudo ? '[' + pseudo + '] ' : '';
    context.push({
      role: role,
      content: label + sanitized
    });
  }

  if (context.length > limit) {
    return context.slice(context.length - limit);
  }
  return context;
}

/**
 * Construit le contexte assistant pour un thread donné (webapp).
 * @param {string} threadId
 * @param {number} limit
 * @returns {Array<{role:string, content:string}>}
 */
function buildAssistantThreadContext_(threadId, limit) {
  const safeThread = sanitizeChatThreadId(threadId || '');
  if (!safeThread) {
    return [];
  }
  const context = [];
  try {
    const ss = getMainSpreadsheet();
    const sheet = getChatSheet(ss);
    if (!sheet) {
      return context;
    }
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      return context;
    }
    const values = sheet.getRange(2, 1, lastRow - 1, 9).getValues();
    for (let i = values.length - 1; i >= 0 && context.length < Number(limit || 10); i--) {
      const row = values[i];
      const currentThread = sanitizeChatThreadId(row[1] || '');
      if (currentThread !== safeThread) {
        continue;
      }
      const status = String(row[7] || '').toLowerCase();
      if (status && status !== 'active') {
        continue;
      }
      const visibility = String(row[6] || CHAT_ASSISTANT_DEFAULT_VISIBILITY).toLowerCase();
      if (visibility !== 'pharmacy') {
        continue;
      }
      const role = String(row[2] || 'pharmacy').toLowerCase() === 'assistant' ? 'assistant' : 'user';
      const message = sanitizeMultiline(row[5], 1000);
      if (!message) {
        continue;
      }
      context.unshift({ role: role, content: message });
    }
  } catch (err) {
    console.warn('[buildAssistantThreadContext_]', err);
  }
  const maxItems = Number(limit || 10);
  return context.length > maxItems ? context.slice(context.length - maxItems) : context;
}

/**
 * Retourne l'historique du thread pour affichage côté client.
 * @param {string} threadId
 * @param {number} limit
 * @returns {Array<Object>}
 */
function buildAssistantHistorySnapshot_(threadId, limit) {
  const safeThread = sanitizeChatThreadId(threadId || '');
  if (!safeThread) {
    return [];
  }
  try {
    const result = chatGetMessagesForThread(safeThread, { limit: Number(limit || 20) });
    const messages = Array.isArray(result && result.messages) ? result.messages : [];
    const maxItems = Number(limit || 20);
    return messages.length > maxItems ? messages.slice(messages.length - maxItems) : messages;
  } catch (err) {
    console.warn('[buildAssistantHistorySnapshot_]', err);
    return [];
  }
}

/**
 * Génère un code fallback pour les sessions anonymes de l'assistant.
 * @param {string} sessionId
 * @returns {string}
 */
function computeAssistantFallbackCode_(sessionId) {
  const base = sanitizeScalar(sessionId || '', 32).replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const padded = (base + 'ELSCHAT').substring(0, 8);
  if (padded.length >= 4) {
    return padded;
  }
  return (padded + 'XXXX').substring(0, 4);
}

/**
 * Supprime les informations sensibles des messages pour respecter la confidentialite.
 * @param {string} rawText
 * @returns {string}
 */
function scrubChatMessage_(rawText) {
  const base = typeof sanitizeMultiline === 'function'
    ? sanitizeMultiline(rawText, 1200)
    : String(rawText || '').trim();
  if (!base) {
    return '';
  }
  const withoutEmails = base.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[email]');
  const withoutPhones = withoutEmails.replace(/\b\+?\d[\d\s.-]{6,}\b/g, '[numero]');
  const withoutFullNames = withoutPhones.replace(/\b[A-Z\u00C0-\u00D6\u00D8-\u00DE][a-z\u00E0-\u00F6\u00F8-\u00FF']+\s+[A-Z\u00C0-\u00D6\u00D8-\u00DE][a-z\u00E0-\u00F6\u00F8-\u00FF']+\b/g, '[nom]');
  return withoutFullNames.trim();
}

/**
 * Retourne un pseudo anonymise a partir du pseudo calcule ou du type d'auteur.
 * @param {string} pseudo
 * @param {string} authorType
 * @returns {string}
 */
function anonymizeAssistantPseudo_(pseudo, authorType) {
  const safePseudo = typeof sanitizeScalar === 'function'
    ? sanitizeScalar(pseudo || '', 48)
    : String(pseudo || '');
  const compact = safePseudo.replace(/[^A-Za-z0-9#\- ]/g, '').trim();
  if (compact) {
    return compact;
  }
  switch (authorType) {
    case 'admin': return 'Admin';
    case 'assistant': return 'Assistant';
    case 'client': return 'Client';
    default: return 'Pharmacie';
  }
}

/**
 * Determine la ligne a utiliser pour l'appel assistant.
 * @param {number} inputRow
 * @param {GoogleAppsScript.Spreadsheet.Sheet} chatSheet
 * @param {number} lastRow
 * @returns {number}
 */
function getAssistantTargetRow_(inputRow, chatSheet, lastRow) {
  let rowIndex = Number(inputRow) || 0;
  if (!rowIndex || rowIndex < 2 || rowIndex > lastRow) {
    try {
      const activeSheet = SpreadsheetApp.getActiveSheet();
      if (activeSheet && activeSheet.getSheetName() === chatSheet.getSheetName()) {
        const activeRange = activeSheet.getActiveRange();
        if (activeRange) {
          rowIndex = activeRange.getRow();
        }
      }
    } catch (_err) {
      rowIndex = 0;
    }
  }
  if (!rowIndex || rowIndex < 2 || rowIndex > lastRow) {
    rowIndex = lastRow;
  }
  return rowIndex;
}

/**
 * Genere un identifiant interne pour le rate limit du bot.
 * @param {string} threadId
 * @returns {string}
 */
function buildAssistantSessionId_(threadId) {
  const safeThread = sanitizeChatThreadId(threadId || '') || CHAT_THREAD_GLOBAL;
  return 'assistant:' + safeThread;
}

/**
 * Teste le respect du burst rate-limit pour les reponses assistant.
 * @returns {{ok:boolean}}
 */
function testAssistantRateLimitBurst() {
  const threadId = 'TEST_THREAD';
  const sessionId = buildAssistantSessionId_(threadId);
  const rateKey = buildChatRateKey(sessionId);
  const cacheKey = 'chat_rate:' + rateKey;
  const cache = CacheService.getScriptCache();
  cache.remove(cacheKey);
  try {
    PropertiesService.getScriptProperties().deleteProperty('chat_rate_last:' + rateKey);
  } catch (_err) {
    // Ignore les erreurs de nettoyage.
  }

  for (let i = 0; i < CHAT_RATE_LIMIT_BURST; i++) {
    if (!isChatRateAllowed(sessionId)) {
      throw new Error('Le burst est trop strict a l\'iteration ' + i + '.');
    }
  }

  if (isChatRateAllowed(sessionId)) {
    throw new Error('Le burst n\'est pas applique apres ' + CHAT_RATE_LIMIT_BURST + ' appels.');
  }

  return { ok: true };
}
