/**
 * Exécute une fonction avec les surcharges assistant nécessaires puis restaure l'état initial.
 * @param {{enable?:boolean, mocks?:Object<string,Function>}} options
 * @param {Function} callback
 * @returns {*}
 */
function withAssistantMocks_(options, callback) {
  const params = options || {};
  const shouldEnable = params.enable === true;
  const mocks = params.mocks || {};
  const scriptProps = PropertiesService.getScriptProperties();
  const overrideKey = 'CFG_ENABLE_ASSISTANT_OVERRIDE';
  const previousOverride = scriptProps.getProperty(overrideKey);
  if (shouldEnable) {
    scriptProps.setProperty(overrideKey, 'true');
  } else {
    scriptProps.deleteProperty(overrideKey);
  }

  const originals = {};
  Object.keys(mocks).forEach(name => {
    originals[name] = globalThis[name];
    globalThis[name] = mocks[name];
  });

  try {
    return callback();
  } finally {
    if (previousOverride === null || typeof previousOverride === 'undefined') {
      scriptProps.deleteProperty(overrideKey);
    } else {
      scriptProps.setProperty(overrideKey, previousOverride);
    }
    Object.keys(mocks).forEach(name => {
      globalThis[name] = originals[name];
    });
  }
}

function test_callChatGPT_refuseSansFlag() {
  withAssistantMocks_({ enable: false }, () => {
    const result = callChatGPT([], 'Test message');
    if (!result || result.ok !== false || result.reason !== 'UNCONFIGURED') {
      throw new Error('callChatGPT devrait refuser sans flag actif.');
    }
  });
  return { ok: true };
}

function test_askAssistantOnThread_rateLimit() {
  const posts = [];
  let callCount = 0;
  withAssistantMocks_({
    enable: true,
    mocks: {
      buildAssistantThreadContext_: function() {
        return [];
      },
      buildAssistantHistorySnapshot_: function() {
        return [];
      },
      chatPostMessage: function(payload) {
        posts.push(payload);
        return { ok: false, reason: 'RATE_LIMIT' };
      },
      callChatGPT: function() {
        callCount++;
        return { ok: true, message: 'Non utilisé' };
      }
    }
  }, () => {
    const res = askAssistantOnThread({ threadId: 'THREAD_RATE', question: 'Bonjour', sessionId: 'sess' });
    if (!res || res.ok !== false || res.reason !== 'RATE_LIMIT') {
      throw new Error('Le rate-limit doit être propagé au client.');
    }
  });
  if (posts.length !== 1) {
    throw new Error('Le message utilisateur doit être tenté une seule fois.');
  }
  if (callCount !== 0) {
    throw new Error("L’appel API ne doit pas être déclenché en cas de rate-limit.");
  }
  return { ok: true };
}

function test_askAssistantOnThread_success() {
  const posts = [];
  const gptCalls = [];
  const historyCalls = [];
  let finalResponse = null;
  let postCount = 0;
  withAssistantMocks_({
    enable: true,
    mocks: {
      buildAssistantThreadContext_: function(threadId, limit) {
        if (threadId !== 'THREAD_OK' || limit !== CHAT_ASSISTANT_HISTORY_LIMIT) {
          throw new Error('Contexte appelé avec des paramètres inattendus.');
        }
        return [{ role: 'user', content: 'Historique 1' }];
      },
      buildAssistantHistorySnapshot_: function(threadId, limit) {
        historyCalls.push({ threadId: threadId, limit: limit });
        return [{
          threadId: 'THREAD_OK',
          authorType: 'pharmacy',
          authorPseudo: 'Vous',
          message: 'Question test',
          timestamp: 1
        }, {
          threadId: 'THREAD_OK',
          authorType: 'assistant',
          authorPseudo: 'Assistant',
          message: 'Réponse IA',
          timestamp: 2
        }];
      },
      chatPostMessage: function(payload) {
        posts.push(payload);
        postCount++;
        if (postCount === 1) {
          return {
            ok: true,
            threadId: 'THREAD_OK',
            message: 'Question test',
            authorType: 'pharmacy',
            authorPseudo: 'Vous'
          };
        }
        return { ok: true };
      },
      callChatGPT: function(context, prompt) {
        gptCalls.push({ context: context, prompt: prompt });
        return { ok: true, message: 'Réponse IA', usage: { totalTokens: 11 } };
      }
    }
  }, () => {
    const res = askAssistantOnThread({ threadId: 'THREAD_OK', question: 'Question test', sessionId: 'sess' });
    if (!res || res.ok !== true) {
      throw new Error('La réponse doit être ok en cas de succès.');
    }
    finalResponse = res;
  });
  if (gptCalls.length !== 1) {
    throw new Error('L’API doit être appelée une fois.');
  }
  if (!Array.isArray(gptCalls[0].context) || gptCalls[0].context.length !== 1) {
    throw new Error('Le contexte assistant doit contenir un message.');
  }
  if (posts.length !== 2) {
    throw new Error('Deux écritures attendues (client puis assistant).');
  }
  if (posts[0].authorType !== 'pharmacy' || posts[1].authorType !== 'assistant') {
    throw new Error('Les types d’auteurs enregistrés sont incorrects.');
  }
  if (historyCalls.length !== 1) {
    throw new Error('L’historique doit être rafraîchi après la réponse.');
  }
  if (!finalResponse || !Array.isArray(finalResponse.history) || finalResponse.history.length !== 2) {
    throw new Error('L’historique renvoyé doit contenir deux entrées.');
  }
  if (!finalResponse.usage || finalResponse.usage.totalTokens !== 11) {
    throw new Error('Le résumé d’usage doit être propagé.');
  }
  return { ok: true };
}

function test_askAssistantOnThread_apiError() {
  const posts = [];
  withAssistantMocks_({
    enable: true,
    mocks: {
      buildAssistantThreadContext_: function() {
        return [];
      },
      buildAssistantHistorySnapshot_: function() {
        return [];
      },
      chatPostMessage: function(payload) {
        posts.push(payload);
        if (posts.length === 1) {
          return {
            ok: true,
            threadId: 'THREAD_ERR',
            message: 'Question test',
            authorType: 'pharmacy',
            authorPseudo: 'Vous'
          };
        }
        return { ok: true };
      },
      callChatGPT: function() {
        return { ok: false, reason: 'API_ERROR' };
      }
    }
  }, () => {
    const res = askAssistantOnThread({ threadId: 'THREAD_ERR', question: 'Question test', sessionId: 'sess' });
    if (!res || res.ok !== false || res.reason !== 'API_ERROR') {
      throw new Error('Les erreurs API doivent être renvoyées au client.');
    }
  });
  return { ok: true };
}

