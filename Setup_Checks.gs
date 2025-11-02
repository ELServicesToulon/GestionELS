// ================================================================
//                      VÉRIFICATION DE L'INSTALLATION (ELS)
// ================================================================
// Fonction utilitaire non bloquante pour vérifier rapidement la
// configuration: propriétés requises, flags exposés et infos d'env.
// Utilisez `clasp run checkSetup_ELS` pour obtenir un résumé JSON.

const REQUIRED_PROPS = ['NOM_ENTREPRISE','ADRESSE_ENTREPRISE','EMAIL_ENTREPRISE','ADMIN_EMAIL','ID_FEUILLE_CALCUL','ID_CALENDRIER','ID_DOCUMENT_CGV','ID_MODELE_FACTURE','ID_DOSSIER_ARCHIVES','ID_DOSSIER_TEMPORAIRE','SIRET','ELS_SHARED_SECRET','ID_FACTURES_DRIVE'];

/**
 * Vérifie la configuration de base sans effets de bord.
 * @returns {{ok:boolean, missingProps:string[], flags:Object, info:Object, warnings:string[]}}
 */
function checkSetup_ELS() {
  const warnings = [];

  // 0) Vérification des scopes OAuth requis
  if (typeof SEND_MAIL_SCOPE_CHECK_ENABLED !== 'undefined' && SEND_MAIL_SCOPE_CHECK_ENABLED) {
    const requiredScope = 'https://www.googleapis.com/auth/gmail.send';
    const scopes = ScriptApp.getProjectOAuthScopes();
    if (!Array.isArray(scopes) || scopes.indexOf(requiredScope) === -1) {
      const msg = '[ELS setup] Scope OAuth manquant: ' + requiredScope;
      Logger.log(msg);
      throw new Error(msg);
    }
  }

  // 1) Propriétés requises
  const sp = PropertiesService.getScriptProperties();
  const missing = (Array.isArray(REQUIRED_PROPS) ? REQUIRED_PROPS : []).filter(k => {
    const v = sp.getProperty(k);
    return v === null || v === '';
  });

  // 2) Flags exposés au client (depuis Configuration.gs)
  var flags = {};
  try {
    flags = getConfiguration ? getConfiguration() : Object.assign({}, FLAGS);
  } catch (e) {
    warnings.push('Impossible de lire les flags (getConfiguration/FLAGS).');
  }

  // 3) Infos d’environnement utiles
  var scriptUrl = '';
  try { scriptUrl = ScriptApp.getService().getUrl(); } catch (e) { /* pas de déploiement */ }
  const info = {
    timezone: Session.getScriptTimeZone(),
    scriptUrl: scriptUrl,
    themeV2: typeof THEME_V2_ENABLED !== 'undefined' ? !!THEME_V2_ENABLED : false,
    slotsAmpm: typeof SLOTS_AMPM_ENABLED !== 'undefined' ? !!SLOTS_AMPM_ENABLED : false
  };

  const ok = missing.length === 0;

  const result = {
    ok: ok,
    missingProps: missing,
    flags: flags,
    info: info,
    warnings: warnings
  };

  // Log résumé lisible dans l'IDE Apps Script
  Logger.log('[ELS setup] ok=%s, missingProps=%s', ok, missing.join(', '));
  return result;
}

