// =================================================================
//                      VALIDATION DE LA CONFIGURATION
// =================================================================
// Description: Vérifie l'intégrité des paramètres critiques définis
//              dans Configuration.gs. Bloque l'exécution et alerte
//              l'administrateur en cas d'erreur.
// =================================================================

/**
 * Fonction principale de validation, appelée au démarrage de l'application.
 * @throws {Error} Lance une erreur si un problème de configuration est détecté.
 */
function validerConfiguration() {
  const erreurs = [];
  
  // --- Vérification des formats ---
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(ADMIN_EMAIL)) {
    erreurs.push(`Format de l'e-mail administrateur invalide : ${ADMIN_EMAIL}`);
  }
  
  try {
    const siret = getSecret('SIRET');
    if (!/^\d{14}$/.test(siret)) {
      erreurs.push('Format du SIRET invalide. Il doit contenir 14 chiffres (valeur masquée).');
    }
  } catch (_e) {
    erreurs.push('La propriété Script SIRET est manquante ou inaccessible.');
  }
  
  // --- Vérification de la cohérence ---
  if (HEURE_DEBUT_SERVICE >= HEURE_FIN_SERVICE) {
    erreurs.push(`L'heure de début de service (${HEURE_DEBUT_SERVICE}) doit être antérieure à l'heure de fin (${HEURE_FIN_SERVICE}).`);
  }

  // --- Test d'accès aux IDs des services Google ---
  const accessChecks = [
    {
      message: "L'ID du dossier d'archives (ID_DOSSIER_ARCHIVES) est invalide ou l'accès est refusé.",
      test: function () { DriveApp.getFolderById(getSecret('ID_DOSSIER_ARCHIVES')); },
      scope: 'https://www.googleapis.com/auth/drive'
    },
    {
      message: "L'ID du dossier temporaire (ID_DOSSIER_TEMPORAIRE) est invalide ou l'accès est refusé.",
      test: function () { DriveApp.getFolderById(getSecret('ID_DOSSIER_TEMPORAIRE')); },
      scope: 'https://www.googleapis.com/auth/drive'
    },
    {
      message: "L'ID du modèle de facture (ID_MODELE_FACTURE) est invalide ou l'accès est refusé.",
      test: function () { DocumentApp.openById(getSecret('ID_MODELE_FACTURE')); },
      scope: 'https://www.googleapis.com/auth/documents'
    },
    {
      message: "L'ID de la feuille de calcul (ID_FEUILLE_CALCUL) est invalide ou l'accès est refusé.",
      test: function () { SpreadsheetApp.openById(getSecret('ID_FEUILLE_CALCUL')); },
      scope: 'https://www.googleapis.com/auth/spreadsheets'
    },
    {
      message: "L'ID du document des CGV (ID_DOCUMENT_CGV) est invalide ou l'accès est refusé.",
      test: function () { DocumentApp.openById(getSecret('ID_DOCUMENT_CGV')); },
      scope: 'https://www.googleapis.com/auth/documents'
    },
    {
      message: "L'ID du calendrier (ID_CALENDRIER) est invalide ou l'accès est refusé.",
      test: function () { CalendarApp.getCalendarById(getSecret('ID_CALENDRIER')); },
      scope: 'https://www.googleapis.com/auth/calendar'
    }
  ];

  const missingScopes = new Set();
  accessChecks.forEach(function (check) {
    try {
      check.test();
    } catch (e) {
      if (isInsufficientPermissionError_(e)) {
        if (check.scope) {
          missingScopes.add(check.scope);
        }
      }
      erreurs.push(check.message + describeConfigAccessError_(e));
    }
  });

  if (missingScopes.size > 0) {
    const scopeMessage = buildMissingScopeMessage_(Array.from(missingScopes));
    if (scopeMessage) {
      erreurs.push(scopeMessage);
    }
  }
  // --- Gestion centralisée des erreurs ---
  if (erreurs.length > 0) {
    const messageErreur = `La validation de la configuration a échoué avec ${erreurs.length} erreur(s) :\n- ` + erreurs.join("\n- ");
    Logger.log(messageErreur);
    // Envoie un e-mail à l'administrateur pour l'alerter immédiatement.
    if (typeof GmailApp !== 'undefined') {
      try {
        GmailApp.sendEmail(ADMIN_EMAIL, `[${NOM_ENTREPRISE}] ERREUR CRITIQUE DE CONFIGURATION`, messageErreur);
      } catch (sendErr) {
        Logger.log(`Avertissement: notification Gmail échouée (${sendErr}).`);
        try {
          MailApp.sendEmail(ADMIN_EMAIL, `[${NOM_ENTREPRISE}] ERREUR CRITIQUE DE CONFIGURATION`, messageErreur);
        } catch (mailErr) {
          Logger.log(`Avertissement: notification MailApp échouée (${mailErr}).`);
        }
      }
    } else {
      try {
        MailApp.sendEmail(ADMIN_EMAIL, `[${NOM_ENTREPRISE}] ERREUR CRITIQUE DE CONFIGURATION`, messageErreur);
      } catch (mailErr) {
        Logger.log(`Avertissement: notification MailApp échouée (${mailErr}).`);
      }
    }
    // Stoppe l'exécution de l'application en lançant une erreur.
    throw new Error(messageErreur);
  }
  
  Logger.log("Configuration validée avec succès.");
  return true; // Retourne true si tout est correct.
}

