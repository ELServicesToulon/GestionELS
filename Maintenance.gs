// =================================================================
//        MAINTENANCE, SAUVEGARDE, JOURNALISATION & SUPERVISION
// =================================================================
// Description: Module pour la journalisation des actions, les
//              sauvegardes et la purge des anciennes données (RGPD).
// =================================================================

// --- Constantes de Rétention (RGPD) ---
// Définies dans Configuration.gs : ANNEES_RETENTION_FACTURES, MOIS_RETENTION_LOGS

const FACTURATION_HEADERS = (function() {
  const headers = ['Date','Client (Raison S. Client)','Client (Email)','Type','Détails','Montant','Statut','Valider','N° Facture','Event ID','ID Réservation','Note Interne','Tournée Offerte Appliquée','Type Remise Appliquée','Valeur Remise Appliquée','Lien Note'];
  if (BILLING_ID_PDF_CHECK_ENABLED) {
    headers.splice(9, 0, 'ID PDF');
  }
  return headers;
})();

// =================================================================
//                      1. JOURNALISATION (LOGGING)
// =================================================================

/**
 * Journalise une action administrative dans l'onglet "Admin_Logs".
 * @param {string} action Le nom de l'action effectuée (ex: "Archivage Mensuel").
 * @param {string} statut Le résultat de l'action (ex: "Succès").
 */
function logAdminAction(action, statut) {
  try {
    const ss = SpreadsheetApp.openById(getSecret('ID_FEUILLE_CALCUL'));
    let feuilleLog = ss.getSheetByName(SHEET_ADMIN_LOGS);
    if (!feuilleLog) {
      feuilleLog = ss.insertSheet("Admin_Logs");
      feuilleLog.appendRow(["Timestamp", "Utilisateur", "Action", "Statut"]);
    }
    const utilisateur = Session.getActiveUser().getEmail() || "Utilisateur inconnu";
    feuilleLog.appendRow([new Date(), utilisateur, action, statut]);
  } catch (e) {
    Logger.log(`Impossible de journaliser l'action admin : ${e.toString()}`);
  }
}

/**
 * Journalise une activité liée à une réservation dans l'onglet "Logs".
 * @param {string} idReservation L'ID de la réservation.
 * @param {string} emailClient L'e-mail du client.
 * @param {string} resume Un résumé de l'action.
 * @param {number} prix Le montant associé.
 * @param {string} statut Le statut de l'action ("Succès", "Échec", etc.).
 */
function logActivity(idReservation, emailClient, resume, prix, statut) {
  try {
    const ss = SpreadsheetApp.openById(getSecret('ID_FEUILLE_CALCUL'));
    let feuilleLog = ss.getSheetByName(SHEET_LOGS);
    if (!feuilleLog) {
      feuilleLog = ss.insertSheet("Logs");
      feuilleLog.appendRow(["Timestamp", "Reservation ID", "Client Email", "Résumé", "Montant", "Statut"]);
    }
    feuilleLog.appendRow([new Date(), idReservation, emailClient, resume, prix, statut]);
  } catch (e) {
    Logger.log(`Impossible de journaliser l'activité : ${e.toString()}`);
  }
}

/**
 * Supprime les entrées de logs plus anciennes que MOIS_RETENTION_LOGS.
 */
function purgeOldLogs() {
  try {
    const ss = SpreadsheetApp.openById(getSecret('ID_FEUILLE_CALCUL'));
    const sheet = ss.getSheetByName(SHEET_LOGS);
    if (!sheet) return;
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return;
    const limite = new Date();
    limite.setMonth(limite.getMonth() - MOIS_RETENTION_LOGS);
    const rowsToDelete = [];
    for (let i = data.length - 1; i > 0; i--) {
      const date = new Date(data[i][0]);
      if (date && !isNaN(date) && date < limite) {
        rowsToDelete.push(i + 1);
      }
    }
    rowsToDelete.forEach(r => sheet.deleteRow(r));
  } catch (e) {
    Logger.log(`Erreur purgeOldLogs : ${e.toString()}`);
  }
}

/**
 * Envoie une notification d'erreur à l'admin en limitant la fréquence pour éviter le spam.
 * @param {string} typeErreur Une clé unique pour le type d'erreur (ex: 'ERREUR_AUDIT_DRIVE').
 * @param {string} sujet Le sujet de l'e-mail.
 * @param {string} corps Le corps de l'e-mail.
 */
function notifyAdminWithThrottle(typeErreur, sujet, corps) {
  const cache = CacheService.getScriptCache();
  const cleCache = `erreur_notification_${typeErreur}`;

  if (cache.get(cleCache)) {
    Logger.log(`Notification pour l'erreur "${typeErreur}" déjà envoyée. Envoi ignoré.`);
    return;
  }

  try {
    GmailApp.sendEmail(ADMIN_EMAIL, sujet, corps);
    cache.put(cleCache, 'envoye', 3600); // Bloque pour 1 heure
  } catch (e) {
    Logger.log(`Échec de l'envoi de l'e-mail de notification : ${e.toString()}`);
  }
}

/**
 * Vérifie et corrige si besoin la structure des feuilles (onglets + en-têtes).
 * - Crée les onglets manquants et leurs en-têtes.
 * - Ajoute les en-têtes manquants si la première ligne existe déjà.
 * Retourne un rapport synthétique.
 */
