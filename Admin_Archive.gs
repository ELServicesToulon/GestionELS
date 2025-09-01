/**
 * Archive les factures du mois précédent en déplaçant les fichiers PDF
 * vers le dossier d'archives (ID_DOSSIER_ARCHIVES)/Année/"MMMM yyyy" et
 * met à jour le statut de la ligne.
 */
function archiverFacturesDuMois() {
  const ui = SpreadsheetApp.getUi();
  try {
    const maintenant = new Date();
    const debutMoisCourant = new Date(maintenant.getFullYear(), maintenant.getMonth(), 1);
    const debutMoisPrecedent = new Date(maintenant.getFullYear(), maintenant.getMonth() - 1, 1);
    const finMoisPrecedent = new Date(debutMoisCourant.getTime() - 24 * 60 * 60 * 1000);

    const ss = SpreadsheetApp.openById(ID_FEUILLE_CALCUL);
    const feuille = ss.getSheetByName('Facturation');
    if (!feuille) throw new Error("La feuille 'Facturation' est introuvable.");

    const header = feuille.getRange(1, 1, 1, feuille.getLastColumn()).getValues()[0].map(v => String(v).trim());
    const idx = {
      date: header.indexOf('Date'),
      numero: header.indexOf('N° Facture'),
      idPdf: header.indexOf('ID PDF'),
      statut: header.indexOf('Statut')
    };
    if (idx.date === -1 || idx.numero === -1 || idx.idPdf === -1) {
      throw new Error("Colonnes requises manquantes (Date, N° Facture, ID PDF).");
    }

    const donnees = feuille.getDataRange().getValues();
    const dossierArchives = DriveApp.getFolderById(ID_DOSSIER_ARCHIVES);
    const dossierAnnee = obtenirOuCreerDossier(dossierArchives, debutMoisPrecedent.getFullYear().toString());
    const libMois = formaterDatePersonnalise(debutMoisPrecedent, "MMMM yyyy");
    const dossierMois = obtenirOuCreerDossier(dossierAnnee, libMois);

    let deplaces = 0, ignores = 0, erreurs = 0;
    for (let r = 1; r < donnees.length; r++) {
      const ligne = donnees[r];
      const valDate = ligne[idx.date];
      const numero = String(ligne[idx.numero] || '').trim();
      const idPdf = String(ligne[idx.idPdf] || '').trim();
      if (!(valDate instanceof Date)) continue;
      if (!numero || !idPdf) continue;
      if (valDate < debutMoisPrecedent || valDate > finMoisPrecedent) { ignores++; continue; }
      try {
        const fichier = DriveApp.getFileById(idPdf);
        // Si déjà dans le bon dossier, ignorer le déplacement
        let dejaBonDossier = false;
        const parents = fichier.getParents();
        while (parents.hasNext()) {
          const p = parents.next();
          if (p.getId() === dossierMois.getId()) { dejaBonDossier = true; break; }
        }
        if (!dejaBonDossier) {
          fichier.moveTo(dossierMois);
        }
        if (idx.statut !== -1) feuille.getRange(r + 1, idx.statut + 1).setValue('Archivée');
        deplaces++;
      } catch (e) {
        Logger.log('Erreur archivage facture ' + numero + ' : ' + e.message);
        erreurs++;
      }
    }

    const msg = `Archivage (${libMois}) terminé. Déplacés: ${deplaces}, ignorés: ${ignores}, erreurs: ${erreurs}.`;
    try { logAdminAction('Archivage factures mois précédent', msg); } catch (e) {}
    ui.alert('Archivage des factures', msg, ui.ButtonSet.OK);
  } catch (e) {
    Logger.log('Erreur critique dans archiverFacturesDuMois: ' + e.stack);
    ui.alert('Erreur', e.message, ui.ButtonSet.OK);
  }
}

