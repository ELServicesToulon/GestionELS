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
  try { DriveApp.getFolderById(getSecret('ID_DOSSIER_ARCHIVES')); } catch (e) { erreurs.push("L'ID du dossier d'archives (ID_DOSSIER_ARCHIVES) est invalide ou l'accès est refusé."); }
  try { DriveApp.getFolderById(getSecret('ID_DOSSIER_TEMPORAIRE')); } catch (e) { erreurs.push("L'ID du dossier temporaire (ID_DOSSIER_TEMPORAIRE) est invalide ou l'accès est refusé."); }
  try { DocumentApp.openById(getSecret('ID_MODELE_FACTURE')); } catch (e) { erreurs.push("L'ID du modèle de facture (ID_MODELE_FACTURE) est invalide ou l'accès est refusé."); }
  try { SpreadsheetApp.openById(getSecret('ID_FEUILLE_CALCUL')); } catch (e) { erreurs.push("L'ID de la feuille de calcul (ID_FEUILLE_CALCUL) est invalide ou l'accès est refusé."); }
  try { DocumentApp.openById(getSecret('ID_DOCUMENT_CGV')); } catch (e) { erreurs.push("L'ID du document des CGV (ID_DOCUMENT_CGV) est invalide ou l'accès est refusé."); }
  try { CalendarApp.getCalendarById(getSecret('ID_CALENDRIER')); } catch (e) { erreurs.push("L'ID du calendrier (ID_CALENDRIER) est invalide ou l'accès est refusé."); }

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
