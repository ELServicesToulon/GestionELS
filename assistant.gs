// =================================================================
//                 INTEGRATION ASSISTANT CHATGPT
// =================================================================
// Fournit une fonction utilitaire pour appeler l'API OpenAI et
// poster automatiquement la réponse dans l'onglet Chat.
// =================================================================

const CHAT_ASSISTANT_API_URL = 'https://api.openai.com/v1/chat/completions';
const CHAT_ASSISTANT_MODEL = 'gpt-4o';
const CHAT_ASSISTANT_HISTORY_LIMIT = 10;
const CHAT_ASSISTANT_SYSTEM_PROMPT = 'Assistant pour pharmaciens en EHPAD; réponses concises; pas de données personnelles.';
const CHAT_ASSISTANT_DEFAULT_VISIBILITY = 'pharmacy';
const CHAT_ASSISTANT_DEFAULT_TEMPERATURE = 0.3;
const CHAT_ASSISTANT_MAX_RETRIES = 3;
const CHAT_ASSISTANT_BACKOFF_MS = 400;
const CHAT_ASSISTANT_USAGE_PREFIX = 'assistant_tokens:';

/**
 * Appelle l'API OpenAI en combinant le contexte et la question utilisateur.
 * @param {Array<Object>} contextMessages
 * @param {string} userPrompt
 * @param {{fetchImpl?:Function, sleepImpl?:Function, maxRetries?:number, backoffMs?:number}} [opts]
 * @returns {{ok:boolean, reason?:string, message?:string, usage?:Object}}
 */
function callChatGPT(contextMessages, userPrompt, opts) {
  if (!isAssistantFeatureEnabled_()) {
    return { ok: false, reason: 'UNCONFIGURED' };
  }

  const promptChunk = sanitizeMultiline(userPrompt, 1200);
  const safePrompt = scrubChatMessage_(promptChunk);
  if (!safePrompt) {
    return { ok: false, reason: 'EMPTY_MESSAGE' };
  }

  let apiKey = '';
  try {
    apiKey = getSecret('OPENAI_API_KEY');
  } catch (err) {
    console.error('[callChatGPT] Missing OPENAI_API_KEY', err);
    return { ok: false, reason: 'UNCONFIGURED' };
  }

  const limit = Number(typeof CFG_ASSISTANT_MONTHLY_BUDGET_TOKENS !== 'undefined' ? CFG_ASSISTANT_MONTHLY_BUDGET_TOKENS : 0);
  const usageKey = getAssistantUsageKey_();
  const currentUsage = readAssistantUsage_(usageKey);
  if (limit > 0 && currentUsage >= limit) {
    return { ok: false, reason: 'BUDGET_EXCEEDED' };
  }

  const contextList = Array.isArray(contextMessages) ? contextMessages : [];
  const formattedContext = [];
  const startIndex = Math.max(0, contextList.length - CHAT_ASSISTANT_HISTORY_LIMIT);
  for (let i = startIndex; i < contextList.length; i++) {
    const entry = contextList[i];
    if (!entry) {
      continue;
    }
    let role = 'user';
    let content = '';
    if (entry.role) {
      role = String(entry.role).toLowerCase() === 'assistant' ? 'assistant' : 'user';
      content = entry.content;
    } else {
      role = String(entry.authorType || '').toLowerCase() === 'assistant' ? 'assistant' : 'user';
      content = entry.message;
    }
    const sanitizedContent = scrubChatMessage_(sanitizeMultiline(content, 1000));
    if (!sanitizedContent) {
      continue;
    }
    formattedContext.push({ role: role, content: sanitizedContent });
  }

  const requestMessages = [{
    role: 'system',
    content: CHAT_ASSISTANT_SYSTEM_PROMPT
  }].concat(formattedContext);

  requestMessages.push({
    role: 'user',
    content: safePrompt
  });

  const requestBody = {
    model: CHAT_ASSISTANT_MODEL,
    temperature: CHAT_ASSISTANT_DEFAULT_TEMPERATURE,
    messages: requestMessages
  };

  const options = opts || {};
  const fetchImpl = typeof options.fetchImpl === 'function'
    ? options.fetchImpl
    : function(url, params) { return UrlFetchApp.fetch(url, params); };
  const sleepImpl = typeof options.sleepImpl === 'function'
    ? options.sleepImpl
    : function(delay) { Utilities.sleep(delay); };
  const maxRetries = Math.max(1, Number(options.maxRetries) || CHAT_ASSISTANT_MAX_RETRIES);
  const backoffBase = Math.max(0, Number(options.backoffMs) || CHAT_ASSISTANT_BACKOFF_MS);

  let lastError = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = fetchImpl(CHAT_ASSISTANT_API_URL, {
        method: 'post',
        contentType: 'application/json',
        headers: {
          Authorization: 'Bearer ' + apiKey
        },
        payload: JSON.stringify(requestBody),
        muteHttpExceptions: true
      });
      const status = typeof response.getResponseCode === 'function'
        ? response.getResponseCode()
        : Number(response.status || 0);
      const body = typeof response.getContentText === 'function'
        ? response.getContentText()
        : String(response.body || '');
      if (status === 200) {
        let parsed;
        try {
          parsed = JSON.parse(body);
        } catch (parseErr) {
          console.error('[callChatGPT] JSON parse error', parseErr);
          return { ok: false, reason: 'API_ERROR' };
        }
        const firstChoice = parsed && parsed.choices && parsed.choices[0];
        const rawMessage = firstChoice && firstChoice.message && firstChoice.message.content;
        const assistantText = scrubChatMessage_(sanitizeMultiline(rawMessage, 1200));
        if (!assistantText) {
          console.error('[callChatGPT] Empty message content');
          return { ok: false, reason: 'API_ERROR' };
        }
        const usage = parsed && parsed.usage ? parsed.usage : {};
        const totalTokens = Number(usage.total_tokens) || 0;
        const promptTokens = Number(usage.prompt_tokens) || 0;
        const completionTokens = Number(usage.completion_tokens) || 0;
        const newUsage = currentUsage + totalTokens;
        writeAssistantUsage_(usageKey, newUsage);
        return {
          ok: true,
          message: assistantText,
          usage: {
            totalTokens: totalTokens,
            promptTokens: promptTokens,
            completionTokens: completionTokens,
            budget: {
              limit: limit,
              used: newUsage,
              remaining: limit > 0 ? Math.max(0, limit - newUsage) : null
            }
          }
        };
      }

      const shouldRetry = status === 429 || status >= 500;
      if (!shouldRetry) {
        console.error('[callChatGPT] HTTP ' + status + ' - ' + body);
        return { ok: false, reason: 'API_ERROR' };
      }
      lastError = 'HTTP ' + status;
    } catch (err) {
      console.error('[callChatGPT] fetch error', err);
      lastError = err;
    }

    if (attempt < maxRetries - 1 && backoffBase > 0) {
      try {
        const delay = backoffBase * Math.pow(2, attempt);
        sleepImpl(delay);
      } catch (_err) {
        // Ignorer les erreurs de temporisation.
      }
    }
  }

  console.warn('[callChatGPT] Attempts exhausted', lastError);
  return { ok: false, reason: 'API_ERROR' };
}

