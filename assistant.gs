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
  if (typeof CFG_ENABLE_ASSISTANT !== 'undefined' && !CFG_ENABLE_ASSISTANT) {
    return { ok: false, reason: 'UNCONFIGURED' };
  }

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
  if (typeof CFG_ENABLE_ASSISTANT !== 'undefined' && !CFG_ENABLE_ASSISTANT) {
    return { ok: false, reason: 'UNCONFIGURED' };
  }

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

    const threadId = rowValues[1] || CHAT_THREAD_GLOBAL;
    const contextMessages = buildAssistantContext_(chatSheet, targetRow, threadId, CHAT_ASSISTANT_HISTORY_LIMIT);
    const assistantAnswer = callChatGPT(contextMessages, question);
    if (assistantAnswer && typeof assistantAnswer === 'object' && assistantAnswer.ok === false) {
      return assistantAnswer;
    }
    const resolvedAnswer = typeof assistantAnswer === 'string'
      ? assistantAnswer
      : 'Assistant indisponible.';

    const payload = {
      authorType: 'assistant',
      authorPseudo: 'ChatGPT',
      message: resolvedAnswer,
      visibleTo: CHAT_ASSISTANT_DEFAULT_VISIBILITY,
      threadId: threadId,
      sessionId: buildAssistantSessionId_(threadId)
    };

    const result = chatPostMessage(payload);
    if (!result || !result.ok) {
      throw new Error('La reponse de l\'assistant n\'a pas pu etre enregistree (code: ' + (result && result.reason ? result.reason : 'inconnu') + ').');
    }

    return resolvedAnswer;
  } catch (err) {
    Logger.log('[askAssistant] ' + err);
    throw err;
  }
}

/**
 * Cree ou met a jour le menu permettant d'invoquer l'assistant.
 */
function menuAskAssistant() {
  if (typeof CFG_ENABLE_ASSISTANT !== 'undefined' && !CFG_ENABLE_ASSISTANT) {
    try { SpreadsheetApp.getActive().toast('Assistant désactivé dans la configuration.', 'Assistant', 5); } catch (_err) {}
    try {
      const disabledUi = SpreadsheetApp.getUi();
      disabledUi.alert('Assistant Chat', 'L\'assistant est désactivé par configuration (CFG_ENABLE_ASSISTANT=false).', disabledUi.ButtonSet.OK);
    } catch (_err) {}
    return { ok: false, reason: 'UNCONFIGURED' };
  }

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
    if (answer && typeof answer === 'object') {
      if (answer.ok === false && answer.reason === 'UNCONFIGURED') {
        ui.alert('Assistant Chat', 'L\'assistant est désactivé par configuration.', ui.ButtonSet.OK);
      }
      return answer;
    }
    ui.alert('Assistant Chat', 'Reponse envoyee dans le fil: \n\n' + answer, ui.ButtonSet.OK);
    return { ok: true };
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
  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const currentThread = row[1] || CHAT_THREAD_GLOBAL;
    if (threadId && currentThread !== threadId) {
      continue;
    }
    const visibility = String(row[6] || CHAT_ASSISTANT_DEFAULT_VISIBILITY).toLowerCase();
    if (visibility === 'admin') {
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
  const safeThread = threadId || CHAT_THREAD_GLOBAL;
  return 'assistant:' + safeThread + ':' + Date.now();
}

/**
 * Test: vérifie que les entrées assistant sont bloquées si le flag est désactivé.
 * @returns {boolean}
 */
function test_assistantDisabledFlag() {
  const callRes = callChatGPT([], 'ping');
  const askRes = askAssistant();
  const menuRes = menuAskAssistant();
  return Boolean(
    callRes && callRes.ok === false && callRes.reason === 'UNCONFIGURED'
    && askRes && askRes.ok === false && askRes.reason === 'UNCONFIGURED'
    && menuRes && menuRes.ok === false && menuRes.reason === 'UNCONFIGURED'
  );
}
