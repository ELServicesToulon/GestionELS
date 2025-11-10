// =================================================================
//                      AUDIT DES MODULES GS
// =================================================================
// Description: Fonctions d'audit pour vérifier la présence des helpers
//              critiques et valider les comportements de base.
// =================================================================

const AUDIT_REQUIRED_FUNCTION_GROUPS = Object.freeze({
  sanitizers: [
    'sanitizeMultiline',
    'sanitizeScalar',
    'sanitizeEmail',
    'sanitizePharmacyCode'
  ],
  chatCore: [
    'computeChatPseudo',
    'isChatRateAllowed',
    'chatPostMessage',
    'chatGetMessages',
    'chatGetMessagesForThread'
  ],
  sheetHelpers: [
    'getMainSpreadsheet',
    'ensureSheetWithHeaders',
    'getChatSheet',
    'getChatMetaSheet',
    'getDemandesSheet',
    'chatProvisionSheets'
  ]
});

const AUDIT_GLOBAL_SCOPE = (function obtainGlobal() {
  // Apps Script exécute les fichiers dans le scope global.
  return typeof globalThis !== 'undefined' ? globalThis : this;
})();

/**
 * Vérifie la présence des fonctions critiques.
 * @returns {{ok:boolean,reason?:string,missingByGroup?:Object<string,string[]>}}
 */
function auditRequiredFunctions() {
  const missingByGroup = {};
  Object.keys(AUDIT_REQUIRED_FUNCTION_GROUPS).forEach(group => {
    const missing = AUDIT_REQUIRED_FUNCTION_GROUPS[group].filter(fnName => {
      return typeof AUDIT_GLOBAL_SCOPE[fnName] !== 'function';
    });
    if (missing.length) {
      missingByGroup[group] = missing;
    }
  });
  const ok = Object.keys(missingByGroup).length === 0;
  if (!ok) {
    Logger.log('[auditRequiredFunctions] Fonctions manquantes: %s', JSON.stringify(missingByGroup));
  }
  return ok ? { ok: true } : { ok: false, reason: 'MISSING_HELPERS', missingByGroup: missingByGroup };
}

/**
 * Valide le comportement des fonctions de sanitisation.
 * @returns {{ok:boolean,reason?:string,issues?:string[]}}
 */
function auditSanitizersBehaviour() {
  const issues = [];
  if (typeof sanitizeMultiline === 'function') {
    const raw = '<b>Message</b> <script>bad()</script>';
    const sanitized = sanitizeMultiline(raw, 32);
    if (!sanitized || sanitized.indexOf('<') !== -1 || sanitized.length > 32) {
      issues.push('sanitizeMultiline ne supprime pas correctement les balises ou la limite.');
    }
  } else {
    issues.push('sanitizeMultiline indisponible.');
  }

  if (typeof sanitizeScalar === 'function') {
    const scalar = sanitizeScalar('  valeur  ', 6);
    if (scalar !== 'valeur') {
      issues.push('sanitizeScalar ne tronque/pas correctement.');
    }
  } else {
    issues.push('sanitizeScalar indisponible.');
  }

  if (typeof sanitizeEmail === 'function') {
    const email = sanitizeEmail(' USER@EXAMPLE.COM ');
    if (email !== 'user@example.com') {
      issues.push('sanitizeEmail ne normalise pas correctement.');
    }
  } else {
    issues.push('sanitizeEmail indisponible.');
  }

  if (typeof sanitizePharmacyCode === 'function') {
    const valid = sanitizePharmacyCode(' ab12 ');
    const invalid = sanitizePharmacyCode('abc');
    if (valid !== 'AB12' || invalid !== null) {
      issues.push('sanitizePharmacyCode accepte des codes invalides.');
    }
  } else {
    issues.push('sanitizePharmacyCode indisponible.');
  }

  if (issues.length) {
    Logger.log('[auditSanitizersBehaviour] Problèmes détectés: %s', JSON.stringify(issues));
    return { ok: false, reason: 'SANITIZER_FAILED', issues: issues };
  }
  return { ok: true };
}

/**
 * Vérifie la cohérence du rate limit chat.
 * @returns {{ok:boolean,reason?:string,details?:Object}}
 */
function auditRateLimiter() {
  if (typeof isChatRateAllowed !== 'function' || typeof buildChatRateKey !== 'function') {
    return { ok: false, reason: 'MISSING_HELPERS', details: { missing: 'isChatRateAllowed/buildChatRateKey' } };
  }

  const sessionId = 'audit:' + Utilities.getUuid();
  const sequence = [];
  let blocked = false;
  for (let i = 0; i < 4; i++) {
    const allowed = isChatRateAllowed(sessionId);
    sequence.push(allowed);
    if (!allowed) {
      blocked = true;
      break;
    }
  }

  const cacheKey = 'chat_rate:' + buildChatRateKey(sessionId);
  try {
    CacheService.getScriptCache().remove(cacheKey);
  } catch (_err) {
    // Nettoyage best-effort.
  }
  try {
    PropertiesService.getScriptProperties().deleteProperty('chat_rate_last:' + buildChatRateKey(sessionId));
  } catch (_err2) {
    // Ignoré.
  }

  if (sequence.length < 4 || sequence[0] !== true || sequence[1] !== true || sequence[2] !== true || blocked !== true) {
    Logger.log('[auditRateLimiter] Séquence inattendue: %s', JSON.stringify(sequence));
    return { ok: false, reason: 'RATE_LIMIT', details: { sequence: sequence } };
  }

  return { ok: true, details: { sequence: sequence } };
}

/**
 * Vérifie la présence des feuilles critiques sans modification.
 * @returns {{ok:boolean,reason?:string,missingSheets?:string[],sheetNames?:string[]}}
 */
function auditChatSheetsPresence() {
  try {
    const ss = getMainSpreadsheet();
    const sheets = ss.getSheets().map(sheet => sheet.getSheetName());
    const required = [SHEET_CHAT, SHEET_CHAT_META, SHEET_DEMANDES_TOURNEE];
    const missing = required.filter(name => sheets.indexOf(name) === -1);
    if (missing.length) {
      Logger.log('[auditChatSheetsPresence] Feuilles manquantes: %s', missing.join(', '));
      return { ok: false, reason: 'NOT_FOUND', missingSheets: missing, sheetNames: sheets };
    }
    return { ok: true, sheetNames: sheets };
  } catch (err) {
    Logger.log('[auditChatSheetsPresence] Erreur: %s', err);
    return { ok: false, reason: 'UNCONFIGURED', error: String(err) };
  }
}

/**
 * Lance l'audit global des fichiers .gs critiques.
 * @returns {{ok:boolean,reason?:string,failingChecks?:string[],checks:Object}}
 */
function auditGsModules() {
  const checks = {
    required: auditRequiredFunctions(),
    sanitizers: auditSanitizersBehaviour(),
    rateLimiter: auditRateLimiter(),
    sheets: auditChatSheetsPresence()
  };
  const failing = Object.keys(checks).filter(key => !checks[key].ok);
  const ok = failing.length === 0;
  const reason = ok ? undefined : (checks[failing[0]] && checks[failing[0]].reason) || 'ERROR';
  Logger.log('[auditGsModules] ok=%s, failing=%s', ok, failing.join(','));
  const result = {
    ok: ok,
    checks: checks
  };
  if (!ok) {
    result.reason = reason;
    result.failingChecks = failing;
  }
  return result;
}