function verifierStructureFeuilles() {
  const ss = SpreadsheetApp.openById(getSecret('ID_FEUILLE_CALCUL'));
  const expectations = [
    { name: 'Clients', headers: ['Email', 'Raison Sociale', 'Adresse', 'SIRET', COLONNE_TYPE_REMISE_CLIENT, COLONNE_VALEUR_REMISE_CLIENT, COLONNE_NB_TOURNEES_OFFERTES, COLONNE_RESIDENT_CLIENT, COLONNE_ID_CLIENT, COLONNE_CODE_POSTAL_CLIENT], required: true },
    { name: SHEET_CODES_POSTAUX_RETRAIT, headers: [COLONNE_CODE_POSTAL_CLIENT, 'Libellé'], required: true },
    { name: 'Facturation', headers: FACTURATION_HEADERS, required: true },
    { name: 'Plages_Bloquees', headers: ['Date', 'Heure_Debut', 'Heure_Fin'], required: false },
    { name: 'Logs', headers: ['Timestamp', 'Reservation ID', 'Client Email', 'Résumé', 'Montant', 'Statut'], required: false },
    { name: 'Admin_Logs', headers: ['Timestamp', 'Utilisateur', 'Action', 'Statut'], required: false }
  ];

  const report = [];
  expectations.forEach(exp => {
    let sh = ss.getSheetByName(exp.name);
    let created = false;
    if (!sh) {
      sh = ss.insertSheet(exp.name);
      created = true;
      sh.getRange(1, 1, 1, exp.headers.length).setValues([exp.headers]);
      Logger.log(`[Setup] Feuille "${exp.name}" créée avec en-têtes : ${exp.headers.join(', ')}`);
    } else {
      try {
        obtenirIndicesEnTetes(sh, exp.headers);
      } catch (e) {
        const width = Math.max(sh.getLastColumn(), exp.headers.length);
        const row1 = sh.getRange(1, 1, 1, width).getValues()[0].map(v => String(v).trim());
        const nonEmpty = row1.some(v => v.length > 0);
        if (!nonEmpty) {
          sh.getRange(1, 1, 1, exp.headers.length).setValues([exp.headers]);
          Logger.log(`[Setup] En-têtes définis pour la feuille "${exp.name}" : ${exp.headers.join(', ')}`);
        } else {
          const existing = new Set(row1);
          const missing = exp.headers.filter(h => !existing.has(h));
          if (missing.length > 0) {
            sh.getRange(1, row1.length + 1, 1, missing.length).setValues([missing]);
            Logger.log(`[Setup] Ajout des en-têtes manquants dans "${exp.name}" : ${missing.join(', ')}`);
          }
        }
      }
    }

    let missingNow = [];
    try {
      obtenirIndicesEnTetes(sh, exp.headers);
    } catch (err) {
      const row1 = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(v => String(v).trim());
      const existing = new Set(row1);
      missingNow = exp.headers.filter(h => !existing.has(h));
    }

    report.push({ sheet: exp.name, created: created, missingHeaders: missingNow });
  });

  try { logAdminAction('Vérification structure feuilles', 'Terminée'); } catch (e) {}
  return { success: true, report: report };
}

/**
 * Handler menu: lance la vérification et affiche un rapport synthétique.
 */
function menuVerifierStructureFeuilles() {
  try {
    const res = verifierStructureFeuilles();
    const lignes = res.report.map(r => `- ${r.sheet} : ${r.created ? 'créée' : 'ok'}${r.missingHeaders && r.missingHeaders.length ? ' | entêtes ajoutés: ' + r.missingHeaders.join(', ') : ''}`);
    const html = `<div style="font-family:Montserrat,sans-serif;line-height:1.5">
      <h2>Vérification structure des feuilles</h2>
      <p>Résultat: ${res.success ? 'Succès' : 'Erreur'}</p>
      <pre style="white-space:pre-wrap">${lignes.join('\n')}</pre>
    </div>`;
    const ui = SpreadsheetApp.getUi();
    ui.showModalDialog(HtmlService.createHtmlOutput(html).setWidth(520).setHeight(420), 'Vérification des feuilles');
  } catch (e) {
    const ui = SpreadsheetApp.getUi();
    ui.alert('Erreur', `La vérification a échoué: ${e.message}`, ui.ButtonSet.OK);
  }
}


// =================================================================
//                      2. SAUVEGARDE (CODE & DONNÉES)
// =================================================================

/**
 * Crée une sauvegarde manuelle de tous les fichiers de code du projet.
 */
function sauvegarderCodeProjet() {
  logAdminAction("Sauvegarde manuelle du code", "Démarré");
  const ui = SpreadsheetApp.getUi();
  try {
    const fichiers = recupererTousLesFichiersProjet();
    if (!fichiers) {
      throw new Error("Impossible de récupérer les fichiers du projet. L'API Google Apps Script est peut-être désactivée.");
    }
    
    const horodatage = formaterDatePersonnalise(new Date(), "yyyy-MM-dd'_'HH'h'mm");
    const nomDossierSauvegarde = `Sauvegarde Code ${horodatage}`;
    
    const dossierProjet = DriveApp.getFileById(getSecret('ID_FEUILLE_CALCUL')).getParents().next();
    const dossierParentSauvegardes = obtenirOuCreerDossier(dossierProjet, "Sauvegardes Code");
    const dossierSauvegarde = dossierParentSauvegardes.createFolder(nomDossierSauvegarde);
    
    fichiers.forEach(fichier => {
      const nomFichier = fichier.type === 'SERVER_JS' ? `${fichier.name}.gs` : `${fichier.name}.html`;
      dossierSauvegarde.createFile(nomFichier, fichier.source, MimeType.PLAIN_TEXT);
    });

    ui.alert('Sauvegarde Réussie', `Le projet a été sauvegardé dans le dossier :\n"${nomDossierSauvegarde}"`, ui.ButtonSet.OK);
    logAdminAction("Sauvegarde manuelle du code", "Succès");
  } catch (e) {
    Logger.log(`Erreur de sauvegarde manuelle : ${e.stack}`);
    ui.alert('Erreur de sauvegarde', `Une erreur est survenue : ${e.message}`, ui.ButtonSet.OK);
    logAdminAction("Sauvegarde manuelle du code", `Échec : ${e.message}`);
  }
}

/**
 * Crée une sauvegarde horodatée des feuilles de données critiques.
 */