const SCOPE_LABELS = {
  'https://www.googleapis.com/auth/drive': 'Drive',
  'https://www.googleapis.com/auth/spreadsheets': 'Google Sheets',
  'https://www.googleapis.com/auth/documents': 'Google Docs',
  'https://www.googleapis.com/auth/calendar': 'Google Calendar'
};

function isInsufficientPermissionError_(error) {
  if (!error) {
    return false;
  }
  let message = '';
  if (typeof error === 'string') {
    message = error;
  } else if (error && typeof error.message === 'string') {
    message = error.message;
  } else {
    try {
      message = String(error);
    } catch (_err) {
      message = '';
    }
  }
  if (!message) {
    return false;
  }
  const lower = message.toLowerCase();
  return lower.indexOf('les autorisations spécifiées ne sont pas suffisantes') !== -1 ||
    lower.indexOf('specified permissions are not sufficient') !== -1;
}

function buildMissingScopeMessage_(scopes) {
  if (!Array.isArray(scopes) || scopes.length === 0) {
    return '';
  }
  const uniqueScopes = [];
  scopes.forEach(function (scope) {
    if (uniqueScopes.indexOf(scope) === -1) {
      uniqueScopes.push(scope);
    }
  });
  const humanReadable = uniqueScopes.map(function (scope) {
    return SCOPE_LABELS[scope] || scope;
  });
  return "Autorisations Apps Script insuffisantes pour valider la configuration. Veuillez réautoriser l'application afin d'accéder aux services : " +
    humanReadable.join(', ') +
    ". Ouvrez le projet dans l'éditeur Apps Script, exécutez une fonction (par exemple checkSetup_ELS) et acceptez les nouvelles autorisations, puis relancez la validation. Vérifiez également que le manifeste appsscript.json déclare bien ces scopes.";
}

/**
 * Retourne un résumé lisible de l'erreur rencontrée lors d'un accès Drive/Docs.
 * @param {*} error Erreur retournée par les services Google.
 * @returns {string} Détails entre parenthèses ou chaîne vide.
 */

function describeConfigAccessError_(error) {
  if (!error) {
    return '';
  }
  var message = '';
  if (typeof error === 'string') {
    message = error;
  } else if (error && typeof error.message === 'string') {
    message = error.message;
  } else {
    try {
      message = String(error);
    } catch (e) {
      message = '';
    }
  }
  return message ? ' (' + message + ')' : '';
}