/**
 * Fournit une réponse assistant pour un thread spécifique côté WebApp.
 * @param {string} threadId
 * @param {string} prompt
 * @returns {{ok:boolean, reason?:string, messages?:Array<Object>, usage?:Object}}
 */
function askAssistantOnThread(threadId, prompt) {
  if (!isAssistantFeatureEnabled_()) {
    return { ok: false, reason: 'UNCONFIGURED' };
  }

  const safeThread = sanitizeScalar(threadId || CHAT_THREAD_GLOBAL, 64) || CHAT_THREAD_GLOBAL;
  const sanitizedQuestion = sanitizeMultiline(prompt, 1000);
  if (!sanitizedQuestion) {
    return { ok: false, reason: 'EMPTY_MESSAGE' };
  }
  const safeQuestion = scrubChatMessage_(sanitizedQuestion);
  if (!safeQuestion) {
    return { ok: false, reason: 'EMPTY_MESSAGE' };
  }

  const contextResult = chatGetThreadMessages({
    threadId: safeThread,
    limit: CHAT_ASSISTANT_HISTORY_LIMIT,
    audience: 'pharmacy'
  });
  if (!contextResult || contextResult.ok === false) {
    return contextResult && contextResult.reason ? contextResult : { ok: false, reason: 'ERROR' };
  }

  const contextMessages = Array.isArray(contextResult.messages) ? contextResult.messages : [];
  const gptContext = [];
  for (let i = 0; i < contextMessages.length; i++) {
    const msg = contextMessages[i];
    if (!msg) {
      continue;
    }
    const content = scrubChatMessage_(sanitizeMultiline(msg.message, 1000));
    if (!content) {
      continue;
    }
    const role = String(msg.authorType || '').toLowerCase() === 'assistant' ? 'assistant' : 'user';
    gptContext.push({ role: role, content: content });
  }

  const sessionId = buildAssistantClientSessionId_(safeThread);
  const fallbackCode = computeAssistantFallbackCode_(sessionId);

  const userPost = chatPostMessage({
    authorType: 'pharmacy',
    message: sanitizedQuestion,
    threadId: safeThread,
    sessionId: sessionId,
    pharmacyCode: fallbackCode,
    visibleTo: CHAT_ASSISTANT_DEFAULT_VISIBILITY
  });
  if (!userPost || userPost.ok !== true) {
    return userPost && userPost.reason ? userPost : { ok: false, reason: 'ERROR' };
  }

  const aiResponse = callChatGPT(gptContext, sanitizedQuestion);
  if (!aiResponse || aiResponse.ok !== true) {
    return aiResponse && aiResponse.reason ? aiResponse : { ok: false, reason: 'API_ERROR' };
  }

  const assistantMessage = sanitizeMultiline(aiResponse.message, 1200);
  if (!assistantMessage) {
    return { ok: false, reason: 'API_ERROR' };
  }

  const assistantPost = chatPostMessage({
    authorType: 'assistant',
    authorPseudo: 'Assistant',
    message: assistantMessage,
    visibleTo: CHAT_ASSISTANT_DEFAULT_VISIBILITY,
    threadId: safeThread,
    sessionId: buildAssistantSessionId_(safeThread)
  });
  if (!assistantPost || assistantPost.ok !== true) {
    return assistantPost && assistantPost.reason ? assistantPost : { ok: false, reason: 'ERROR' };
  }

  const updated = chatGetThreadMessages({
    threadId: safeThread,
    limit: CHAT_ASSISTANT_HISTORY_LIMIT * 2,
    audience: 'pharmacy'
  });
  if (!updated || updated.ok === false) {
    return { ok: true, messages: [], usage: aiResponse.usage || null };
  }

  return {
    ok: true,
    messages: Array.isArray(updated.messages) ? updated.messages : [],
    usage: aiResponse.usage || null
  };
}

