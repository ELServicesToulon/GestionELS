// =================================================================
//                 INTEGRATION ASSISTANT CHATGPT
// =================================================================
// Fournit une fonction utilitaire pour appeler l'API OpenAI et
// poster automatiquement la reponse dans l'onglet Chat.
// =================================================================

const CHAT_ASSISTANT_API_URL = 'https://api.openai.com/v1/chat/completions';
const CHAT_ASSISTANT_MODEL = 'gpt-4o';
const CHAT_ASSISTANT_HISTORY_LIMIT = 10;
const CHAT_ASSISTANT_TEMPERATURE = 0.3;
const CHAT_ASSISTANT_SYSTEM_PROMPT = 'Assistant pour pharmaciens en EHPAD; r\u00E9ponses concises; pas de donn\u00E9es perso.';
const CHAT_ASSISTANT_DEFAULT_VISIBILITY = 'pharmacy';

/**
 * Construit la liste des messages "+system" pour l'appel API.
 * @param {Array<{role:string,content:string}>} contextMessages
 * @param {string} sanitizedPrompt
 * @param {{model?:string,temperature?:number}} [opts]
 * @returns {{messages:Array<{role:string,content:string}>, model:string, temperature:number}}
 */
function buildAssistantApiPayload_(contextMessages, sanitizedPrompt, opts) {
  const messages = [{ role: 'system', content: CHAT_ASSISTANT_SYSTEM_PROMPT }];
  if (Array.isArray(contextMessages)) {
    const limitedContext = contextMessages.slice(-CHAT_ASSISTANT_HISTORY_LIMIT);
    limitedContext.forEach(msg => {
      if (!msg || !msg.role || !msg.content) {
        return;
      }
      const safeRole = String(msg.role).toLowerCase() === 'assistant' ? 'assistant' : 'user';
      const safeContent = sanitizeMultiline(msg.content, 1200);
      if (!safeContent) {
        return;
      }
      messages.push({ role: safeRole, content: safeContent });
    });
  }
  messages.push({ role: 'user', content: sanitizedPrompt });

  const config = opts || {};
  const selectedModel = sanitizeScalar(config.model, 64);
  const model = selectedModel || CHAT_ASSISTANT_MODEL;
  const selectedTemperature = typeof config.temperature === 'number' ? config.temperature : CHAT_ASSISTANT_TEMPERATURE;

  return {
    messages: messages,
    model: model,
    temperature: selectedTemperature
  };
}

/**
 * Appelle l'API OpenAI en combinant le contexte et la question utilisateur.
 * @param {Array<{role:string, content:string}>} contextMessages
 * @param {string} userPrompt
 * @param {{model?:string, temperature?:number, maxTokens?:number}} [opts]
 * @returns {{ok:boolean, reason?:string, message?:string, usage?:Object}}
 */