function sauvegarderDonnees() {
  logAdminAction("Sauvegarde des données", "Démarré");
  try {
    const feuillesASauvegarder = [SHEET_CLIENTS, SHEET_FACTURATION, SHEET_CODES_POSTAUX_RETRAIT, SHEET_PLAGES_BLOQUEES, SHEET_LOGS, SHEET_ADMIN_LOGS];
    const ssOriginale = SpreadsheetApp.openById(getSecret('ID_FEUILLE_CALCUL'));
    
    const dossierProjet = DriveApp.getFileById(getSecret('ID_FEUILLE_CALCUL')).getParents().next();
    const dossierParentSauvegardes = obtenirOuCreerDossier(dossierProjet, "Sauvegardes Données");

    const horodatage = formaterDatePersonnalise(new Date(), "yyyy-MM-dd");
    const ssSauvegarde = SpreadsheetApp.create(`Sauvegarde Données - ${horodatage}`);
    DriveApp.getFileById(ssSauvegarde.getId()).moveTo(dossierParentSauvegardes);

    feuillesASauvegarder.forEach(nomFeuille => {
      const feuille = ssOriginale.getSheetByName(nomFeuille);
      if (feuille) {
        feuille.copyTo(ssSauvegarde).setName(nomFeuille);
      }
    });
    
    ssSauvegarde.deleteSheet(ssSauvegarde.getSheetByName(SHEET_DEFAULT));
    
    Logger.log(`Sauvegarde des données réussie. Fichier : ${ssSauvegarde.getUrl()}`);
    logAdminAction("Sauvegarde des données", `Succès : ${ssSauvegarde.getName()}`);

  } catch (e) {
    Logger.log(`Erreur lors de la sauvegarde des données : ${e.toString()}`);
    logAdminAction("Sauvegarde des données", `Échec : ${e.message}`);
    notifyAdminWithThrottle('ERREUR_SAUVEGARDE_DONNEES', `[${NOM_ENTREPRISE}] Erreur Sauvegarde Données`, `Erreur: ${e.message}`);
  }
}

/**
 * Helper: Récupère tous les fichiers du projet via l'API Apps Script.
 */
function recupererTousLesFichiersProjet() {
  const idScript = ScriptApp.getScriptId();
  const url = `https://script.google.com/feeds/download/export?id=${idScript}&format=json`;
  const options = {
    headers: { Authorization: `Bearer ${ScriptApp.getOAuthToken()}` },
    muteHttpExceptions: true
  };
  
  const reponse = UrlFetchApp.fetch(url, options);
  if (reponse.getResponseCode() === 200) {
    return JSON.parse(reponse.getContentText()).files;
  } else {
    Logger.log(`Échec de l'appel à l'API Apps Script (Code: ${reponse.getResponseCode()}).`);
    return null;
  }
}


// =================================================================
//                      3. PURGE (RGPD & NETTOYAGE)
// =================================================================

/**
 * Purge les anciennes données et les fichiers PDF associés.
 */
function purgerAnciennesDonnees() {
  logAdminAction("Purge RGPD (Données + Fichiers)", "Démarré");
  try {
    const ss = SpreadsheetApp.openById(getSecret('ID_FEUILLE_CALCUL'));
    
    // --- Purge de la feuille de facturation et des PDF ---
    const feuilleFacturation = ss.getSheetByName(SHEET_FACTURATION);
    if (feuilleFacturation) {
        const enTeteFact = feuilleFacturation.getRange(1, 1, 1, feuilleFacturation.getLastColumn()).getValues()[0];
        const dateColFact = enTeteFact.indexOf("Date");
        const idPdfCol = enTeteFact.indexOf("ID PDF");
        
        if (idPdfCol === -1 || dateColFact === -1) {
          throw new Error("Colonnes 'Date' et/ou 'ID PDF' requises dans 'Facturation' pour la purge.");
        }

        const dateLimiteFactures = new Date();
        dateLimiteFactures.setFullYear(dateLimiteFactures.getFullYear() - ANNEES_RETENTION_FACTURES);
        const { lignesSupprimees, idsFichiersSupprimes } = purgerDonneesFeuille(feuilleFacturation, dateColFact, idPdfCol, dateLimiteFactures);
        
        let fichiersSupprimes = 0;
        idsFichiersSupprimes.forEach(idFichier => {
          try {
            if (idFichier) {
              DriveApp.getFileById(idFichier).setTrashed(true);
              fichiersSupprimes++;
            }
          } catch (e) {
            Logger.log(`Impossible de supprimer le fichier PDF avec l'ID ${idFichier}. Erreur: ${e.message}`);
          }
        });
        Logger.log(`${lignesSupprimees} ligne(s) de facturation purgée(s) et ${fichiersSupprimes} PDF supprimé(s).`);
    }

    // --- Purge de la feuille de logs ---
    const feuilleLog = ss.getSheetByName(SHEET_LOGS);
    if (feuilleLog) {
        const enTeteLog = feuilleLog.getRange(1, 1, 1, feuilleLog.getLastColumn()).getValues()[0];
        const dateColLog = enTeteLog.indexOf("Timestamp");
        const dateLimiteLogs = new Date();
        dateLimiteLogs.setMonth(dateLimiteLogs.getMonth() - MOIS_RETENTION_LOGS);
        const { lignesSupprimees: logsSupprimes } = purgerDonneesFeuille(feuilleLog, dateColLog, -1, dateLimiteLogs);
        Logger.log(`${logsSupprimes} ligne(s) de log purgée(s).`);
    }
    
    logAdminAction("Purge RGPD", "Succès");

  } catch (e) {
    Logger.log(`Erreur durant la purge RGPD : ${e.toString()}`);
    logAdminAction("Purge RGPD", `Échec : ${e.message}`);
    notifyAdminWithThrottle('ERREUR_PURGE_RGPD', `[${NOM_ENTREPRISE}] Erreur Purge RGPD`, `Erreur: ${e.message}`);
  }
}

/**
 * Helper qui supprime les lignes d'une feuille selon une date limite et retourne les IDs des fichiers associés.
 */