/**
 * Construit un identifiant de session pour l'utilisateur assistant côté web.
 * @param {string} threadId
 * @returns {string}
 */
function buildAssistantClientSessionId_(threadId) {
  const safeThread = sanitizeScalar(threadId || CHAT_THREAD_GLOBAL, 64) || CHAT_THREAD_GLOBAL;
  return 'assistant-client:' + safeThread;
}

/**
 * Indique si l'assistant est activé via la configuration ou une propriété override.
 * @returns {boolean}
 */
function isAssistantFeatureEnabled_() {
  if (typeof CFG_ENABLE_ASSISTANT !== 'undefined' && CFG_ENABLE_ASSISTANT) {
    return true;
  }
  try {
    const override = PropertiesService.getScriptProperties().getProperty('CFG_ENABLE_ASSISTANT_OVERRIDE');
    return String(override || '').toLowerCase() === 'true';
  } catch (_err) {
    return false;
  }
}

/**
 * Retourne la clé de stockage du compteur de jetons mensuel.
 * @returns {string}
 */
function getAssistantUsageKey_() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return CHAT_ASSISTANT_USAGE_PREFIX + year + month;
}

/**
 * Lit le compteur de jetons assistant depuis les propriétés.
 * @param {string} key
 * @returns {number}
 */
function readAssistantUsage_(key) {
  try {
    const raw = PropertiesService.getScriptProperties().getProperty(key);
    return raw ? Number(raw) || 0 : 0;
  } catch (err) {
    console.warn('[callChatGPT] Unable to read usage', err);
    return 0;
  }
}

/**
 * Écrit le compteur de jetons assistant dans les propriétés.
 * @param {string} key
 * @param {number} value
 */
function writeAssistantUsage_(key, value) {
  try {
    const safeValue = Math.max(0, Math.floor(Number(value) || 0));
    PropertiesService.getScriptProperties().setProperty(key, String(safeValue));
  } catch (err) {
    console.warn('[callChatGPT] Unable to persist usage', err);
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
 * Génère un identifiant interne pour le rate limit du bot.
 * @param {string} threadId
 * @returns {string}
 */
function buildAssistantSessionId_(threadId) {
  const safeThread = sanitizeScalar(threadId || CHAT_THREAD_GLOBAL, 64) || CHAT_THREAD_GLOBAL;
  return 'assistant:' + safeThread;
}

/**
 * Supprime les informations sensibles des messages pour respecter la confidentialité.
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
 * Teste le respect du burst rate-limit pour les réponses assistant.
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
      throw new Error('Le burst est trop strict à l\'iteration ' + i + '.');
    }
  }

  if (isChatRateAllowed(sessionId)) {
    throw new Error('Le burst n\'est pas appliqué après ' + CHAT_RATE_LIMIT_BURST + ' appels.');
  }

  return { ok: true };
}