function callChatGPT(contextMessages, userPrompt, opts) {
  if (typeof CFG_ENABLE_ASSISTANT !== 'undefined' && !CFG_ENABLE_ASSISTANT) {
    return { ok: false, reason: 'UNCONFIGURED', message: 'Assistant d\u00E9sactiv\u00E9.' };
  }

  const sanitizedPrompt = sanitizeMultiline(userPrompt, 1200);
  if (!sanitizedPrompt) {
    return { ok: false, reason: 'EMPTY_MESSAGE', message: 'Question requise pour appeler l\'assistant.' };
  }

  let apiKey = '';
  try {
    apiKey = getSecret('OPENAI_API_KEY');
  } catch (err) {
    Logger.log('[callChatGPT] OPENAI_API_KEY manquante: ' + err);
    return { ok: false, reason: 'UNCONFIGURED', message: 'Assistant non configur\u00E9 (cle API).' };
  }

  const payloadConfig = buildAssistantApiPayload_(contextMessages, sanitizedPrompt, opts);
  const requestBody = {
    model: payloadConfig.model,
    temperature: payloadConfig.temperature,
    messages: payloadConfig.messages
  };
  if (opts && typeof opts.maxTokens === 'number' && opts.maxTokens > 0) {
    requestBody.max_tokens = Math.floor(opts.maxTokens);
  }

  try {
    const response = UrlFetchApp.fetch(CHAT_ASSISTANT_API_URL, {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + apiKey },
      payload: JSON.stringify(requestBody),
      muteHttpExceptions: true
    });

    const status = response.getResponseCode();
    const body = response.getContentText();
    if (status !== 200) {
      Logger.log('[callChatGPT] HTTP ' + status + ' - ' + body);
      return { ok: false, reason: 'API_ERROR', message: 'Assistant indisponible (API).' };
    }

    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch (parseErr) {
      Logger.log('[callChatGPT] Parse error: ' + parseErr + ' body=' + body);
      return { ok: false, reason: 'API_ERROR', message: 'Assistant indisponible (r\u00E9ponse invalide).' };
    }

    const firstChoice = parsed && parsed.choices && parsed.choices[0];
    const messageContent = firstChoice && firstChoice.message && firstChoice.message.content;
    if (!messageContent) {
      Logger.log('[callChatGPT] R\u00E9ponse vide ou incomplete: ' + body);
      return { ok: false, reason: 'API_ERROR', message: 'Assistant indisponible (r\u00E9ponse vide).' };
    }

    const sanitizedAnswer = sanitizeMultiline(messageContent, 1500);
    if (!sanitizedAnswer) {
      return { ok: false, reason: 'API_ERROR', message: 'Assistant indisponible (contenu vide).' };
    }

    const usage = parsed && parsed.usage
      ? {
          promptTokens: Number(parsed.usage.prompt_tokens) || 0,
          completionTokens: Number(parsed.usage.completion_tokens) || 0,
          totalTokens: Number(parsed.usage.total_tokens) || 0
        }
      : undefined;

    const result = { ok: true, message: sanitizedAnswer };
    if (usage) {
      result.usage = usage;
    }
    return result;
  } catch (err) {
    Logger.log('[callChatGPT] Fetch error: ' + err);
    return { ok: false, reason: 'API_ERROR', message: 'Assistant indisponible (fetch).' };
  }
}

/**
 * Recupere les derniers messages et poste la reponse de l'assistant.
 * @param {number} row Ligne cible (optionnelle).
 * @returns {{ok:boolean, reason?:string, answer?:string, usage?:Object}} Resultat d'appel assistant.
 */
function askAssistant(row) {
  if (typeof CFG_ENABLE_ASSISTANT !== 'undefined' && !CFG_ENABLE_ASSISTANT) {
    return { ok: false, reason: 'UNCONFIGURED', message: 'Assistant d\u00E9sactiv\u00E9.' };
  }

  try {
    const ss = getMainSpreadsheet();
    const chatSheet = getChatSheet(ss);
    const lastRow = chatSheet.getLastRow();
    if (lastRow <= 1) {
      return { ok: false, reason: 'NOT_FOUND', message: 'Aucun message dans l\'onglet Chat.' };
    }

    const targetRow = getAssistantTargetRow_(row, chatSheet, lastRow);
    const rowValues = chatSheet.getRange(targetRow, 1, 1, 9).getValues()[0];
    const status = String(rowValues[7] || '').toLowerCase();
    if (status && status !== 'active') {
      return { ok: false, reason: 'NOT_FOUND', message: 'La ligne s\u00E9lectionn\u00E9e est archiv\u00E9e.' };
    }

    const question = scrubChatMessage_(rowValues[5]);
    if (!question) {
      return { ok: false, reason: 'EMPTY_MESSAGE', message: 'Question absente ou invalide.' };
    }

    const rawThreadId = rowValues[1] || CHAT_THREAD_GLOBAL;
    const sanitizedThreadId = sanitizeScalar(rawThreadId, 64);
    const threadId = sanitizedThreadId || CHAT_THREAD_GLOBAL;
    const contextMessages = buildAssistantContext_(chatSheet, targetRow, threadId, CHAT_ASSISTANT_HISTORY_LIMIT);
    const assistantSessionId = buildAssistantSessionId_(threadId);
    const assistantAnswer = callChatGPT(contextMessages, question);
    if (!assistantAnswer || assistantAnswer.ok === false) {
      return assistantAnswer || { ok: false, reason: 'API_ERROR', message: 'Assistant indisponible.' };
    }

    const payload = {
      authorType: 'assistant',
      authorPseudo: 'Assistant',
      message: assistantAnswer.message,
      visibleTo: CHAT_ASSISTANT_DEFAULT_VISIBILITY,
      threadId: threadId,
      sessionId: assistantSessionId
    };

    const postResult = chatPostMessage(payload);
    if (!postResult || !postResult.ok) {
      const reason = postResult && postResult.reason ? postResult.reason : 'ERROR';
      let detail = 'Publication impossible.';
      if (reason === 'RATE_LIMIT') {
        detail = 'Assistant indisponible (rate limit).';
      }
      return { ok: false, reason: reason, message: detail };
    }

    const response = { ok: true, answer: assistantAnswer.message };
    if (assistantAnswer.usage) {
      response.usage = assistantAnswer.usage;
    }
    return response;
  } catch (err) {
    Logger.log('[askAssistant] ' + err);
    return { ok: false, reason: 'ERROR', message: 'Erreur interne assistant.' };
  }
}