function purgerDonneesFeuille(feuille, indexColonneDate, indexColonneIdFichier, dateLimite) {
  if (!feuille) return { lignesSupprimees: 0, idsFichiersSupprimes: [] };
  
  const donnees = feuille.getDataRange().getValues();
  let lignesSupprimees = 0;
  const idsFichiersSupprimes = [];
  
  for (let i = donnees.length - 1; i >= 1; i--) { // Itère de bas en haut
    const dateLigne = new Date(donnees[i][indexColonneDate]);
    if (dateLigne < dateLimite) {
      if (indexColonneIdFichier !== -1 && donnees[i][indexColonneIdFichier]) {
        idsFichiersSupprimes.push(donnees[i][indexColonneIdFichier]);
      }
      feuille.deleteRow(i + 1);
      lignesSupprimees++;
    }
  }
  return { lignesSupprimees, idsFichiersSupprimes };
}

/**
 * Nettoie l'onglet "Facturation" :
 * - Trim des champs texte, normalisation des booleens (Valider)
 * - Conversion du montant en nombre
 * - Suppression des lignes vides
 * - Suppression des doublons par ID Reservation (garde la plus recente)
 */
function nettoyerOngletFacturation() {
  const ui = SpreadsheetApp.getUi();
  try {
    const ss = SpreadsheetApp.openById(getSecret('ID_FEUILLE_CALCUL'));
    const feuille = ss.getSheetByName(SHEET_FACTURATION);
    if (!feuille) throw new Error("La feuille 'Facturation' est introuvable.");

    const header = feuille.getRange(1, 1, 1, feuille.getLastColumn()).getValues()[0].map(v => String(v || ''));
    // Normalise les entetes pour trouver les colonnes, sans accents et sans ponctuation
    const normalize = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9\s\(\)]/g, '').trim();
    const H = header.map(normalize);
    const Hcompact = H.map(h => h.replace(/[^a-z0-9]/g, ''));
    function findIndex(names){
      for (const n of names){
        const compact = n.replace(/[^a-z0-9]/g, '');
        let i = Hcompact.indexOf(compact);
        if (i !== -1) return i;
        // Essai via includes
        i = Hcompact.findIndex(x => x.includes(compact));
        if (i !== -1) return i;
      }
      return -1;
    }
    let idx = {
      date: findIndex(['date']),
      raison: findIndex(['clientraisonsclient','clientraisonsociale']),
      email: findIndex(['clientemail','emailclient','email']),
      type: findIndex(['type']),
      details: findIndex(['details','detail']),
      montant: findIndex(['montant','prix']),
      statut: findIndex(['statut','status']),
      valider: findIndex(['valider','avalider']),
      numero: findIndex(['nfacture','nofacture','nufacture']),
      eventId: findIndex(['eventid','evenementid']),
      idResa: findIndex(['idreservation','reservationid','idresa']),
      note: findIndex(['noteinterne','note']),
      lien: findIndex(['liennote','lien'])
    };
    let hasIdResa = idx.idResa !== -1;
    let colonnesManquantes = [];
    if (idx.date === -1) colonnesManquantes.push('Date');
    if (idx.email === -1) colonnesManquantes.push('Client (Email)');
    // Si ID reservation introuvable, tenter une detection heuristique
    if (idx.idResa === -1) {
      const cand = Hcompact.findIndex(x => x.includes('id') && x.includes('reserv'));
      if (cand !== -1) idx.idResa = cand;
    }
    // Si echec, on continue sans dedoublonnage (avertissements deja prepares)

    const data = feuille.getDataRange().getValues();
    // Heuristiques si certaines colonnes sont introuvables
    try {
      if (idx.date === -1) {
        let bestCol = -1, bestCount = 0;
        for (let c = 0; c < header.length; c++) {
          let count = 0;
          for (let r = 1; r < data.length; r++) {
            const v = data[r][c];
            if (v instanceof Date) { count++; continue; }
            if (typeof v === 'string') {
              const d = new Date(v);
              if (!isNaN(d.getTime())) count++;
            }
          }
          if (count > bestCount) { bestCount = count; bestCol = c; }
        }
        if (bestCol !== -1 && bestCount >= 3) idx.date = bestCol;
      }
      if (idx.email === -1) {
        let bestCol = -1, bestCount = 0;
        for (let c = 0; c < header.length; c++) {
          let count = 0;
          for (let r = 1; r < data.length; r++) {
            const v = String(data[r][c] || '');
            if (v.includes('@')) count++;
          }
          if (count > bestCount) { bestCount = count; bestCol = c; }
        }
        if (bestCol !== -1 && bestCount >= 3) idx.email = bestCol;
      }
      if (idx.idResa === -1) {
        let bestCol = -1, bestCount = 0;
        for (let c = 0; c < header.length; c++) {
          let count = 0;
          for (let r = 1; r < data.length; r++) {
            const v = String(data[r][c] || '');
            if (v.startsWith('RESA-')) count++;
          }
          if (count > bestCount) { bestCount = count; bestCol = c; }
        }
        if (bestCol !== -1 && bestCount >= 1) idx.idResa = bestCol;
      }
    } catch (_e) {}
    // Recalcule indicateurs et avertissements
    hasIdResa = idx.idResa !== -1;
    colonnesManquantes = [];
    if (idx.date === -1) colonnesManquantes.push('Date');
    if (idx.email === -1) colonnesManquantes.push('Client (Email)');
    // Plage: mois courant uniquement
    const now = new Date();
    const moisDebut = new Date(now.getFullYear(), now.getMonth(), 1);
    const moisFin = new Date(now.getFullYear(), now.getMonth() + 1, 1); // exclusif
    let supprVides = 0, supprDoublons = 0, normalises = 0;
    const vus = new Set();

    for (let r = data.length - 1; r >= 1; r--) {
      const row = data[r];
      const idResa = hasIdResa ? String(row[idx.idResa] || '').trim() : '';
      const email = String(row[idx.email] || '').trim();
      const dateVal = row[idx.date] instanceof Date ? row[idx.date] : new Date(row[idx.date]);
      const hasDate = dateVal instanceof Date && !isNaN(dateVal.getTime());
      const inRange = hasDate && dateVal >= moisDebut && dateVal < moisFin;

      // Limite: n'op�re que sur le mois courant. Les lignes hors plage sont ignor�es.
      if (!inRange) { continue; }

      // Lignes vides (dans la plage) => suppression
      if (!hasDate && !email && !idResa) { feuille.deleteRow(r + 1); supprVides++; continue; }

      if (hasIdResa && idResa) {
        if (vus.has(idResa)) { feuille.deleteRow(r + 1); supprDoublons++; continue; }
        vus.add(idResa);
      }

      // Normalisations legeres
      const toTrim = [idx.raison, idx.email, idx.type, idx.details, idx.statut, idx.numero, idx.eventId, idx.idResa, idx.note, idx.lien].filter(i => i !== -1);
      let changed = false;
      toTrim.forEach(i => { const v = row[i]; const t = (v === null || v === undefined) ? '' : String(v).trim(); if (String(v) !== t) { row[i] = t; changed = true; } });
      if (idx.montant !== -1) {
        const num = parseFloat(row[idx.montant]); if (!isNaN(num)) { row[idx.montant] = num; changed = true; }
      }
      if (idx.valider !== -1) {
        const val = row[idx.valider]; if (typeof val !== 'boolean') { row[idx.valider] = (val === true) || (String(val).toLowerCase() === 'true'); changed = true; }
      }
      if (changed) {
        feuille.getRange(r + 1, 1, 1, row.length).setValues([row]); normalises++;
      }
    }

    const moisLib = Utilities.formatDate(moisDebut, Session.getScriptTimeZone(), 'MMMM yyyy');
    const msg = 'Nettoyage (mois courant: ' + moisLib + ') termine. Lignes vides supprimees: ' + supprVides + ', doublons supprimes: ' + supprDoublons + ', lignes normalisees: ' + normalises + (colonnesManquantes.length ? ('\nAvertissement: colonnes introuvables: ' + colonnesManquantes.join(', ')) : '');
    ui.alert('Nettoyage Facturation', msg, ui.ButtonSet.OK);
    logAdminAction('Nettoyage Facturation', msg);
  } catch (e) {
    Logger.log('Erreur dans nettoyerOngletFacturation: ' + e.stack);
    SpreadsheetApp.getUi().alert('Erreur', e.message, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

/**
 * Répare les en-tetes critiques de l'onglet Facturation:
 * - Pose/normalise les entetes "Date", "Client (Email)" (et "ID Réservation" si détectable)
 * - Utilise des heuristiques si les entetes sont absents ou tronqués.
 */
function reparerEntetesFacturation() {
  const ui = SpreadsheetApp.getUi();
  try {
    const ss = SpreadsheetApp.openById(getSecret('ID_FEUILLE_CALCUL'));
    const sh = ss.getSheetByName(SHEET_FACTURATION);
    if (!sh) throw new Error("Feuille 'Facturation' introuvable.");
    const lastCol = Math.max(sh.getLastColumn(), FACTURATION_HEADERS.length);
    const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
    const data = sh.getDataRange().getValues();

    const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9\s()]/g,'').trim();
    const H = headers.map(norm);
    const Hc = H.map(h => h.replace(/[^a-z0-9]/g, ''));
    const findIdx = (cands) => {
      for (const cand of cands) {
        const key = cand.replace(/[^a-z0-9]/g, '');
        let i = Hc.indexOf(key);
        if (i !== -1) return i;
        i = Hc.findIndex(x => x.includes(key));
        if (i !== -1) return i;
      }
      return -1;
    };

    let idxDate = findIdx(['date']);
    let idxEmail = findIdx(['clientemail','emailclient','email']);
    let idxResa = findIdx(['idreservation','reservationid','idresa']);

    // Heuristique: colonne Date
    if (idxDate === -1) {
      let best = -1, score = 0;
      for (let c = 0; c < lastCol; c++) {
        let ok = 0;
        for (let r = 1; r < data.length; r++) {
          const v = data[r][c];
          if (v instanceof Date) { ok++; continue; }
          if (typeof v === 'string') { const d = new Date(v); if (!isNaN(d.getTime())) ok++; }
        }
        if (ok > score) { score = ok; best = c; }
      }
      if (best !== -1 && score >= 3) idxDate = best;
    }

    // Heuristique: colonne Email
    if (idxEmail === -1) {
      let best = -1, score = 0;
      for (let c = 0; c < lastCol; c++) {
        let ok = 0;
        for (let r = 1; r < data.length; r++) {
          const v = String(data[r][c] || '');
          if (v.includes('@')) ok++;
        }
        if (ok > score) { score = ok; best = c; }
      }
      if (best !== -1 && score >= 3) idxEmail = best;
    }

    // Heuristique: colonne ID Réservation
    if (idxResa === -1) {
      let best = -1, score = 0;
      for (let c = 0; c < lastCol; c++) {
        let ok = 0;
        for (let r = 1; r < data.length; r++) {
          const v = String(data[r][c] || '');
          if (v.startsWith('RESA-')) ok++;
        }
        if (ok > score) { score = ok; best = c; }
      }
      if (best !== -1 && score >= 1) idxResa = best;
    }

    const newHeaders = headers.slice();
    const fixes = [];
    const applyFix = (idx, header) => {
      if (idx !== -1 && !newHeaders.includes(header)) {
        newHeaders[idx] = header;
        fixes.push(`${header} -> Col ${idx + 1}`);
      }
    };
    applyFix(idxDate, FACTURATION_HEADERS[0]);
    applyFix(idxEmail, FACTURATION_HEADERS[2]);
    applyFix(idxResa, FACTURATION_HEADERS[10]);

    const missing = FACTURATION_HEADERS.filter(h => !newHeaders.includes(h));
    if (missing.length) {
      ui.alert('Colonnes manquantes: ' + missing.join(', ') + '. Corrigez manuellement.', ui.ButtonSet.OK);
      return;
    }
    const duplicates = FACTURATION_HEADERS.filter(h => newHeaders.filter(x => x === h).length > 1);
    if (duplicates.length) {
      ui.alert('Colonnes dupliquées: ' + duplicates.join(', ') + '. Corrigez manuellement.', ui.ButtonSet.OK);
      return;
    }

    if (fixes.length === 0) {
      ui.alert('Reparer entetes', 'Aucune colonne candidate trouvée. Vérifiez la première ligne de Facturation.', ui.ButtonSet.OK);
      return;
    }
    sh.getRange(1, 1, 1, newHeaders.length).setValues([newHeaders]);
    ui.alert('Reparer entetes', 'Entetes mis à jour:\n' + fixes.join('\n'), ui.ButtonSet.OK);
  } catch (e) {
    ui.alert('Erreur', e.message, ui.ButtonSet.OK);
  }
}

