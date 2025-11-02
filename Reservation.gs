// =================================================================
//                      LOGIQUE DE RÉSERVATION
// =================================================================
// Description: Fonctions centrales pour la gestion des réservations.
// =================================================================

/**
 * Vérifie si un code postal d'officine est autorisé pour accéder aux réservations.
 * @param {string|number} codePostal Valeur fournie par le client.
 * @returns {{success:boolean, codePostal?:string, message?:string}}
 */
function verifierCodePostalAcces(codePostal) {
  try {
    const normalise = normaliserCodePostal(codePostal);
    if (!normalise) {
      return { success: false, message: "Merci de saisir un code postal à 5 chiffres." };
    }
    if (!codePostalAutorise(normalise)) {
      return {
        success: false,
        codePostal: normalise,
        message: "Ce code postal n'est pas encore desservi. Contactez l'équipe ELS pour être accompagné."
      };
    }
    return { success: true, codePostal: normalise };
  } catch (err) {
    Logger.log("verifierCodePostalAcces erreur: " + err);
    return { success: false, message: "Une erreur interne empêche la vérification du code postal." };
  }
}

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
    const client = donneesReservation && donneesReservation.client ? donneesReservation.client : null;
    if (!client) {
      return { success: false, summary: "Informations client manquantes." };
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const emailNormalise = String(client.email || '').trim();
    if (!emailNormalise || !emailRegex.test(emailNormalise)) {
      return { success: false, summary: "Une adresse email valide est requise pour créer votre accès client." };
    }
    client.email = emailNormalise;
    client.contactEmail = emailNormalise;
    const codePostalNormalise = normaliserCodePostal(
      client.codePostal || client.code_postal || client.postalCode || client.zip || ''
    );
    if (!codePostalNormalise) {
      return { success: false, summary: "Merci d'indiquer le code postal de votre officine (5 chiffres)." };
    }
    if (!codePostalAutorise(codePostalNormalise)) {
      return {
        success: false,
        summary: "Ce code postal n'est pas encore desservi par notre service. Contactez-nous pour être accompagné."
      };
    }
    client.codePostal = codePostalNormalise;
    client.nom = String(client.nom || '').trim();
    client.resident = client.resident === true;
    if (client.resident === true && typeof RESIDENT_AFFILIATION_REQUIRED !== 'undefined' && RESIDENT_AFFILIATION_REQUIRED) {
      const emailStruct = String(client.email || '').trim();
      if (!emailStruct) {
        return { success: false, summary: "Pour un résident, l'email de la structure (EHPAD/foyer/pharmacie) est requis." };
      }
    }

    const items = donneesReservation.items;
    let failedItemIds = [];
    let successfulReservations = [];

    const resultatEnregistrement = enregistrerOuMajClient(client) || { isNew: false, clientId: '' };
    const clientPourCalcul = obtenirInfosClientParEmail(client.email) || {};
    client.clientId = resultatEnregistrement.clientId || clientPourCalcul.clientId || calculerIdentifiantClient(client.email);

    if (resultatEnregistrement.isNew) {
      try {
        envoyerIdentifiantAccesClient(client.email, client.nom, client.clientId);
      } catch (notifErr) {
        Logger.log(`Avertissement: impossible d'envoyer l'identifiant client à ${client.email}: ${notifErr}`);
      }
    }

    for (const item of items) {
      const success = creerReservationUnique(item, client, clientPourCalcul);
      if (success) {
        successfulReservations.push(success);
      } else {
        failedItemIds.push(item.id);
      }
    }

    const hasSuccess = successfulReservations.length > 0;
    const hasFailures = failedItemIds.length > 0;
    let confirmationEmailSent = false;

    if (hasSuccess && !hasFailures && RESERVATION_CONFIRMATION_EMAILS_ENABLED) {
      notifierClientConfirmation(client.email, client.nom, successfulReservations);
      confirmationEmailSent = true;
    }
    
    if (hasFailures) {
      const summary = hasSuccess
        ? "Certains créneaux n'étaient plus disponibles mais le reste a été réservé."
        : "Tous les créneaux sélectionnés sont devenus indisponibles.";
      return {
        success: false,
        partialSuccess: hasSuccess,
        summary: summary,
        failedItemIds: failedItemIds,
        successfulReservations: successfulReservations,
        confirmationEmailSent: confirmationEmailSent
      };
    }

    return { success: true, successfulReservations: successfulReservations, confirmationEmailSent: confirmationEmailSent };

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
          try {
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
          } catch (err) {
            try { evenement.deleteEvent(); } catch (_cleanupErr) { /* no-op */ }
            const errMessage = err && err.message ? err.message : String(err);
            const emailClient = client && client.email ? client.email : 'email inconnu';
            Logger.log("ERREUR lors de l'enregistrement facturation pour : " + emailClient + " (" + errMessage + ")");
            return null;
          }
        }
        if (infosPrixFinal.tourneeOfferteAppliquee) {
          decrementerTourneesOffertesClient(client.email);
          if (clientPourCalcul && typeof clientPourCalcul.nbTourneesOffertes !== 'undefined') {
            clientPourCalcul.nbTourneesOffertes = Math.max(0, (clientPourCalcul.nbTourneesOffertes || 0) - 1);
          }
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
    const logoBlock = getLogoEmailBlockHtml();
    const corpsHtml = `
      <div style="font-family: Montserrat, sans-serif; color: #333;">
        ${logoBlock}
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
 * Génère un devis PDF à partir d'items fournis et retourne l'URL du fichier.
 * @param {{client:{email:string,nom?:string,adresse?:string},items:Array<{date:string,startTime:string,details:string,prix:number}>}} donneesDevis
 * @returns {{success:boolean,url?:string,error?:string}}
 */
function genererDevisPdfFromItems(donneesDevis) {
  try {
    const client = donneesDevis && donneesDevis.client || {};
    const items = (donneesDevis && donneesDevis.items) || [];
    if (!items.length) throw new Error('Aucun item pour le devis.');

    let totalDevis = 0;
    const lignes = items.map(it => {
      const date = new Date(it.date + 'T00:00:00');
      const dateTxt = formaterDateEnFrancais(date);
      totalDevis += Number(it.prix) || 0;
      return {
        dateTxt: dateTxt,
        heureTxt: it.startTime,
        details: String(it.details || ''),
        montant: Number(it.prix) || 0
      };
    });

    // Avantage Forfait Résident: si applicable, offrir 5 € sur le retrait
    const structureNom = client && (client.structure || client.nom) ? (client.structure || client.nom) : '';
    const residentDetect = items.some(it => it.resident === true || /forfait\s*r[ée]sident/i.test(String(it.details || '')));
    const avantageMontant = residentDetect ? 5 : 0;

    const dossierArchives = DriveApp.getFolderById(getSecret('ID_DOSSIER_ARCHIVES'));
    const dossierDevis = obtenirOuCreerDossier(dossierArchives, 'Devis');
    const now = new Date();
    const libDate = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyyMMdd');
    const nomClient = client && client.nom ? client.nom : (client && client.email ? client.email : 'Client');
    const doc = DocumentApp.create(`DEVIS - ${nomClient} - ${libDate}`);
    const body = doc.getBody();
    body.setAttributes({ FONT_FAMILY: 'Montserrat' });

    body.appendParagraph(NOM_ENTREPRISE).setHeading(DocumentApp.ParagraphHeading.HEADING2);
    body.appendParagraph(ADRESSE_ENTREPRISE);
    body.appendParagraph(EMAIL_ENTREPRISE).setSpacingAfter(14);
    body.appendParagraph('DEVIS').setHeading(DocumentApp.ParagraphHeading.HEADING1);
    body.appendParagraph(`Date: ${Utilities.formatDate(now, Session.getScriptTimeZone(), 'dd/MM/yyyy')}`);
    body.appendParagraph('Valable 30 jours, sous réserve de disponibilité.').setSpacingAfter(14);
    body.appendParagraph('Client').setHeading(DocumentApp.ParagraphHeading.HEADING3);
    body.appendParagraph(nomClient);
    if (client && client.adresse) body.appendParagraph(client.adresse);
    if (client && client.email) body.appendParagraph(client.email);
    body.appendParagraph('').setSpacingAfter(10);

    const table = body.appendTable();
    const headerRow = table.appendTableRow();
    ['Date', 'Heure', 'Prestation', 'Montant (€)'].forEach(t => headerRow.appendTableCell(t).setBold(true));
    let avantageAnnote = false;
    lignes.forEach(l => {
      const row = table.appendTableRow();
      row.appendTableCell(l.dateTxt);
      row.appendTableCell(l.heureTxt);
      row.appendTableCell(l.details);
      var cellText = Utilities.formatString('%.2f', l.montant) + ' €';
      if (residentDetect && !avantageAnnote && avantageMontant > 0) {
        const label = structureNom ? ('Avantage ' + structureNom) : 'Avantage résident';
        cellText += ' (' + label + ' : -' + Utilities.formatString('%.2f', avantageMontant) + ' €)';
        avantageAnnote = true;
      }
      row.appendTableCell(cellText);
    });
    // Ligne Avantage si applicable
    if (avantageMontant > 0) {
      const adv = table.appendTableRow();
      adv.appendTableCell('');
      adv.appendTableCell('');
      adv.appendTableCell(structureNom ? ('Avantage: ' + structureNom) : 'Avantage résident');
      adv.appendTableCell('-' + Utilities.formatString('%.2f', avantageMontant) + ' €');
    }
    const totalRow = table.appendTableRow();
    totalRow.appendTableCell('Total').setBold(true);
    totalRow.appendTableCell('');
    totalRow.appendTableCell('');
    totalRow.appendTableCell(Utilities.formatString('%.2f', Math.max(0, totalDevis - avantageMontant)) + ' €').setBold(true);

    body.appendParagraph('\u00A0');
    body.appendParagraph("Pour confirmer: réservez via l'application ou contactez-nous.");

    doc.saveAndClose();
    const pdfBlob = DriveApp.getFileById(doc.getId()).getAs(MimeType.PDF).setName(doc.getName() + '.pdf');
    const pdfFile = dossierDevis.createFile(pdfBlob);
    return { success: true, url: pdfFile.getUrl() };
  } catch (e) {
    Logger.log('Erreur devis PDF: ' + e.stack);
    return { success: false, error: e.message };
  }
}

/**
 * Envoie l'identifiant unique et un lien d'accès à l'espace client pour un nouveau client.
 * @param {string} email Adresse email du client.
 * @param {string} nom Nom du client.
 * @param {string} clientId Identifiant unique attribué.
 */
function envoyerIdentifiantAccesClient(email, nom, clientId) {
  try {
    if (!email || !clientId) return;
    const logoBlock = getLogoEmailBlockHtml();
    let lienGestion = ScriptApp.getService().getUrl() + '?page=gestion';
    let expirationTexte = '';
    try {
      const lien = generateSignedClientLink(email);
      if (lien && lien.url) {
        lienGestion = lien.url;
        if (lien.exp) {
          const dateExpiration = new Date(lien.exp * 1000);
          expirationTexte = ` (valable jusqu'au ${dateExpiration.toLocaleString('fr-FR')})`;
        }
      }
    } catch (err) {
      Logger.log(`Avertissement: échec de génération du lien signé pour ${email}: ${err}`);
    }
    const urlBase = ScriptApp.getService().getUrl();
    let supportPhone = '';
    try {
      supportPhone = String(getSecret('TELEPHONE_ENTREPRISE') || '').trim();
    } catch (_err) {
      try {
        supportPhone = String(getSecret('SUPPORT_PHONE') || '').trim();
      } catch (_err2) {
        supportPhone = '';
      }
    }
    const supportLine = supportPhone
      ? `Besoin d'un coup de main&nbsp;? Écrivez-nous à <a href="mailto:${EMAIL_ENTREPRISE}">${EMAIL_ENTREPRISE}</a> ou contactez le ${supportPhone}.`
      : `Besoin d'un coup de main&nbsp;? Écrivez-nous à <a href="mailto:${EMAIL_ENTREPRISE}">${EMAIL_ENTREPRISE}</a>.`;
    const corpsHtml = [
      `<div style="font-family: Montserrat, sans-serif; color: #333;">`,
      logoBlock,
      `<h1 style="color: #8e44ad;">Bienvenue dans votre espace client ${NOM_ENTREPRISE}</h1>`,
      `<p>Bonjour ${nom || 'cher client'},</p>`,
      `<p>Votre compte client vient d'être activé.</p>`,
      `<p>Pour accéder à votre espace&nbsp;:</p>`,
      `<ul style="padding-left: 20px; color: #333;">`,
      `<li>connectez-vous via <a href="${lienGestion}">ce lien sécurisé</a> pour créer ou mettre à jour votre mot de passe${expirationTexte};</li>`,
      `<li>explorez le calendrier interactif pour vérifier les disponibilités et planifier vos réservations&nbsp;;</li>`,
      `<li>ajoutez vos prestations au panier, validez en quelques clics, puis retrouvez vos confirmations et factures dans la rubrique &laquo;&nbsp;Mes documents&nbsp;&raquo;.</li>`,
      `</ul>`,
      `<p>Tout est pensé pour rester clair, fluide et conforme à notre charte (palette ELS et police Montserrat) afin que vous repériez immédiatement les zones clés&nbsp;: calendrier, panier et accès à l'espace client.</p>`,
      `<p>Votre identifiant client est&nbsp;: <strong>${clientId}</strong>. Gardez-le à portée de main pour nos échanges.</p>`,
      `<p>${supportLine}</p>`,
      `<p>Vous pouvez également vous connecter depuis <a href="${urlBase}?page=gestion">${urlBase}?page=gestion</a> en renseignant votre adresse email (${email}).</p>`,
      `<p>À très vite sur la plateforme ${NOM_ENTREPRISE}&nbsp;!</p>`,
      `<p>Bien cordialement,<br>L'équipe ${NOM_ENTREPRISE}</p>`,
      `</div>`
    ].join('');

    MailApp.sendEmail({
      to: email,
      subject: `Bienvenue dans votre espace client - ${NOM_ENTREPRISE}`,
      htmlBody: corpsHtml,
      replyTo: EMAIL_ENTREPRISE
    });
  } catch (e) {
    Logger.log(`Erreur lors de l'envoi de l'identifiant client à ${email}: ${e}`);
  }
}

/**
 * Envoie un email de confirmation de réservation au client.
 */
function notifierClientConfirmation(email, nom, reservations) {
    try {
        if (!email || !reservations || reservations.length === 0) return;
        const logoBlock = getLogoEmailBlockHtml();
        let corpsHtml = `
            <div style="font-family: Montserrat, sans-serif; color: #333;">
                ${logoBlock}
                <h1>Confirmation de votre réservation</h1>
                <p>Bonjour ${nom},</p>
                <p>Nous avons le plaisir de vous confirmer la réservation des tournées suivantes :</p>
                <ul>
                    ${reservations.map(r => `<li>Le <strong>${r.date} à ${r.time}</strong> pour un montant de ${r.price.toFixed(2)} €</li>`).join('')}
                </ul>
                <p>Merci de votre confiance.</p>
                <p>L'équipe ${NOM_ENTREPRISE}</p>
            </div>
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
