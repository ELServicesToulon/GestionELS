// =================================================================
//                      LOGIQUE D'ADMINISTRATION
// =================================================================
// Description: Fonctions pour le panneau d'administration et les
//              menus (facturation, gestion des clients et courses).
// =================================================================

/**
 * Invalide la configuration mise en cache.
 * À utiliser après toute modification manuelle des paramètres.
 */
function invaliderCacheConfiguration() {
  CacheService.getScriptCache().remove('CONFIG_JSON');
}

/**
 * Calcule le chiffre d'affaires du mois en cours.
 * @return {number|null} Total du CA ou null si désactivé ou non autorisé.
 */
function calculerCAEnCours() {
  if (!CA_EN_COURS_ENABLED) return null;

  const userEmail = Session.getActiveUser().getEmail();
  if (!userEmail || userEmail.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    return null;
  }

  const feuille = SpreadsheetApp.openById(getSecret('ID_FEUILLE_CALCUL')).getSheetByName(SHEET_FACTURATION);
  if (!feuille) return null;

  const indices = obtenirIndicesEnTetes(feuille, ["Date", "Montant"]);
  const donnees = feuille.getDataRange().getValues();
  const aujourdHui = new Date();
  const moisActuel = aujourdHui.getMonth();
  const anneeActuelle = aujourdHui.getFullYear();
  let total = 0;

  for (let i = 1; i < donnees.length; i++) {
    const ligne = donnees[i];
    const dateCell = new Date(ligne[indices["Date"]]);
    if (!isNaN(dateCell) && dateCell.getMonth() === moisActuel && dateCell.getFullYear() === anneeActuelle) {
      total += parseFloat(ligne[indices["Montant"]]) || 0;
    }
  }

  return total;
}

/**
 * Génère un lien signé pour l'espace client (réservé à l'admin).
 * @param {string} emailClient
 * @param {number} [heuresValidite=168] Durée de validité en heures (défaut 7 jours).
 * @returns {{url:string, exp:number}} Lien et timestamp d'expiration (secondes epoch).
 */
function genererLienEspaceClient(emailClient, heuresValidite) {
  const userEmail = Session.getActiveUser().getEmail();
  if (!userEmail || userEmail.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    throw new Error('Accès non autorisé.');
  }
  if (!CLIENT_PORTAL_SIGNED_LINKS) {
    throw new Error('CLIENT_PORTAL_SIGNED_LINKS est désactivé.');
  }
  const ttl = (Number(heuresValidite) > 0 ? Number(heuresValidite) : 168) * 3600;
  return generateSignedClientLink(emailClient, ttl);
}

/**
 * Récupère TOUTES les réservations (passées, actuelles, futures) sans aucun filtre par date/email.
 * @returns {Object} Un objet avec le statut et la liste complète des réservations.
 */
function obtenirToutesReservationsAdmin() {
  try {
    const userEmail = Session.getActiveUser().getEmail();
    if (!userEmail || userEmail.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      return { success: false, error: "Accès non autorisé." };
    }

    const feuille = SpreadsheetApp.openById(getSecret('ID_FEUILLE_CALCUL')).getSheetByName(SHEET_FACTURATION);
    if (!feuille) throw new Error("La feuille 'Facturation' est introuvable.");

    const enTetesRequis = ["Date", "Client (Email)", "Event ID", "Détails", "Client (Raison S. Client)", "ID Réservation", "Montant", "Type Remise Appliquée", "Valeur Remise Appliquée", "Tournée Offerte Appliquée", "Statut"];
    const indices = obtenirIndicesEnTetes(feuille, enTetesRequis);

    const donnees = feuille.getDataRange().getValues();

    const reservations = donnees.slice(1).map(ligne => {
      try {
        // CORRECTION PRINCIPALE : On crée un objet Date complet dès le début
        const dateHeureSheet = new Date(ligne[indices["Date"]]);
        if (isNaN(dateHeureSheet.getTime())) return null; // Ignore les lignes avec une date invalide

        let dateDebutEvenement = dateHeureSheet; // On utilise la date complète du Sheet par défaut
        let dateFinEvenement;
        
        const eventId = String(ligne[indices["Event ID"]]).trim();
        if (eventId) {
          try {
            const evenementRessource = Calendar.Events.get(getSecret('ID_CALENDRIER'), eventId);
            // On met à jour avec les infos du calendrier si elles existent, car elles sont plus précises
            dateDebutEvenement = new Date(evenementRessource.start.dateTime || evenementRessource.start.date);
            dateFinEvenement = new Date(evenementRessource.end.dateTime || evenementRessource.end.date);
          } catch (err) {
            Logger.log(`Avertissement: Événement Calendar ${eventId} introuvable pour la résa ${ligne[indices["ID Réservation"]]}. Utilisation de l'heure du Sheet.`);
          }
        }

        const details = String(ligne[indices["Détails"]]);
        const matchTotal = details.match(/(\d+)\s*arrêt\(s\)\s*total\(s\)/);
        const matchSup = matchTotal ? null : details.match(/(\d+)\s*arrêt\(s\)\s*sup/);
        const arrets = matchTotal
          ? Math.max(0, parseInt(matchTotal[1], 10) - 1)
          : matchSup
            ? parseInt(matchSup[1], 10)
            : 0;
        const retour = details.includes('retour: oui');

        if (!dateFinEvenement) {
          const dureeEstimee = DUREE_BASE + ((arrets + (retour ? 1 : 0)) * DUREE_ARRET_SUP);
          dateFinEvenement = new Date(dateDebutEvenement.getTime() + dureeEstimee * 60000);
        }

        const km = KM_BASE + ((arrets + (retour ? 1 : 0)) * KM_ARRET_SUP);
        
        let infoRemise = '';
        const typeRemiseAppliquee = String(ligne[indices["Type Remise Appliquée"]]).trim();
        const valeurRemiseAppliquee = parseFloat(ligne[indices["Valeur Remise Appliquée"]]) || 0;
        const tourneeOfferteAppliquee = ligne[indices["Tournée Offerte Appliquée"]] === true;

        if (tourneeOfferteAppliquee) {
          infoRemise = '(Offerte)';
        } else if (typeRemiseAppliquee === 'Pourcentage' && valeurRemiseAppliquee > 0) {
          infoRemise = `(-${valeurRemiseAppliquee}%)`;
        } else if (typeRemiseAppliquee === 'Montant Fixe' && valeurRemiseAppliquee > 0) {
          infoRemise = `(-${valeurRemiseAppliquee}€)`;
        }

        return {
          id: ligne[indices["ID Réservation"]],
          eventId: eventId,
          start: dateDebutEvenement.toISOString(),
          end: dateFinEvenement.toISOString(),
          details: details,
          clientName: ligne[indices["Client (Raison S. Client)"]],
          clientEmail: ligne[indices["Client (Email)"]],
          amount: parseFloat(ligne[indices["Montant"]]) || 0,
          km: km,
          statut: ligne[indices["Statut"]],
          infoRemise: infoRemise
        };
      } catch(e) { 
        Logger.log(`Erreur de traitement d'une ligne de réservation admin : ${e.toString()} sur la ligne avec ID ${ligne[indices["ID Réservation"]]}`);
        return null; 
      }
    }).filter(Boolean);

    reservations.sort((a, b) => new Date(b.start) - new Date(a.start));
    
    return { success: true, reservations: reservations };
  } catch (e) {
    Logger.log(`Erreur critique dans obtenirToutesReservationsAdmin: ${e.stack}`);
    return { success: false, error: e.message };
  }
}