/**
 * Normalise les colonnes de l'onglet "Facturation" :
 * - Ajoute les en-têtes manquants
 * - Supprime les colonnes non listées
 * - Réordonne les colonnes selon la liste de référence
 */
function normaliserEntetesFacturation() {
  const ss = SpreadsheetApp.openById(getSecret('ID_FEUILLE_CALCUL'));
  const sh = ss.getSheetByName(SHEET_FACTURATION);
  if (!sh) throw new Error("Feuille 'Facturation' introuvable.");

  const headersRef = [
    'Date',
    'Client (Raison S. Client)',
    'Client (Email)',
    'Type',
    'Détails',
    'Montant',
    'Statut',
    'Valider',
    'N° Facture',
    'Event ID',
    'ID Réservation',
    'Note Interne',
    'Tournée Offerte Appliquée',
    'Type Remise Appliquée',
    'Valeur Remise Appliquée',
    'Lien Note'
  ];

  const data = sh.getDataRange().getValues();
  const currentHeaders = data[0].map(h => String(h).trim());
  const indexMap = {};
  currentHeaders.forEach((h, i) => { indexMap[h] = i; });

  const rebuilt = data.map(row => headersRef.map(h =>
    Object.prototype.hasOwnProperty.call(indexMap, h) ? row[indexMap[h]] : ''
  ));

  const lastCol = sh.getLastColumn();
  sh.clearContents();
  sh.getRange(1, 1, rebuilt.length, headersRef.length).setValues(rebuilt);
  if (lastCol > headersRef.length) {
    sh.deleteColumns(headersRef.length + 1, lastCol - headersRef.length);
  }
}

