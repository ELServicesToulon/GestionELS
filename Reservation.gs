// =================================================================
//                      LOGIQUE DE RÉSERVATION
// =================================================================
// Description: Fonctions centrales pour la gestion des réservations.
// =================================================================

/**
 * Traite un panier de réservations soumis par le client.
 * @param {Object} donneesReservation L'objet contenant les infos client et les articles du panier.
 * @returns {Object} Un résumé de l'opération.
 */
function reserverPanier(donneesReservation) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    return { success: false, summary: "Le système est occupé. Veuillez réessayer." };
  }

  try {
    const client = donneesReservation.client;
    if (client) {
      client.resident = client.resident === true;
    }
    const items = donneesReservation.items;
    let failedItemIds = [];
    let successfulReservations = [];

    enregistrerOuMajClient(client);
    const clientPourCalcul = obtenirInfosClientParEmail(client.email);

    for (const item of items) {
      const success = creerReservationUnique(item, client, clientPourCalcul);
      if (success) {
        successfulReservations.push(success);
      } else {
        failedItemIds.push(item.id);
      }
    }

    if (successfulReservations.length > 0) {
      notifierClientConfirmation(client.email, client.nom, successfulReservations);
    }
    
    if (failedItemIds.length > 0) {
        const summary = successfulReservations.length > 0
            ? "Certains créneaux n'étaient plus disponibles mais le reste a été réservé."
            : "Tous les créneaux sélectionnés sont devenus indisponibles.";
        return { success: false, summary: summary, failedItemIds: failedItemIds };
    }

    return { success: true };

  } catch (e) {
    Logger.log(`Erreur critique dans reserverPanier: ${e.stack}`);
    return { success: false, summary: e.message };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Crée une réservation unique.
 * @returns {Object|null} L'objet de la réservation réussie ou null si échec.
 */
function creerReservationUnique(item, client, clientPourCalcul, options = {}) {
    const { date, startTime, totalStops, returnToPharmacy } = item;
    const { overrideIdReservation = null, skipFacturation = false } = options;
    const infosTournee = calculerInfosTourneeBase(totalStops, returnToPharmacy, date, startTime);
    const duree = infosTournee.duree;
    const creneauxDisponibles = obtenirCreneauxDisponiblesPourDate(date, duree);

    if (!creneauxDisponibles.includes(startTime)) {
        return null; // Échec
    }

    const [heure, minute] = startTime.split('h').map(Number);
    const [annee, mois, jour] = date.split('-').map(Number);
    const dateDebut = new Date(annee, mois - 1, jour, heure, minute);
    const dateFin = new Date(dateDebut.getTime() + duree * 60000);
    const idReservation = overrideIdReservation || ('RESA-' + Utilities.getUuid());

    const titreEvenement = `Réservation ${NOM_ENTREPRISE} - ${client.nom}`;
    let descriptionEvenement = `Client: ${client.nom} (${client.email})\nID Réservation: ${idReservation}\nDétails: ${infosTournee.details}\nNote: ${client.note || ''}`;
    if (client.resident === true) {
      descriptionEvenement += '\nResident: Oui';
    }
    const calendrier = CalendarApp.getCalendarById(getSecret('ID_CALENDRIER'));
    const evenement = calendrier.createEvent(titreEvenement, dateDebut, dateFin, { description: descriptionEvenement });

    if (evenement) {
        if (RESERVATION_VERIFY_ENABLED) {
          const eventCheck = calendrier.getEventById(evenement.getId());
          const startOk = eventCheck && eventCheck.getStartTime().getTime() === dateDebut.getTime();
          const endOk = eventCheck && eventCheck.getEndTime().getTime() === dateFin.getTime();
          if (!startOk || !endOk || reservationIdExiste(idReservation)) {
            evenement.deleteEvent();
            return null;
          }
        }

      const infosPrixFinal = calculerPrixEtDureeServeur(totalStops, returnToPharmacy, date, startTime, clientPourCalcul, { resident: client.resident === true });
        if (!skipFacturation) {
        enregistrerReservationPourFacturation(
          dateDebut,
          client.nom,
          client.email,
          infosTournee.typeCourse,
          infosTournee.details,
          infosPrixFinal.prix,
          evenement.getId(),
          idReservation,
          client.note,
          infosPrixFinal.tourneeOfferteAppliquee,
          clientPourCalcul.typeRemise,
          clientPourCalcul.valeurRemise,
          client.resident === true
        );
        }
        if (infosPrixFinal.tourneeOfferteAppliquee) {
          decrementerTourneesOffertesClient(client.email);
        }
        return { date: formaterDateEnFrancais(dateDebut), time: startTime, price: infosPrixFinal.prix, eventId: evenement.getId(), reservationId: idReservation };
    }
    return null;
}

/**
 * Génère un devis détaillé à partir du panier et l'envoie par email.
 * @param {Object} donneesDevis - Contient les informations client et les articles du panier.
 * @returns {Object} Un objet indiquant le succès de l'opération.
 */
function envoyerDevisParEmail(donneesDevis) {
  try {
    const client = donneesDevis.client;
    const items = donneesDevis.items;
    const emailClient = client.email;

    if (!emailClient || items.length === 0) {
      throw new Error("Email ou panier manquant pour l'envoi du devis.");
    }

    let totalDevis = 0;
    const lignesHtml = items.map(item => {
      const date = new Date(item.date + 'T00:00:00');
      const dateFormatee = formaterDateEnFrancais(date);
      totalDevis += item.prix;
      return `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">${dateFormatee} à ${item.startTime}</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.details}</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${item.prix.toFixed(2)} €</td>
        </tr>
      `;
    }).join('');

    const sujet = `Votre devis de réservation - ${NOM_ENTREPRISE}`;
    const corpsHtml = `
      <div style="font-family: Montserrat, sans-serif; color: #333;">
        <h2>Devis pour vos réservations de tournées</h2>
        <p>Bonjour ${client.nom || ''},</p>
        <p>Voici le détail du devis pour les tournées actuellement dans votre panier. Ce devis est valable 24 heures, sous réserve de disponibilité des créneaux.</p>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr>
              <th style="padding: 8px; border-bottom: 2px solid #333; text-align: left;">Date et Heure</th>
              <th style="padding: 8px; border-bottom: 2px solid #333; text-align: left;">Détail de la prestation</th>
              <th style="padding: 8px; border-bottom: 2px solid #333; text-align: right;">Prix</th>
            </tr>
          </thead>
          <tbody>
            ${lignesHtml}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="2" style="padding: 10px 8px; text-align: right; font-weight: bold;">Total Estimé</td>
              <td style="padding: 10px 8px; text-align: right; font-weight: bold;">${totalDevis.toFixed(2)} €</td>
            </tr>
          </tfoot>
        </table>
        <p>Pour confirmer cette réservation, veuillez retourner sur notre application et valider votre panier.</p>
        <p>Merci de votre confiance,<br>L'équipe ${NOM_ENTREPRISE}</p>
      </div>
    `;

    MailApp.sendEmail({
      to: emailClient,
      subject: sujet,
      htmlBody: corpsHtml,
      replyTo: EMAIL_ENTREPRISE
    });

    return { success: true };

  } catch (e) {
    Logger.log(`Erreur dans envoyerDevisParEmail: ${e.stack}`);
    return { success: false, error: e.message };
  }
}

/**
 * Envoie un email de confirmation de réservation au client.
 */
function notifierClientConfirmation(email, nom, reservations) {
    try {
        if (!email || !reservations || reservations.length === 0) return;
        let corpsHtml = `
            <h1>Confirmation de votre réservation</h1>
            <p>Bonjour ${nom},</p>
            <p>Nous avons le plaisir de vous confirmer la réservation des tournées suivantes :</p>
            <ul>
                ${reservations.map(r => `<li>Le <strong>${r.date} à ${r.time}</strong> pour un montant de ${r.price.toFixed(2)} €</li>`).join('')}
            </ul>
            <p>Merci de votre confiance.</p>
            <p>L'équipe ${NOM_ENTREPRISE}</p>
        `;
        MailApp.sendEmail({
            to: email,
            subject: `Confirmation de votre réservation - ${NOM_ENTREPRISE}`,
            htmlBody: corpsHtml,
            replyTo: EMAIL_ENTREPRISE
        });
    } catch (e) {
        Logger.log(`Erreur lors de l'envoi de l'email de confirmation à ${email}: ${e.toString()}`);
    }
}

/**
 * Formate une date en français (ex: "Mercredi 6 août 2025").
 */
function formaterDateEnFrancais(date) {
    const jours = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    const mois = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
    return `${jours[date.getDay()]} ${date.getDate()} ${mois[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * Calcule les informations de base d'une tournée.
 */
function calculerInfosTourneeBase(totalStops, returnToPharmacy, dateString, startTime) {
  const arretsSupplementaires = Math.max(0, totalStops - 1);
  const duree = DUREE_BASE + (arretsSupplementaires * DUREE_ARRET_SUP);
  const km = KM_BASE + (arretsSupplementaires * KM_ARRET_SUP);
  const heureNormalisee = startTime.replace('h', ':');
  const dateCourse = new Date(`${dateString}T${heureNormalisee}`);
  const maintenant = new Date();
  let urgent = false;
  let samedi = false;

  // Prioriser le samedi sur l'urgent
  if (dateCourse.getDay() === 6) {
    samedi = true;
  } else if ((dateCourse.getTime() - maintenant.getTime()) / 60000 < URGENT_THRESHOLD_MINUTES) {
    urgent = true;
  }

  const tarif = computeCoursePrice({ totalStops, retour: returnToPharmacy, urgent, samedi });
  const typeCourse = samedi ? 'Samedi' : urgent ? 'Urgent' : 'Normal';
  const details = formatCourseLabel_(duree, totalStops, returnToPharmacy);
  return { prix: tarif.total, duree: duree, km: km, details: details, typeCourse: typeCourse };
}

/**
 * Calcule le prix final en appliquant les remises client.
 */
function calculerPrixEtDureeServeur(totalStops, returnToPharmacy, dateString, startTime, clientInfo, options) {
  const opts = options || {};
  const infosBase = calculerInfosTourneeBase(totalStops, returnToPharmacy, dateString, startTime);
  let prixFinal = infosBase.prix;
  let tourneeOfferteAppliquee = false;

  if (opts.resident === true) {
    prixFinal = infosBase.typeCourse === 'Urgent'
      ? FORFAIT_RESIDENT.URGENCE_PRICE
      : FORFAIT_RESIDENT.STANDARD_PRICE;
  }

  if (clientInfo) {
    if (clientInfo.nbTourneesOffertes > 0) {
      prixFinal = 0;
      tourneeOfferteAppliquee = true;
    } else if (clientInfo.typeRemise === 'Pourcentage' && clientInfo.valeurRemise > 0) {
      prixFinal *= (1 - clientInfo.valeurRemise / 100);
    } else if (clientInfo.typeRemise === 'Montant Fixe' && clientInfo.valeurRemise > 0) {
      prixFinal = Math.max(0, prixFinal - clientInfo.valeurRemise);
    }
  }

  return {
    prix: prixFinal,
    duree: infosBase.duree,
    details: infosBase.details,
    typeCourse: infosBase.typeCourse,
    tourneeOfferteAppliquee: tourneeOfferteAppliquee
  };
}

/**
 * Vérifie la disponibilité pour une récurrence et propose des alternatives.
 */
function verifierDisponibiliteRecurrence(itemDeBase) {
  const { date, startTime, duree } = itemDeBase;
  const resultats = [];
  const dateInitiale = new Date(date + 'T00:00:00');
  const jourDeLaSemaineCible = dateInitiale.getDay();
  const annee = dateInitiale.getFullYear();
  const mois = dateInitiale.getMonth();
  const joursDuMois = new Date(annee, mois + 1, 0).getDate();

  for (let jour = 1; jour <= joursDuMois; jour++) {
    const dateCourante = new Date(annee, mois, jour);
    if (dateCourante.getDay() === jourDeLaSemaineCible && dateCourante >= new Date(new Date().setHours(0, 0, 0, 0))) {
      const dateString = Utilities.formatDate(dateCourante, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      const creneauxDisponibles = obtenirCreneauxDisponiblesPourDate(dateString, duree);
      const dateFormatee = formaterDateEnFrancais(dateCourante);
      let statutPourCeJour = { dateFormatee: dateFormatee, dateISO: dateString, original: startTime };

      if (creneauxDisponibles.includes(startTime)) {
        statutPourCeJour.status = 'OK';
        statutPourCeJour.creneau = startTime;
      } else {
        statutPourCeJour.status = 'Conflict';
        statutPourCeJour.creneau = trouverAlternativeProche(startTime, creneauxDisponibles);
      }
      resultats.push(statutPourCeJour);
    }
  }
  return resultats;
}

/**
 * Trouve le créneau disponible le plus proche d'un créneau cible.
 */
function trouverAlternativeProche(creneauCible, creneauxDisponibles) {
  if (!creneauxDisponibles || creneauxDisponibles.length === 0) {
    return null;
  }
  const cibleEnMinutes = parseInt(creneauCible.split('h')[0]) * 60 + parseInt(creneauCible.split('h')[1]);
  let meilleureAlternative = null;
  let differenceMinimale = Infinity;

  for (const creneau of creneauxDisponibles) {
    const creneauEnMinutes = parseInt(creneau.split('h')[0]) * 60 + parseInt(creneau.split('h')[1]);
    const difference = Math.abs(creneauEnMinutes - cibleEnMinutes);
    if (difference < differenceMinimale) {
      differenceMinimale = difference;
      meilleureAlternative = creneau;
    }
  }
  return meilleureAlternative;
}


/**
 * Récupère toutes les réservations pour un email client (et optionnellement une date).
 */
function obtenirReservationsPourClient(email, date) {
  var sheet = SpreadsheetApp.openById(getSecret('ID_FEUILLE_CALCUL')).getSheetByName(SHEET_FACTURATION);
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var emailIndex = headers.indexOf("Client (Email)");
  var dateIndex = headers.indexOf("Date");
  var statutIndex = headers.indexOf("Statut");
  var reservations = [];
  var now = new Date();
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var resDate = new Date(row[dateIndex]);
    var clientEmail = (row[emailIndex] || '').toString().trim().toLowerCase();
    var statut = row[statutIndex];
    var matchEmail = email ? clientEmail === email.trim().toLowerCase() : true;
    var matchStatut = statut === "Confirmée";
    var matchDate = true;
    if (date) {
      var resDay = Utilities.formatDate(resDate, Session.getScriptTimeZone(), "dd/MM/yyyy");
      var paramDay = Utilities.formatDate(new Date(date), Session.getScriptTimeZone(), "dd/MM/yyyy");
      matchDate = resDay === paramDay;
    } else {
      matchDate = resDate >= now;
    }
    if (matchEmail && matchStatut && matchDate) {
      reservations.push(row);
    }
  }
  return reservations;
}

/**
 * Vérifie si l'ID de réservation existe déjà dans la feuille des réservations.
 * @param {string} idReservation L'identifiant à vérifier.
 * @returns {boolean} true si l'identifiant est présent.
 */
function reservationIdExiste(idReservation) {
  try {
    const ss = SpreadsheetApp.openById(getSecret('ID_FEUILLE_CALCUL'));
    const sheet = ss.getSheetByName(SHEET_RESERVATIONS);
    if (!sheet) {
      return false;
    }
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) {
      return false;
    }
    const headers = data[0];
    const idx = headers.indexOf('ID Réservation');
    if (idx === -1) {
      return false;
    }
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idx]).trim() === String(idReservation).trim()) {
        return true;
      }
    }
    return false;
  } catch (e) {
    Logger.log(`Erreur lors de la vérification de l'unicité ID: ${e.stack}`);
    return false;
  }
}