/**
 * Récupère TOUTES les réservations pour une date donnée (pour l'Admin).
 * @param {string} dateFiltreString La date à rechercher au format "YYYY-MM-DD".
 * @returns {Object} Un objet avec le statut et la liste des réservations.
 */
function obtenirToutesReservationsPourDate(dateFiltreString) {
  try {
    const userEmail = Session.getActiveUser().getEmail();
    if (!userEmail || userEmail.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      return { success: false, error: "Accès non autorisé." };
    }

    const feuille = SpreadsheetApp.openById(getSecret('ID_FEUILLE_CALCUL')).getSheetByName(SHEET_FACTURATION);
    if (!feuille) throw new Error("La feuille 'Facturation' est introuvable.");

    const enTetesRequis = ["Date", "Client (Email)", "Event ID", "Détails", "Client (Raison S. Client)", "ID Réservation", "Montant", "Type Remise Appliquée", "Valeur Remise Appliquée", "Tournée Offerte Appliquée", "Statut"];
    const indices = obtenirIndicesEnTetes(feuille, enTetesRequis);

    const donnees = feuille.getDataRange().getValues();
    
    const reservations = donnees.slice(1).map(ligne => {
      // CORRECTION PRINCIPALE : On crée un objet Date complet dès le début
      const dateCell = ligne[indices["Date"]];
      if (!dateCell) return null;
      const dateHeureSheet = new Date(dateCell);
      if (isNaN(dateHeureSheet.getTime())) return null;

      // On compare uniquement la partie "jour"
      const dateLigneFormattee = Utilities.formatDate(dateHeureSheet, Session.getScriptTimeZone(), "yyyy-MM-dd");
      
      if (dateLigneFormattee !== dateFiltreString) {
        return null;
      }

      try {
        let dateDebutEvenement = dateHeureSheet; // On utilise la date complète du Sheet par défaut
        let dateFinEvenement;
        
        const eventId = String(ligne[indices["Event ID"]]).trim();
        if (eventId) {
          try {
            const evenementRessource = Calendar.Events.get(getSecret('ID_CALENDRIER'), eventId);
            dateDebutEvenement = new Date(evenementRessource.start.dateTime || evenementRessource.start.date);
            dateFinEvenement = new Date(evenementRessource.end.dateTime || evenementRessource.end.date);
          } catch (err) {
            Logger.log(`Avertissement: Événement Calendar ${eventId} introuvable pour la résa ${ligne[indices["ID Réservation"]]}.`);
          }
        }
        
        const details = String(ligne[indices["Détails"]]);
        const matchTotal = details.match(/(\d+)\s*arrêt\(s\)\s*total\(s\)/);
        const matchSup = matchTotal ? null : details.match(/(\d+)\s*arrêt\(s\)\s*sup/);
        const arrets = matchTotal
          ? Math.max(0, parseInt(matchTotal[1], 10) - 1)
          : matchSup
            ? parseInt(matchSup[1], 10)
            : 0;
        const retour = details.includes('retour: oui');
        
        if (!dateFinEvenement) {
            const dureeEstimee = DUREE_BASE + ((arrets + (retour ? 1 : 0)) * DUREE_ARRET_SUP);
            dateFinEvenement = new Date(dateDebutEvenement.getTime() + dureeEstimee * 60000);
        }

        const km = KM_BASE + ((arrets + (retour ? 1 : 0)) * KM_ARRET_SUP);
        
        let infoRemise = '';
        const typeRemiseAppliquee = String(ligne[indices["Type Remise Appliquée"]]).trim();
        const valeurRemiseAppliquee = parseFloat(ligne[indices["Valeur Remise Appliquée"]]) || 0;
        const tourneeOfferteAppliquee = ligne[indices["Tournée Offerte Appliquée"]] === true;

        if (tourneeOfferteAppliquee) {
            infoRemise = '(Offerte)';
        } else if (typeRemiseAppliquee === 'Pourcentage' && valeurRemiseAppliquee > 0) {
            infoRemise = `(-${valeurRemiseAppliquee}%)`;
        } else if (typeRemiseAppliquee === 'Montant Fixe' && valeurRemiseAppliquee > 0) {
            infoRemise = `(-${valeurRemiseAppliquee}€)`;
        }

        return {
          id: ligne[indices["ID Réservation"]],
          eventId: eventId,
          start: dateDebutEvenement.toISOString(),
          end: dateFinEvenement.toISOString(),
          details: details,
          clientName: ligne[indices["Client (Raison S. Client)"]],
          clientEmail: ligne[indices["Client (Email)"]],
          amount: parseFloat(ligne[indices["Montant"]]) || 0,
          km: km,
          statut: ligne[indices["Statut"]],
          infoRemise: infoRemise
        };
      } catch(e) { 
        Logger.log(`Erreur de traitement d'une ligne de réservation admin : ${e.toString()}`);
        return null; 
      }
    }).filter(Boolean);

    reservations.sort((a, b) => new Date(a.start) - new Date(b.start));
    return { success: true, reservations: reservations };

  } catch (e) {
    Logger.log(`Erreur critique dans obtenirToutesReservationsPourDate: ${e.stack}`);
    return { success: false, error: e.message };
  }
}

// --- Le reste de vos fonctions (obtenirTousLesClients, creerReservationAdmin, etc.) reste ici ---
// --- Il est essentiel de conserver le reste du fichier tel quel. ---

/**
 * Récupère la liste complète des clients pour le formulaire d'ajout.
 * @returns {Array<Object>} La liste des clients.
 */