// =================================================================
//                      4. AUDIT & VÉRIFICATION
// =================================================================

/**
 * Handler menu: resynchronise un événement après saisie de l'ID Réservation.
 */
function menuResynchroniserEvenement() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt('Resynchroniser événement', "ID Réservation à resynchroniser :", ui.ButtonSet.OK_CANCEL);
  if (response.getSelectedButton() !== ui.Button.OK) return;
  const idReservation = response.getResponseText().trim();
  if (!idReservation) return;
  try {
    resynchroniserEvenement(idReservation);
    ui.alert('Resynchronisation effectuée', `ID ${idReservation}`, ui.ButtonSet.OK);
  } catch (e) {
    ui.alert('Erreur', e.message, ui.ButtonSet.OK);
  }
}

/**
 * Handler menu: purge l'Event ID introuvable après saisie de l'ID Réservation.
 */
function menuPurgerEventId() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt('Purger Event ID', "ID Réservation à purger :", ui.ButtonSet.OK_CANCEL);
  if (response.getSelectedButton() !== ui.Button.OK) return;
  const idReservation = response.getResponseText().trim();
  if (!idReservation) return;
  try {
    purgerEventIdInexistant(idReservation);
    ui.alert('Purge effectuée', `ID ${idReservation}`, ui.ButtonSet.OK);
  } catch (e) {
    ui.alert('Erreur', e.message, ui.ButtonSet.OK);
  }
}

/**
 * Resynchronise l'événement Calendar d'une réservation à partir des données de facturation.
 * @param {string} idReservation L'identifiant de la réservation à resynchroniser.
 */