/**
 * Cree ou met a jour le menu permettant d'invoquer l'assistant.
 */
function menuAskAssistant() {
  if (typeof CFG_ENABLE_ASSISTANT !== 'undefined' && !CFG_ENABLE_ASSISTANT) {
    try { SpreadsheetApp.getActive().toast('Assistant d\u00E9sactiv\u00E9 dans la configuration.', 'Assistant', 5); } catch (_err) {}
    try {
      const disabledUi = SpreadsheetApp.getUi();
      disabledUi.alert('Assistant Chat', 'Assistant d\u00E9sactiv\u00E9 (CFG_ENABLE_ASSISTANT=false).', disabledUi.ButtonSet.OK);
    } catch (_err) {}
    return { ok: false, reason: 'UNCONFIGURED', message: 'Assistant d\u00E9sactiv\u00E9.' };
  }

  const ui = SpreadsheetApp.getUi();
  try {
    const activeSheet = SpreadsheetApp.getActiveSheet();
    if (!activeSheet || activeSheet.getSheetName() !== SHEET_CHAT) {
      ui.alert('Assistant Chat', 'S\u00E9lectionnez une ligne dans l\'onglet Chat avant de continuer.', ui.ButtonSet.OK);
      return { ok: false, reason: 'NOT_FOUND', message: 'Onglet Chat requis.' };
    }
    const activeRange = activeSheet.getActiveRange();
    if (!activeRange) {
      ui.alert('Assistant Chat', 'S\u00E9lectionnez une ligne contenant la question.', ui.ButtonSet.OK);
      return { ok: false, reason: 'NOT_FOUND', message: 'Ligne s\u00E9lectionn\u00E9e requise.' };
    }
    const rowIndex = activeRange.getRow();
    const answer = askAssistant(rowIndex);
    if (!answer) {
      ui.alert('Assistant Chat', 'Assistant indisponible.', ui.ButtonSet.OK);
      return { ok: false, reason: 'ERROR', message: 'Assistant indisponible.' };
    }
    if (!answer.ok) {
      const detail = answer.message || 'Assistant indisponible.';
      ui.alert('Assistant Chat', detail, ui.ButtonSet.OK);
      return answer;
    }
    ui.alert('Assistant Chat', 'R\u00E9ponse envoy\u00E9e dans le fil.\n\n' + answer.answer, ui.ButtonSet.OK);
    return answer;
  } catch (err) {
    ui.alert('Assistant Chat', err.message || String(err), ui.ButtonSet.OK);
    return { ok: false, reason: 'ERROR', message: 'Erreur interface assistant.' };
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
    const currentThreadRaw = row[1] || CHAT_THREAD_GLOBAL;
    const currentThread = sanitizeScalar(currentThreadRaw, 64);
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
    let pseudo = '';
    try {
      pseudo = computeChatPseudo(row[3], {});
    } catch (_err) {
      pseudo = sanitizeScalar(row[4], 64);
    }
    const role = authorType === 'assistant' ? 'assistant' : 'user';
    const label = pseudo ? '[' + pseudo + '] ' : '';
    context.push({
      role: role,
      content: sanitizeMultiline(label + sanitized, 1200)
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
 * Genere un identifiant interne pour le rate limit du bot assistant.
 * @param {string} threadId
 * @returns {string}
 */
function buildAssistantSessionId_(threadId) {
  const safeThread = sanitizeScalar(threadId || CHAT_THREAD_GLOBAL, 64) || CHAT_THREAD_GLOBAL;
  return 'assistant:' + safeThread;
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