function obtenirTousLesClients() {
    try {
        const feuilleClients = SpreadsheetApp.openById(getSecret('ID_FEUILLE_CALCUL')).getSheetByName(SHEET_CLIENTS);
        if (!feuilleClients) return [];

        const headerRow = feuilleClients.getRange(1, 1, 1, Math.max(1, feuilleClients.getLastColumn())).getValues()[0];
        const headerTrimmed = headerRow.map(function (h) { return String(h || '').trim(); });
        if (headerTrimmed.indexOf(COLONNE_RESIDENT_CLIENT) === -1) {
            feuilleClients.getRange(1, headerTrimmed.length + 1).setValue(COLONNE_RESIDENT_CLIENT);
        }

        const indices = obtenirIndicesEnTetes(feuilleClients, ["Email", "Raison Sociale", "Adresse", "SIRET", COLONNE_TYPE_REMISE_CLIENT, COLONNE_VALEUR_REMISE_CLIENT, COLONNE_NB_TOURNEES_OFFERTES, COLONNE_RESIDENT_CLIENT]);
        const donnees = feuilleClients.getDataRange().getValues();
        return donnees.slice(1).map(ligne => ({
            email: ligne[indices["Email"]],
            nom: ligne[indices["Raison Sociale"]] || '',
            adresse: ligne[indices["Adresse"]] || '',
            siret: ligne[indices["SIRET"]] || '',
            typeRemise: ligne[indices[COLONNE_TYPE_REMISE_CLIENT]] || '',
            valeurRemise: ligne[indices[COLONNE_VALEUR_REMISE_CLIENT]] || 0,
            nbTourneesOffertes: ligne[indices[COLONNE_NB_TOURNEES_OFFERTES]] || 0,
            resident: ligne[indices[COLONNE_RESIDENT_CLIENT]] === true
        }));
    } catch (e) {
        Logger.log("Erreur dans obtenirTousLesClients: " + e.toString());
        return [];
    }
}

/**
 * Crée une réservation depuis le panneau d'administration.
 * @param {Object} data Les données de la réservation à créer.
 * @returns {Object} Un résumé de l'opération.
 */