function resynchroniserEvenement(idReservation) {
  if (!CALENDAR_RESYNC_ENABLED) {
    throw new Error('Resynchronisation désactivée.');
  }
  try {
    const ss = SpreadsheetApp.openById(getSecret('ID_FEUILLE_CALCUL'));
    const feuille = ss.getSheetByName(SHEET_FACTURATION);
    if (!feuille) throw new Error("La feuille 'Facturation' est introuvable.");

    const enTetes = [
      'ID Réservation', 'Event ID', 'Date', 'Client (Raison S. Client)',
      'Client (Email)', 'Détails', 'Note Interne', 'Montant'
    ];
    const indices = obtenirIndicesEnTetes(feuille, enTetes);
    const donnees = feuille.getDataRange().getValues();
    const index = donnees.findIndex(r => String(r[indices['ID Réservation']]).trim() === String(idReservation).trim());
    if (index === -1) throw new Error(`ID Réservation ${idReservation} introuvable.`);

    const ligne = donnees[index];
    const dateHeure = new Date(ligne[indices['Date']]);
    const details = String(ligne[indices['Détails']] || '');
    const nomClient = ligne[indices['Client (Raison S. Client)']];
    const emailClient = ligne[indices['Client (Email)']];
    const note = ligne[indices['Note Interne']];

    const matchTotal = details.match(/(\d+)\s+arrêt\(s\)\s*total\(s\)/i);
    const matchSup = matchTotal ? null : details.match(/(\d+)\s+arrêt\(s\)\s*sup/i);
    const totalStops = matchTotal
      ? parseInt(matchTotal[1], 10)
      : matchSup
        ? parseInt(matchSup[1], 10) + 1
        : 1;
    const matchRetour = details.match(/retour:\s*(oui|non)/i);
    const returnToPharmacy = matchRetour ? matchRetour[1].toLowerCase() === 'oui' : false;

    const dateString = Utilities.formatDate(dateHeure, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    const startTime = Utilities.formatDate(dateHeure, Session.getScriptTimeZone(), "HH'h'mm");

    const item = { date: dateString, startTime: startTime, totalStops: totalStops, returnToPharmacy: returnToPharmacy };
    const client = { nom: nomClient, email: emailClient, note: note };
    const clientPourCalcul = obtenirInfosClientParEmail(emailClient);

    const resultat = creerReservationUnique(item, client, clientPourCalcul, { overrideIdReservation: idReservation, skipFacturation: true });
    if (!resultat || !resultat.eventId) throw new Error('Échec de création de l\'événement.');

    feuille.getRange(index + 1, indices['Event ID'] + 1).setValue(resultat.eventId);
    logActivity(idReservation, emailClient, 'Resynchronisation calendrier', ligne[indices['Montant']], 'Resync');
    return { success: true };
  } catch (e) {
    Logger.log(`Erreur resynchroniserEvenement: ${e.stack}`);
    return { success: false, message: e.message };
  }
}

/**
 * Vérifie l'existence de l'événement lié à une réservation et purge si introuvable.
 * @param {string} idReservation L'identifiant de la réservation.
 * @returns {boolean} true si purge effectuée, false sinon.
 */
function purgerEventIdInexistant(idReservation) {
  if (!CALENDAR_PURGE_ENABLED) {
    throw new Error('Purge désactivée.');
  }
  try {
    const ss = SpreadsheetApp.openById(getSecret('ID_FEUILLE_CALCUL'));
    const feuille = ss.getSheetByName(SHEET_FACTURATION);
    if (!feuille) throw new Error("La feuille 'Facturation' est introuvable.");

    const enTetes = ['ID Réservation', 'Event ID', 'Note Interne'];
    const indices = obtenirIndicesEnTetes(feuille, enTetes);
    const donnees = feuille.getDataRange().getValues();
    const index = donnees.findIndex(r => String(r[indices['ID Réservation']]).trim() === String(idReservation).trim());
    if (index === -1) throw new Error(`ID Réservation ${idReservation} introuvable.`);

    const ligne = donnees[index];
    const eventId = ligne[indices['Event ID']];
    if (!eventId) {
      logAdminAction('Purge Event ID', `Annulé: ${idReservation} vide`);
      return false;
    }

    try {
      Calendar.Events.get(getSecret('ID_CALENDRIER'), eventId);
      logAdminAction('Purge Event ID', `Annulé: événement existe (${idReservation})`);
      return false;
    } catch (e) {
      if (!e.message.includes('Not Found')) throw e;
    }

    const row = index + 1;
    feuille.getRange(row, indices['Event ID'] + 1).clearContent();
    const noteCell = feuille.getRange(row, indices['Note Interne'] + 1);
    const noteVal = String(noteCell.getValue());
    const marker = 'À vérifier';
    noteCell.setValue(noteVal && noteVal.indexOf(marker) === -1 ? `${noteVal} | ${marker}` : marker);

    logAdminAction('Purge Event ID', `ID ${idReservation}`);
    return true;
  } catch (e) {
    Logger.log(`Erreur purgerEventIdInexistant: ${e.stack}`);
    logAdminAction('Purge Event ID', `Échec: ${e.message}`);
    return false;
  }
}

/**
 * Vérifie la cohérence entre les réservations dans le Google Sheet et les événements dans le Google Calendar.
 * Affiche un rapport des incohérences trouvées.
 */
function verifierCoherenceCalendrier() {
  const ui = SpreadsheetApp.getUi();
  ui.alert("Démarrage de l'audit", "La vérification de la cohérence avec le calendrier va commencer. Cela peut prendre quelques instants...", ui.ButtonSet.OK);
  logAdminAction("Vérification Cohérence Calendrier", "Démarré");

  try {
    const ss = SpreadsheetApp.openById(getSecret('ID_FEUILLE_CALCUL'));
    const feuille = ss.getSheetByName(SHEET_FACTURATION);
    if (!feuille) throw new Error("La feuille 'Facturation' est introuvable.");

    const enTetesRequis = ["ID Réservation", "Event ID", "Date"];
    const indices = obtenirIndicesEnTetes(feuille, enTetesRequis);
    const donnees = feuille.getDataRange().getValues();

    let incoherences = [];
    let reservationsVerifiees = 0;
    let idsIntrouvables = [];

    for (let i = 1; i < donnees.length; i++) {
      const ligne = donnees[i];
      const idReservation = ligne[indices["ID Réservation"]];
      const eventId = ligne[indices["Event ID"]];
      const dateSheet = new Date(ligne[indices["Date"]]);
      reservationsVerifiees++;

      if (!eventId) {
        incoherences.push(`- Ligne ${i + 1} (ID: ${idReservation}): Aucun 'Event ID' n'est enregistré.`);
        continue;
      }

      try {
        const evenement = Calendar.Events.get(getSecret('ID_CALENDRIER'), eventId);
        const dateCalendrier = new Date(evenement.start.dateTime || evenement.start.date);
        
        if (dateSheet.getFullYear() !== dateCalendrier.getFullYear() ||
            dateSheet.getMonth() !== dateCalendrier.getMonth() ||
            dateSheet.getDate() !== dateCalendrier.getDate()) {
          incoherences.push(`- Ligne ${i + 1} (ID: ${idReservation}): Incohérence de date. Sheet: ${formaterDateEnYYYYMMDD(dateSheet)}, Calendrier: ${formaterDateEnYYYYMMDD(dateCalendrier)}.`);
        }
      } catch (e) {
        if (e.message.includes("Not Found")) {
          incoherences.push(`- Ligne ${i + 1} (ID: ${idReservation}): L'événement (ID: ${eventId}) est INTROUVABLE dans le calendrier.`);
          idsIntrouvables.push({ idReservation: idReservation });
        } else {
          incoherences.push(`- Ligne ${i + 1} (ID: ${idReservation}): Erreur API pour l'événement ${eventId}: ${e.message}`);
        }
      }
    }
    
    const escapeHtml = function (value) {
      return String(value || '').replace(/[&<>"']/g, function (c) {
        switch (c) {
          case '&': return '&amp;';
          case '<': return '&lt;';
          case '>': return '&gt;';
          case '"': return '&quot;';
          case '\'': return '&#39;';
          default: return c;
        }
      });
    };

    // Génération et affichage du rapport final
    let rapportHtml = `<h1>Rapport de cohérence Calendrier</h1>`;
    rapportHtml += `<p><strong>${reservationsVerifiees}</strong> réservations ont été analysées.</p>`;

    if (incoherences.length === 0) {
      rapportHtml += `<p style="color: #2b76c6;"><strong>Aucune incohérence trouvée.</strong> Tout est synchronisé !</p>`;
    } else {
      rapportHtml += `<p style="color: red;"><strong>${incoherences.length} incohérence(s) détectée(s) :</strong></p>`;
      const incoherencesSecurisees = incoherences.map(escapeHtml).join('<br>');
      rapportHtml += `<pre>${incoherencesSecurisees}</pre>`;
    }
    
    if (idsIntrouvables.length > 0 && (CALENDAR_RESYNC_ENABLED || CALENDAR_PURGE_ENABLED)) {
      rapportHtml += `<h3>Réservations manquantes</h3><ul>`;
      idsIntrouvables.forEach(r => {
        rapportHtml += `<li>`;
        if (CALENDAR_PURGE_ENABLED) {
          rapportHtml += `<input type="checkbox" class="purgeBox" value="${escapeHtml(r.idReservation)}"> `;
        }
        rapportHtml += `${escapeHtml(r.idReservation)}`;
        if (CALENDAR_RESYNC_ENABLED) {
          rapportHtml += ` <button class="btn-resync" data-id="${escapeHtml(r.idReservation)}">Resync</button>`;
        }
        rapportHtml += `</li>`;
      });
      rapportHtml += `</ul>`;
      if (CALENDAR_PURGE_ENABLED) {
        rapportHtml += `<button id="purgerSelection">Purger sélection</button>`;
      }
      rapportHtml += `<script>`;
      rapportHtml += `window.Maintenance=window.Maintenance||{};`;
      if (CALENDAR_RESYNC_ENABLED) {
        rapportHtml += `window.Maintenance.resync=function(id,btn){btn.disabled=true;google.script.run.withSuccessHandler(function(){btn.textContent='OK';btn.disabled=false;}).resynchroniserEvenement(id);};`;
        rapportHtml += `document.querySelectorAll('.btn-resync').forEach(btn=>{btn.addEventListener('click',function(){window.Maintenance.resync(this.dataset.id,this);});});`;
      }
      if (CALENDAR_PURGE_ENABLED) {
        rapportHtml += `window.Maintenance.purgerSelection=function(btn){btn.disabled=true;const ids=[...document.querySelectorAll('.purgeBox:checked')].map(cb=>cb.value);if(ids.length===0){btn.disabled=false;return;} (function next(){if(ids.length===0){btn.disabled=false;return;}const id=ids.shift();google.script.run.withSuccessHandler(next).purgerEventIdInexistant(id);})();};`;
        rapportHtml += `const purgeBtn=document.getElementById('purgerSelection');if(purgeBtn){purgeBtn.addEventListener('click',function(){window.Maintenance.purgerSelection(this);});}`;
      }
      rapportHtml += `</script>`;
    }

    const output = HtmlService.createHtmlOutput(rapportHtml).setWidth(600).setHeight(400);
    ui.showModalDialog(output, "Rapport de cohérence");
    logAdminAction("Vérification Cohérence Calendrier", `Terminée. ${incoherences.length} incohérence(s).`);

  } catch (e) {
    Logger.log(`Erreur fatale durant la vérification de cohérence : ${e.stack}`);
    logAdminAction("Vérification Cohérence Calendrier", `Échec critique : ${e.message}`);
    ui.alert("Erreur Critique", `L'audit a échoué : ${e.message}`, ui.ButtonSet.OK);
  }
}

/**
 * Audit basique des partages Drive (stub).
 * Affiche un message indiquant que la fonctionnalité n'est pas encore disponible.
 */
function lancerAuditDrive() {
  const ui = SpreadsheetApp.getUi();
  ui.alert('Audit Drive', 'Fonctionnalité non implémentée.', ui.ButtonSet.OK);
}

// =================================================================
//                      6. DÉDUPLICATION
// =================================================================

/**
 * Détecte les doublons d'ID Réservation dans la feuille dédiée.
 * @param {boolean} remove Supprime les doublons détectés si true.
 * @returns {string[]} Liste des ID en doublon.
 */
function deduplicateReservations(remove = false) {
  try {
    const ss = SpreadsheetApp.openById(getSecret('ID_FEUILLE_CALCUL'));
    const sheet = ss.getSheetByName(SHEET_RESERVATIONS);
    if (!sheet) {
      throw new Error(`Feuille '${SHEET_RESERVATIONS}' introuvable.`);
    }
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) {
      return [];
    }
    const headers = data[0].map(h => String(h).trim());
    const idx = headers.indexOf('ID Réservation');
    if (idx === -1) {
      throw new Error("Colonne 'ID Réservation' manquante.");
    }
    const seen = new Map();
    const duplicates = [];
    const rowsToDelete = [];
    for (let i = 1; i < data.length; i++) {
      const id = String(data[i][idx]).trim();
      if (!id) {
        continue;
      }
      if (seen.has(id)) {
        duplicates.push(id);
        rowsToDelete.push(i + 1);
      } else {
        seen.set(id, i + 1);
      }
    }
    if (remove && rowsToDelete.length > 0) {
      rowsToDelete.sort((a, b) => b - a).forEach(r => sheet.deleteRow(r));
    }
    return duplicates;
  } catch (e) {
    Logger.log(`Erreur lors de la déduplication : ${e.stack}`);
    return [];
  }
}