function creerReservationAdmin(data) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return { success: false, error: "Le système est occupé." };

  try {
    if (Session.getActiveUser().getEmail().toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      return { success: false, error: "Accès non autorisé." };
    }
    
    if (!data.client.email || !data.client.nom || !data.date || !data.startTime) {
        throw new Error("Données de réservation incomplètes.");
    }

    data.client.resident = data.client.resident === true;

    enregistrerOuMajClient(data.client);

    const clientPourCalcul = obtenirInfosClientParEmail(data.client.email);

    // Admin calculation: force type (Normal/Samedi) and avoid automatic Urgent pricing
    const totalStops = data.totalStops || (data.additionalStops + 1);
    const samedi = new Date(data.date + 'T00:00:00').getDay() === 6;
    const residentModeRaw = String(data.residentMode || (data.client && data.client.residentMode) || '').toLowerCase();
    const residentMode = residentModeRaw === 'urgence' ? 'urgence' : 'standard';
    const estResident = data.client && data.client.resident === true && typeof FORFAIT_RESIDENT !== 'undefined';
    let urgent = data.forceUrgent === true;
    if (estResident && residentMode === 'urgence') {
      urgent = true;
    }
    const tarif = computeCoursePrice({
      totalStops: totalStops,
      retour: data.returnToPharmacy,
      urgent: urgent,
      samedi: samedi
    });
    let duree = DUREE_BASE + (tarif.nbSupp * DUREE_ARRET_SUP);
    let prix = tarif.total;
    const typeCourse = samedi ? 'Samedi' : (urgent ? 'Urgent' : 'Normal');
    let libelleResident = '';
    if (estResident) {
      prix = residentMode === 'urgence'
        ? FORFAIT_RESIDENT.URGENCE_PRICE
        : FORFAIT_RESIDENT.STANDARD_PRICE;
      libelleResident = residentMode === 'urgence'
        ? (FORFAIT_RESIDENT.URGENCE_LABEL || 'Forfait résident - Urgence <4h')
        : (FORFAIT_RESIDENT.STANDARD_LABEL || 'Forfait résident');
    }

    let tourneeOfferteAppliquee = false;
    if (clientPourCalcul) {
      if (clientPourCalcul.nbTourneesOffertes > 0) {
        prix = 0;
        tourneeOfferteAppliquee = true;
      } else if (clientPourCalcul.typeRemise === 'Pourcentage' && clientPourCalcul.valeurRemise > 0) {
        prix *= (1 - clientPourCalcul.valeurRemise / 100);
      } else if (clientPourCalcul.typeRemise === 'Montant Fixe' && clientPourCalcul.valeurRemise > 0) {
        prix = Math.max(0, prix - clientPourCalcul.valeurRemise);
      }
    }
    if (!data.startTime) {
      return { success: false, error: 'Veuillez sélectionner ou saisir un horaire.' };
    }

    const creneauxDisponibles = obtenirCreneauxDisponiblesPourDate(data.date, duree);
    const bypassVerificationCreneau = estResident || creneauxDisponibles.length === 0;
    if (!bypassVerificationCreneau && !creneauxDisponibles.includes(data.startTime)) {
      return { success: false, error: `Le créneau ${data.startTime} n'est plus disponible.` };
    }

    const idReservation = 'RESA-' + Utilities.getUuid();
    const [heure, minute] = data.startTime.split('h').map(Number);
    const [annee, mois, jour] = data.date.split('-').map(Number);
    const dateDebut = new Date(annee, mois - 1, jour, heure, minute);
    const dateFin = new Date(dateDebut.getTime() + duree * 60000);
    // typeCourse computed above

    const titreEvenement = `Réservation ${NOM_ENTREPRISE} - ${data.client.nom}`;
    let descriptionEvenement = `Client: ${data.client.nom} (${data.client.email})\nType: ${typeCourse}\nID Réservation: ${idReservation}\nArrêts totaux: ${totalStops}, Retour: ${data.returnToPharmacy ? 'Oui' : 'Non'}\nTotal: ${prix.toFixed(2)} €\nNote: Ajouté par admin.`;
    if (data.client.resident === true) {
      descriptionEvenement += '\nResident: Oui';
      if (libelleResident) {
        descriptionEvenement += `\nForfait résident: ${libelleResident}`;
      }
    }

    const evenement = CalendarApp.getCalendarById(getSecret('ID_CALENDRIER')).createEvent(titreEvenement, dateDebut, dateFin, { description: descriptionEvenement });

    if (evenement) {
      let detailsFacturation = formatCourseLabel_(duree, totalStops, data.returnToPharmacy);
      if (estResident) {
        const labelResident = libelleResident || 'Forfait résident';
        const resumeRetour = data.returnToPharmacy ? 'retour: oui' : 'retour: non';
        detailsFacturation = `${labelResident} (forfait résident, ${totalStops} arrêt(s), ${resumeRetour})`;
      }
      const noteInterne = estResident && libelleResident
        ? `Ajouté par admin | Forfait résident: ${libelleResident}`
        : 'Ajouté par admin';
      enregistrerReservationPourFacturation(
        dateDebut,
        data.client.nom,
        data.client.email,
        typeCourse,
        detailsFacturation,
        prix,
        evenement.getId(),
        idReservation,
        noteInterne,
        tourneeOfferteAppliquee,
        clientPourCalcul.typeRemise,
        clientPourCalcul.valeurRemise,
        data.client.resident === true
      );
      logActivity(idReservation, data.client.email, `Réservation manuelle par admin`, prix, "Succès");

      if (tourneeOfferteAppliquee) {
        decrementerTourneesOffertesClient(data.client.email);
      }

      if (data.notifyClient) {
        notifierClientConfirmation(data.client.email, data.client.nom, [{
          date: formaterDatePersonnalise(dateDebut, 'EEEE d MMMM yyyy'),
          time: data.startTime,
          price: prix
        }]);
      }

      var infoRemise = '';
      if (tourneeOfferteAppliquee) {
        infoRemise = '(Offerte)';
      } else if (clientPourCalcul && clientPourCalcul.typeRemise === 'Pourcentage' && clientPourCalcul.valeurRemise > 0) {
        infoRemise = '(-' + clientPourCalcul.valeurRemise + '%)';
      } else if (clientPourCalcul && clientPourCalcul.typeRemise === 'Montant Fixe' && clientPourCalcul.valeurRemise > 0) {
        infoRemise = '(-' + clientPourCalcul.valeurRemise + '€)';
      }

      var reservation = {
        id: idReservation,
        eventId: evenement.getId(),
        start: dateDebut.toISOString(),
        end: dateFin.toISOString(),
        details: detailsFacturation,
        clientName: data.client.nom,
        clientEmail: data.client.email,
        amount: prix,
        km: KM_BASE + ((tarif.nbSupp + (data.returnToPharmacy ? 1 : 0)) * KM_ARRET_SUP),
        statut: '',
        infoRemise: infoRemise
      };
    } else {
      throw new Error("La création de l'événement dans le calendrier a échoué.");
    }
    return { success: true, reservation: reservation };

  } catch (e) {
    Logger.log(`Erreur dans creerReservationAdmin: ${e.stack}`);
    return { success: false, error: e.message };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Supprime une réservation.
 * @param {string} idReservation L'ID de la réservation à supprimer.
 * @returns {Object} Un résumé de l'opération.
 */
function supprimerReservation(idReservation) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return { success: false, error: "Le système est occupé." };

  try {
    if (Session.getActiveUser().getEmail().toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      return { success: false, error: "Accès non autorisé." };
    }

    const feuilleFacturation = SpreadsheetApp.openById(getSecret('ID_FEUILLE_CALCUL')).getSheetByName(SHEET_FACTURATION);
    if (!feuilleFacturation) throw new Error("La feuille 'Facturation' est introuvable.");

    const enTete = feuilleFacturation.getRange(1, 1, 1, feuilleFacturation.getLastColumn()).getValues()[0];
    const indices = {
      idResa: enTete.indexOf("ID Réservation"),
      idEvent: enTete.indexOf("Event ID"),
      email: enTete.indexOf("Client (Email)"),
      montant: enTete.indexOf("Montant")
    };
    if (Object.values(indices).some(i => i === -1)) throw new Error("Colonnes requises introuvables.");

    const donneesFacturation = feuilleFacturation.getDataRange().getValues();
    const indexLigneASupprimer = donneesFacturation.findIndex(row => String(row[indices.idResa]).trim() === String(idReservation).trim());

    if (indexLigneASupprimer === -1) {
      return { success: false, error: "Réservation introuvable." };
    }

    const ligneASupprimer = donneesFacturation[indexLigneASupprimer];
    const eventId = String(ligneASupprimer[indices.idEvent]).trim();
    const emailClient = ligneASupprimer[indices.email];
    const montant = ligneASupprimer[indices.montant];

    try {
      CalendarApp.getCalendarById(getSecret('ID_CALENDRIER')).getEventById(eventId).deleteEvent();
    } catch (e) {
      Logger.log(`Impossible de supprimer l'événement Calendar ${eventId}: ${e.message}. Il a peut-être déjà été supprimé.`);
    }

    feuilleFacturation.deleteRow(indexLigneASupprimer + 1);
    logActivity(idReservation, emailClient, `Suppression de course`, montant, "Supprimée");

    return { success: true, message: "Course supprimée avec succès." };

  } catch (e) {
    Logger.log(`Erreur dans supprimerReservation: ${e.stack}`);
    return { success: false, error: e.message };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Applique ou supprime une remise sur une tournée existante.
 * @param {string} idReservation ID de la réservation à modifier.
 * @param {string} typeRemise Type de remise sélectionné (Aucune|Pourcentage|Montant Fixe|Tournées Offertes).
 * @param {number} valeurRemise Valeur numérique de la remise.
 * @param {number} nbTourneesOffertesClient Nombre de tournées offertes restantes côté client (indicatif).
 * @returns {{success:boolean, montant?:number, error?:string}}
 */
function appliquerRemiseSurTournee(idReservation, typeRemise, valeurRemise, nbTourneesOffertesClient) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return { success: false, error: "Le système est occupé." };

  try {
    if (Session.getActiveUser().getEmail().toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      return { success: false, error: "Accès non autorisé." };
    }

    const feuille = SpreadsheetApp.openById(getSecret('ID_FEUILLE_CALCUL')).getSheetByName(SHEET_FACTURATION);
    if (!feuille) throw new Error("La feuille 'Facturation' est introuvable.");

    const enTete = feuille.getRange(1, 1, 1, feuille.getLastColumn()).getValues()[0].map(h => String(h || '').trim());
    const indices = {
      idResa: enTete.indexOf("ID Réservation"),
      typeCourse: enTete.indexOf("Type"),
      details: enTete.indexOf("Détails"),
      montant: enTete.indexOf("Montant"),
      email: enTete.indexOf("Client (Email)"),
      typeRemise: enTete.indexOf("Type Remise Appliquée"),
      valeurRemise: enTete.indexOf("Valeur Remise Appliquée"),
      tourneeOfferte: enTete.indexOf("Tournée Offerte Appliquée"),
      eventId: enTete.indexOf("Event ID"),
      resident: enTete.indexOf("Resident")
    };
    if (indices.idResa === -1 || indices.details === -1 || indices.montant === -1 || indices.email === -1) {
      throw new Error("Colonnes requises introuvables dans la feuille de facturation.");
    }

    const donnees = feuille.getDataRange().getValues();
    const indexLigne = donnees.findIndex(row => String(row[indices.idResa]).trim() === String(idReservation).trim());
    if (indexLigne === -1) return { success: false, error: "Réservation introuvable." };

    const ligne = donnees[indexLigne];
    const emailClient = String(ligne[indices.email] || '').trim();
    const detailsCourse = String(ligne[indices.details] || '');
    const typeCourse = indices.typeCourse !== -1 ? String(ligne[indices.typeCourse] || '').trim().toLowerCase() : 'normal';
    const eventId = indices.eventId !== -1 ? String(ligne[indices.eventId] || '').trim() : '';
    const etaitTourneeOfferte = indices.tourneeOfferte !== -1 ? ligne[indices.tourneeOfferte] === true : false;
    const estResident = indices.resident !== -1 ? ligne[indices.resident] === true : false;

    const matchStops = detailsCourse.match(/(\d+)\s*arr/i);
    if (!matchStops) return { success: false, error: "Impossible de déterminer le nombre d'arrêts à partir des détails." };
    const totalStops = Math.max(1, parseInt(matchStops[1], 10));
    const retourPharmacie = /retour\s*:\s*oui/i.test(detailsCourse);
    const urgent = typeCourse === 'urgent';
    const samedi = typeCourse === 'samedi';

    let prixBase;
    if (estResident && typeof FORFAIT_RESIDENT !== 'undefined') {
      prixBase = urgent ? FORFAIT_RESIDENT.URGENCE_PRICE : FORFAIT_RESIDENT.STANDARD_PRICE;
    } else {
      const calcul = computeCoursePrice({ totalStops: totalStops, retour: retourPharmacie, urgent: urgent, samedi: samedi });
      if (calcul.error) {
        throw new Error(`Tarification indisponible (${calcul.error}).`);
      }
      prixBase = calcul.total;
    }

    if (!isFinite(prixBase)) {
      throw new Error("Prix de base indéterminé.");
    }

    const normaliserType = function (val) {
      const str = String(val || '').trim();
      const decompose = typeof str.normalize === 'function' ? str.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : str;
      return decompose.toLowerCase();
    };

    const typeNormalise = normaliserType(typeRemise);
    let nouveauMontant = prixBase;
    let typeRemiseStockee = '';
    let valeurRemiseStockee = 0;
    let nouvelleTourneeOfferte = false;

    if (typeNormalise === 'tournees offertes') {
      if (!etaitTourneeOfferte) {
        const infosClient = emailClient ? obtenirInfosClientParEmail(emailClient) : null;
        const creditsDisponibles = Math.max(
          Number(nbTourneesOffertesClient) || 0,
          infosClient ? (Number(infosClient.nbTourneesOffertes) || 0) : 0
        );
        if (creditsDisponibles <= 0) {
          return { success: false, error: "Aucune tournée offerte disponible pour ce client." };
        }
      }
      nouveauMontant = 0;
      nouvelleTourneeOfferte = true;
      typeRemiseStockee = '';
      valeurRemiseStockee = 0;
    } else if (typeNormalise === 'pourcentage') {
      const pct = Number(valeurRemise);
      if (!isFinite(pct) || pct <= 0 || pct > 100) {
        return { success: false, error: "Veuillez entrer un pourcentage valide (0-100)." };
      }
      nouveauMontant = Math.max(0, prixBase * (1 - pct / 100));
      nouvelleTourneeOfferte = false;
      typeRemiseStockee = 'Pourcentage';
      valeurRemiseStockee = Math.round(pct * 100) / 100;
    } else if (typeNormalise === 'montant fixe') {
      const montantRemise = Number(valeurRemise);
      if (!isFinite(montantRemise) || montantRemise <= 0) {
        return { success: false, error: "Veuillez entrer un montant de remise valide." };
      }
      nouveauMontant = Math.max(0, prixBase - montantRemise);
      nouvelleTourneeOfferte = false;
      typeRemiseStockee = 'Montant Fixe';
      valeurRemiseStockee = Math.round(montantRemise * 100) / 100;
    } else {
      nouveauMontant = prixBase;
      typeRemiseStockee = '';
      valeurRemiseStockee = 0;
      nouvelleTourneeOfferte = false;
    }

    nouveauMontant = Math.round(nouveauMontant * 100) / 100;

    feuille.getRange(indexLigne + 1, indices.montant + 1).setValue(nouveauMontant);
    if (indices.typeRemise !== -1) {
      feuille.getRange(indexLigne + 1, indices.typeRemise + 1).setValue(typeRemiseStockee);
    }
    if (indices.valeurRemise !== -1) {
      feuille.getRange(indexLigne + 1, indices.valeurRemise + 1).setValue(valeurRemiseStockee);
    }
    if (indices.tourneeOfferte !== -1) {
      feuille.getRange(indexLigne + 1, indices.tourneeOfferte + 1).setValue(nouvelleTourneeOfferte);
    }

    if (nouvelleTourneeOfferte && !etaitTourneeOfferte && emailClient) {
      decrementerTourneesOffertesClient(emailClient);
    }

    if (eventId) {
      try {
        const calendarId = getSecret('ID_CALENDRIER');
        const ressourceEvenement = Calendar.Events.get(calendarId, eventId);
        if (ressourceEvenement) {
          const description = ressourceEvenement.description || '';
          const nouvelleDescription = description
            ? description.replace(/Total:\s*[^\n]+/i, `Total: ${nouveauMontant.toFixed(2)} EUR`)
            : `Total: ${nouveauMontant.toFixed(2)} EUR`;
          Calendar.Events.patch({ description: nouvelleDescription }, calendarId, eventId);
        }
      } catch (err) {
        Logger.log(`Impossible de mettre à jour l'événement ${eventId} pour la remise: ${err.message}`);
      }
    }

    const resume = nouvelleTourneeOfferte
      ? "Tournée convertie en tournée offerte"
      : (typeRemiseStockee
        ? `Remise ${typeRemiseStockee} appliquée (${valeurRemiseStockee})`
        : "Remise supprimée");
    logActivity(idReservation, emailClient, resume, nouveauMontant, "Succès");

    return { success: true, montant: nouveauMontant };
  } catch (e) {
    Logger.log(`Erreur dans appliquerRemiseSurTournee: ${e.stack}`);
    return { success: false, error: e.message };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Fonction principale pour générer les factures SANS les envoyer.
 */
function genererFactures() {
  const ui = SpreadsheetApp.getUi();
  try {
    validerConfiguration();
    logAdminAction("Génération Factures", "Démarrée");

    const ss = SpreadsheetApp.openById(getSecret('ID_FEUILLE_CALCUL'));
    const feuilleFacturation = ss.getSheetByName(SHEET_FACTURATION);
    const feuilleClients = ss.getSheetByName(SHEET_CLIENTS);
    const feuilleParams = ss.getSheetByName(SHEET_PARAMETRES);

    if (!feuilleFacturation || !feuilleClients || !feuilleParams) {
      throw new Error("Une des feuilles requises ('Facturation', 'Clients', 'Paramètres') est introuvable.");
    }

    const indicesFacturation = obtenirIndicesEnTetes(feuilleFacturation, ['Date', 'Client (Email)', 'Valider', 'N° Facture', 'Montant', 'ID PDF', 'Détails', 'Note Interne', 'Lien Note']);
    const enTeteFacturation = feuilleFacturation.getRange(1, 1, 1, feuilleFacturation.getLastColumn()).getValues()[0].map(v => String(v).trim());
    const indicesRemise = {
      type: enTeteFacturation.indexOf('Type Remise Appliquée'),
      valeur: enTeteFacturation.indexOf('Valeur Remise Appliquée'),
      tourneeOfferte: enTeteFacturation.indexOf('Tournée Offerte Appliquée')
    };
    const indicesClients = obtenirIndicesEnTetes(feuilleClients, ["Email", "Raison Sociale", "Adresse"]);

    const clientsData = feuilleClients.getDataRange().getValues();
    const mapClients = new Map(clientsData.slice(1).map(row => [
      String(row[indicesClients["Email"]]).trim(),
      { nom: String(row[indicesClients["Raison Sociale"]]).trim() || 'N/A', adresse: String(row[indicesClients["Adresse"]]).trim() || 'N/A' }
    ]));

    const facturationData = feuilleFacturation.getDataRange().getValues();
    const facturesAGenerer = facturationData
      .map((row, index) => ({ data: row, indexLigne: index + 1 }))
      .slice(1)
      .filter(item => item.data[indicesFacturation['Valider']] === true && !item.data[indicesFacturation['N° Facture']]);

    if (facturesAGenerer.length === 0) {
      ui.alert("Aucune nouvelle ligne à facturer n'a été sélectionnée.");
      return;
    }

    const facturesParClient = facturesAGenerer.reduce((acc, item) => {
      const email = String(item.data[indicesFacturation['Client (Email)']]).trim();
      if (email) {
        if (!acc[email]) acc[email] = [];
        acc[email].push(item);
      }
      return acc;
    }, {});

    let prochainNumFacture = parseInt(feuilleParams.getRange("B1").getValue(), 10);
    const messagesErreurs = [];
    let compteurSucces = 0;

    for (const emailClient in facturesParClient) {
      try {
        const clientInfos = mapClients.get(emailClient);
        if (!clientInfos) throw new Error(`Client ${emailClient} non trouvé.`);
        
        const lignesFactureClient = facturesParClient[emailClient];
        const numFacture = `FACT-${new Date().getFullYear()}-${String(prochainNumFacture).padStart(4, '0')}`;
        const dateFacture = new Date();

        let totalMontant = 0;
        let totalRemises = 0;
        let totalAvantRemises = 0;
        const symboleEuro = String.fromCharCode(8364);
        const lignesBordereau = [];
        let dateMin = new Date(lignesFactureClient[0].data[indicesFacturation['Date']]);
        let dateMax = new Date(lignesFactureClient[0].data[indicesFacturation['Date']]);

        lignesFactureClient.forEach(item => {
          const ligneData = item.data;
          const montantLigne = parseFloat(ligneData[indicesFacturation['Montant']]) || 0;
          totalMontant += montantLigne;
          const dateCourse = new Date(ligneData[indicesFacturation['Date']]);
          if (dateCourse < dateMin) dateMin = dateCourse;
          if (dateCourse > dateMax) dateMax = dateCourse;

          const typeRemise = indicesRemise.type !== -1 ? String(ligneData[indicesRemise.type] || '').trim() : '';
          const valeurRemise = indicesRemise.valeur !== -1 ? parseFloat(ligneData[indicesRemise.valeur]) || 0 : 0;
          const tourneeOfferte = indicesRemise.tourneeOfferte !== -1 && ligneData[indicesRemise.tourneeOfferte] === true;

          let libelleRemise = '';
          let montantRemiseValeur = 0;
          let montantAvantRemise = montantLigne;

          if (tourneeOfferte) {
            libelleRemise = 'Offerte';
            montantRemiseValeur = 0;
          } else if (typeRemise === 'Pourcentage' && valeurRemise > 0) {
            libelleRemise = `-${valeurRemise}%`;
            if (valeurRemise < 100) {
              montantAvantRemise = montantLigne / (1 - (valeurRemise / 100));
              montantRemiseValeur = Math.max(0, montantAvantRemise - montantLigne);
            }
          } else if (typeRemise === 'Montant Fixe' && valeurRemise > 0) {
            libelleRemise = `-${formatMontantEuro(valeurRemise)} ${symboleEuro}`;
            montantRemiseValeur = valeurRemise;
            montantAvantRemise = montantLigne + valeurRemise;
          }

          if (montantRemiseValeur > 0) {
            montantRemiseValeur = Math.round(montantRemiseValeur * 100) / 100;
          }
          if (montantAvantRemise > 0) {
            montantAvantRemise = Math.round(montantAvantRemise * 100) / 100;
          }

          totalRemises += montantRemiseValeur;
          totalAvantRemises += montantAvantRemise;

          const montantFormate = formatMontantEuro(montantLigne);
          const remiseMontantFormatee = montantRemiseValeur > 0 ? `${formatMontantEuro(montantRemiseValeur)} ${symboleEuro}` : '';

          lignesBordereau.push({
            date: formaterDatePersonnalise(dateCourse, 'dd/MM/yy'),
            heure: formaterDatePersonnalise(dateCourse, "HH'h'mm"),
            details: ligneData[indicesFacturation['Détails']] || '',
            note: ligneData[indicesFacturation['Note Interne']] || '',
            lienNote: ligneData[indicesFacturation['Lien Note']] || null,
            montantTexte: montantFormate,
            remiseTexte: libelleRemise,
            remiseMontantTexte: remiseMontantFormatee,
            estOfferte: tourneeOfferte && montantLigne === 0
          });
        });

        const tva = TVA_APPLICABLE ? totalMontant * TAUX_TVA : 0;
        const totalTTC = totalMontant + tva;
        if (totalAvantRemises === 0) {
          totalAvantRemises = totalMontant;
        }
        const dateEcheance = new Date(dateFacture.getTime() + (DELAI_PAIEMENT_JOURS * 24 * 60 * 60 * 1000));

        const dossierArchives = DriveApp.getFolderById(getSecret('ID_DOSSIER_ARCHIVES'));
        const dossierAnnee = obtenirOuCreerDossier(dossierArchives, dateFacture.getFullYear().toString());
        const dossierMois = obtenirOuCreerDossier(dossierAnnee, formaterDatePersonnalise(dateFacture, "MMMM yyyy"));

        const modeleFacture = DriveApp.getFileById(getSecret('ID_MODELE_FACTURE'));
        const copieFactureDoc = modeleFacture.makeCopy(`${numFacture} - ${clientInfos.nom}`, dossierMois);
        const doc = DocumentApp.openById(copieFactureDoc.getId());
        const corps = doc.getBody();

        const logoFallbackBlob = getLogoSvgBlob();
        if (!insererImageDepuisPlaceholder(corps, '{{logo}}', FACTURE_LOGO_FILE_ID, 160, logoFallbackBlob)) {
          corps.replaceText('{{logo}}', '');
        }

        corps.replaceText('{{nom_entreprise}}', NOM_ENTREPRISE);
        corps.replaceText('{{adresse_entreprise}}', ADRESSE_ENTREPRISE);
        corps.replaceText('{{siret}}', getSecret('SIRET'));
        corps.replaceText('{{email_entreprise}}', EMAIL_ENTREPRISE);
        corps.replaceText('{{client_nom}}', clientInfos.nom);
        corps.replaceText('{{client_adresse}}', clientInfos.adresse);
        corps.replaceText('{{numero_facture}}', numFacture);
        corps.replaceText('{{date_facture}}', formaterDatePersonnalise(dateFacture, 'dd/MM/yyyy'));
        corps.replaceText('{{periode_facturee}}', formatMoisFrancais(dateMin));
        corps.replaceText('{{date_debut_periode}}', formaterDatePersonnalise(dateMin, 'dd/MM/yyyy'));
        corps.replaceText('{{date_fin_periode}}', formaterDatePersonnalise(dateMax, 'dd/MM/yyyy'));
        corps.replaceText('{{total_du}}', formatMontantEuro(totalTTC));
        corps.replaceText('{{total_ht}}', formatMontantEuro(totalMontant));
        corps.replaceText('{{montant_tva}}', formatMontantEuro(tva));
        corps.replaceText('{{total_ttc}}', formatMontantEuro(totalTTC));
        const totalRemisesTexte = totalRemises > 0 ? `- ${formatMontantEuro(totalRemises)} ${symboleEuro}` : `0,00 ${symboleEuro}`;
        const totalAvantRemisesTexte = formatMontantEuro(totalAvantRemises);
        corps.replaceText('{{total_remises}}', totalRemisesTexte);
        corps.replaceText('{{total_avant_remises}}', totalAvantRemisesTexte);
        corps.replaceText('{{nombre_courses}}', String(lignesBordereau.length));

        const lienTarifs = (() => {
          try {
            return getSecret('URL_TARIFS_PUBLIC');
          } catch (_err) {
            try {
              const docTarifs = getSecret('ID_DOCUMENT_TARIFS');
              return docTarifs ? `https://drive.google.com/file/d/${docTarifs}/view` : `Contactez ${EMAIL_ENTREPRISE}`;
            } catch (_err2) {
              return `Contactez ${EMAIL_ENTREPRISE}`;
            }
          }
        })();

        const lienCgv = (() => {
          try {
            const cgvId = getSecret('ID_DOCUMENT_CGV');
            return `https://drive.google.com/file/d/${cgvId}/view`;
          } catch (_err) {
            return `Contactez ${EMAIL_ENTREPRISE}`;
          }
        })();

        corps.replaceText('{{lien_tarifs}}', lienTarifs);
        corps.replaceText('{{lien_cgv}}', lienCgv);
        corps.replaceText('{{date_echeance}}', formaterDatePersonnalise(dateEcheance, 'dd/MM/yyyy'));
        corps.replaceText('{{rib_entreprise}}', getSecret('RIB_ENTREPRISE'));
        corps.replaceText('{{bic_entreprise}}', getSecret('BIC_ENTREPRISE'));
        corps.replaceText('{{delai_paiement}}', String(DELAI_PAIEMENT_JOURS));
        
        const detectionBordereau = trouverTableBordereau(corps);
        if (detectionBordereau) {
          const tableBordereau = detectionBordereau.table;
          const colonnesBordereau = detectionBordereau.columns;
          while (tableBordereau.getNumRows() > 1) {
            tableBordereau.removeRow(1);
          }

          const headerCellCount = tableBordereau.getRow(0).getNumCells();

          lignesBordereau.forEach(ligne => {
            const nouvelleLigne = tableBordereau.appendTableRow();
            while (nouvelleLigne.getNumCells() < headerCellCount) {
              nouvelleLigne.appendTableCell('');
            }

            const setCell = (key, valeur) => {
              if (colonnesBordereau[key] === undefined) return;
              nouvelleLigne.getCell(colonnesBordereau[key]).setText(valeur || '');
            };

            setCell('date', ligne.date);
            setCell('heure', ligne.heure);
            setCell('details', ligne.details);

            if (colonnesBordereau.notes !== undefined) {
              const celluleNote = nouvelleLigne.getCell(colonnesBordereau.notes);
              if (ligne.lienNote && ligne.lienNote.startsWith('http')) {
                const text = celluleNote.editAsText();
                text.setText('Voir la note');
                text.setLinkUrl(0, text.getText().length - 1, ligne.lienNote);
              } else {
                celluleNote.setText(ligne.note || '');
              }
            }

            if (colonnesBordereau.remise !== undefined) {
              const valeur = ligne.remiseTexte || '';
              nouvelleLigne.getCell(colonnesBordereau.remise).setText(valeur);
            }

            if (colonnesBordereau.montant !== undefined) {
              let valeurMontant = ligne.montantTexte ? `${ligne.montantTexte} ${symboleEuro}` : '';
              if (ligne.remiseMontantTexte) {
                const etiquette = ligne.remiseTexte ? `Remise ${ligne.remiseTexte}` : 'Remise';
                valeurMontant = `${valeurMontant} (${etiquette} : ${ligne.remiseMontantTexte})`;
              } else if (ligne.estOfferte) {
                valeurMontant = valeurMontant ? `${valeurMontant} (Offert)` : 'Offert';
              }
              nouvelleLigne.getCell(colonnesBordereau.montant).setText(valeurMontant.trim());
            }
          });
        } else {
            throw new Error("Aucun tableau de bordereau valide trouvé. Vérifiez les en-têtes.");
        }

        doc.saveAndClose();

        const blobPDF = copieFactureDoc.getAs(MimeType.PDF);
        const fichierPDF = dossierMois.createFile(blobPDF).setName(`${numFacture} - ${clientInfos.nom}.pdf`);

        lignesFactureClient.forEach(item => {
          feuilleFacturation.getRange(item.indexLigne, indicesFacturation['N° Facture'] + 1).setValue(numFacture);
          feuilleFacturation.getRange(item.indexLigne, indicesFacturation['Valider'] + 1).setValue(false);
          feuilleFacturation.getRange(item.indexLigne, indicesFacturation['ID PDF'] + 1).setValue(fichierPDF.getId());
        });

        DriveApp.getFileById(copieFactureDoc.getId()).setTrashed(true);
        prochainNumFacture++;
        compteurSucces++;

      } catch (err) {
        messagesErreurs.push(`Erreur pour ${emailClient}: ${err.message}`);
        Logger.log(`Erreur de facturation pour ${emailClient}: ${err.stack}`);
      }
    }

    feuilleParams.getRange("B1").setValue(prochainNumFacture);
    logAdminAction("Génération Factures", `Succès pour ${compteurSucces} client(s). Erreurs: ${messagesErreurs.length}`);
    
    const messageFinal = `${compteurSucces} facture(s) ont été générée(s) avec succès.\n\n` +
      `Prochaine étape :\n` +
      `1. Contrôlez les PDF dans le dossier Drive.\n` +
      `2. Cochez les cases dans la colonne "Email à envoyer".\n` +
      `3. Utilisez le menu "EL Services > Envoyer les factures contrôlées".\n\n` +
      `Erreurs: ${messagesErreurs.join('\n') || 'Aucune'}`;
    ui.alert("Génération terminée", messageFinal, ui.ButtonSet.OK);

  } catch (e) {
    Logger.log(`ERREUR FATALE dans genererFactures: ${e.stack}`);
    logAdminAction("Génération Factures", `Échec critique: ${e.message}`);
    ui.showModalDialog(HtmlService.createHtmlOutput(`<p>Une erreur critique est survenue:</p><pre>${e.message}</pre>`), "Erreur Critique");
  }
}

/**
 * Envoie par e-mail les factures marquées comme prêtes à être envoyées.
 * Utilise la feuille "Facturation" et les colonnes suivantes si présentes:
 *  - "Email à envoyer" (booléen), "Client (Email)", "N° Facture", "ID PDF", "Montant", "Statut", "Note Interne".
 * Si "Email à envoyer" n'existe pas, envoie pour les lignes ayant un N° Facture et un ID PDF non vides.
 */
function envoyerFacturesControlees() {
  const ui = SpreadsheetApp.getUi();
  try {
    const ss = SpreadsheetApp.openById(getSecret('ID_FEUILLE_CALCUL'));
    const feuille = ss.getSheetByName(SHEET_FACTURATION);
    if (!feuille) throw new Error("La feuille 'Facturation' est introuvable.");

    const lastCol = feuille.getLastColumn();
    const header = feuille.getRange(1, 1, 1, lastCol).getValues()[0].map(v => String(v).trim());
    const idx = {
      email: header.indexOf('Client (Email)'),
      numero: header.indexOf('N° Facture'),
      idPdf: header.indexOf('ID PDF'),
      aEnvoyer: header.indexOf('Email à envoyer'),
      montant: header.indexOf('Montant'),
      statut: header.indexOf('Statut'),
      note: header.indexOf('Note Interne')
    };

    if (idx.email === -1 || idx.numero === -1 || idx.idPdf === -1) {
      throw new Error("Colonnes requises manquantes dans 'Facturation' (Client (Email), N° Facture, ID PDF).");
}

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

    const ss = SpreadsheetApp.openById(getSecret('ID_FEUILLE_CALCUL'));
    const feuille = ss.getSheetByName(SHEET_FACTURATION);
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
    const dossierArchives = DriveApp.getFolderById(getSecret('ID_DOSSIER_ARCHIVES'));
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

    const logoBlock = getLogoEmailBlockHtml();
    const data = feuille.getDataRange().getValues();
    let envoyees = 0;
    let erreurs = [];

    for (let r = 1; r < data.length; r++) {
      const row = data[r];
      const email = String(row[idx.email] || '').trim();
      const numero = String(row[idx.numero] || '').trim();
      const idPdf = String(row[idx.idPdf] || '').trim();
      const flag = idx.aEnvoyer !== -1 ? row[idx.aEnvoyer] === true : true;
      if (!email || !numero || !idPdf || !flag) continue;

      try {
        const fichier = DriveApp.getFileById(idPdf);
        const pdfBlob = fichier.getAs(MimeType.PDF).setName(`${numero}.pdf`);
        const montant = idx.montant !== -1 ? parseFloat(row[idx.montant]) || 0 : null;
        const sujet = `[${NOM_ENTREPRISE}] Facture ${numero}`;
        const corps = [
          logoBlock,
          `<p>Bonjour,</p>`,
          `<p>Veuillez trouver ci-joint votre facture <strong>${numero}</strong>${montant !== null ? ` d'un montant de <strong>${montant.toFixed(2)} €</strong>` : ''}.</p>`,
          `<p>Merci pour votre confiance.<br/>${NOM_ENTREPRISE}</p>`
        ].filter(Boolean).join('');

        MailApp.sendEmail({ to: email, subject: sujet, htmlBody: corps, attachments: [pdfBlob] });

        if (idx.aEnvoyer !== -1) feuille.getRange(r + 1, idx.aEnvoyer + 1).setValue(false);
        if (idx.statut !== -1) feuille.getRange(r + 1, idx.statut + 1).setValue('Envoyée');
        envoyees++;
      } catch (e) {
        erreurs.push(`Ligne ${r + 1} (${numero}) : ${e.message}`);
      }
    }

    ui.alert('Envoi des factures', `${envoyees} e-mail(s) envoyé(s).${erreurs.length ? "\nErreurs:\n" + erreurs.join("\n") : ''}`, ui.ButtonSet.OK);
    logAdminAction('Envoi Factures', `Succès: ${envoyees}, Erreurs: ${erreurs.length}`);
  } catch (e) {
    Logger.log(`Erreur dans envoyerFacturesControlees: ${e.stack}`);
    try { logAdminAction('Envoi Factures', `Échec: ${e.message}`); } catch (_e) {}
    SpreadsheetApp.getUi().alert('Erreur', e.message, ui.ButtonSet.OK);
  }
}
// ================================================================
//                         MENU FEUILLE (ELS)
// ================================================================
// Ajoute un menu pour vérifier rapidement l'installation et le setup.
// Les entrées n'apparaissent que si les fonctions existent.

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  const menu = ui.createMenu('EL Services');

  if (typeof showSetupSummary_ELS === 'function') {
    menu.addItem('Vérifier l’installation', 'showSetupSummary_ELS');
  }
  if (typeof checkSetup_ELS === 'function') {
    menu.addItem('Check setup (console)', 'checkSetup_ELS');
  }
  // Actions de facturation (si disponibles)
  if (typeof genererFactures === 'function') {
    menu.addItem('Generer les factures', 'genererFactures');
  }
  if (typeof envoyerFacturesControlees === 'function') {
    menu.addItem('Envoyer les factures controlees', 'envoyerFacturesControlees');
  }
  if (typeof archiverFacturesDuMois === 'function') {
    menu.addItem('Archiver factures (mois prec.)', 'archiverFacturesDuMois');
  }

  menu.addToUi();
}


