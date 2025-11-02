// =================================================================
//                      LOGIQUE DE L'ESPACE CLIENT
// =================================================================
// Description: Fonctions qui alimentent l'Espace Client, permettant
//              de visualiser, modifier et déplacer ses réservations.
// =================================================================

/**
 * Valide si un client existe par son email et retourne ses infos de base.
 * @param {string} emailClient L'e-mail à vérifier.
 * @returns {Object} Un objet indiquant le succès et les informations du client si trouvé.
 */
function validerClientParEmail(emailClient, exp, sig) {
  try {
    const email = assertClient(emailClient, exp, sig);
    const cacheKey = `login_fail_${email}`;
    if (CLIENT_PORTAL_ATTEMPT_LIMIT_ENABLED) {
      const cache = CacheService.getScriptCache();
      const attempts = parseInt(cache.get(cacheKey) || '0', 10);
      if (attempts >= CLIENT_PORTAL_MAX_ATTEMPTS) {
        return { success: false, error: "Trop de tentatives, réessayez plus tard." };
      }
    }

    const infosClient = obtenirInfosClientParEmail(email);

    if (infosClient) {
      if (CLIENT_PORTAL_ATTEMPT_LIMIT_ENABLED) {
        CacheService.getScriptCache().remove(cacheKey);
      }
      return { success: true, client: { nom: infosClient.nom } };
    } else {
      if (CLIENT_PORTAL_ATTEMPT_LIMIT_ENABLED) {
        const cache = CacheService.getScriptCache();
        const attempts = parseInt(cache.get(cacheKey) || '0', 10) + 1;
        cache.put(cacheKey, String(attempts), 3600);
        logFailedLogin(email, 'N/A');
        if (attempts >= CLIENT_PORTAL_MAX_ATTEMPTS) {
          return { success: false, error: "Trop de tentatives, réessayez plus tard." };
        }
      }
      return { success: false, error: "Aucun client trouvé avec cette adresse e-mail." };
    }
  } catch (e) {
    Logger.log(`Erreur dans validerClientParEmail pour ${emailClient}: ${e.stack}`);
    return { success: false, error: e.message || "Une erreur serveur est survenue." };
  }
}

/**
 * Génère un identifiant opaque à partir de l'email.
 * @param {string} email Email du client.
 * @returns {string} Identifiant hexadécimal.
 */
function genererIdentifiantClient(email) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(email).trim().toLowerCase());
  return digest.map(b => ("0" + (b & 0xff).toString(16)).slice(-2)).join("");
}

/**
 * Retourne un lien direct (signé si possible) vers l'espace client.
 * @param {string} emailClient
 * @returns {{success:boolean,url?:string,error?:string}}
 */
function client_getPortalLink(emailClient) {
  try {
    const email = String(emailClient || '').trim().toLowerCase();
    if (!email) {
      return { success: false, error: 'EMAIL_REQUIRED' };
    }
    try {
      const lien = generateSignedClientLink(email);
      if (lien && lien.url) {
        return { success: true, url: lien.url, exp: lien.exp };
      }
    } catch (err) {
      Logger.log(`client_getPortalLink: fallback pour ${email}: ${err}`);
      // Fallback handled below.
    }
    const baseUrl = (typeof CLIENT_PORTAL_BASE_URL !== 'undefined' && CLIENT_PORTAL_BASE_URL)
      ? CLIENT_PORTAL_BASE_URL
      : (ScriptApp.getService().getUrl() || '');
    if (!baseUrl) {
      return { success: false, error: 'BASE_URL_UNAVAILABLE' };
    }
    const url = `${baseUrl}?page=gestion&email=${encodeURIComponent(email)}`;
    return { success: true, url: url };
  } catch (e) {
    Logger.log(`Erreur dans client_getPortalLink pour ${emailClient}: ${e.stack}`);
    return { success: false, error: e.message || 'INTERNAL_ERROR' };
  }
}

/**
 * Recherche un client via son identifiant opaque.
 * @param {string} identifiant Jeton opaque du client.
 * @returns {Object|null} Informations du client si trouvé.
 */
function rechercherClientParIdentifiant(identifiant) {
  try {
    if (typeof CLIENT_SESSION_OPAQUE_ID_ENABLED === 'undefined' || !CLIENT_SESSION_OPAQUE_ID_ENABLED) {
      return null;
    }
    if (!identifiant) return null;
    const feuilleClients = SpreadsheetApp.openById(getSecret('ID_FEUILLE_CALCUL')).getSheetByName(SHEET_CLIENTS);
    if (!feuilleClients) return null;
    const donnees = feuilleClients.getDataRange().getValues();
    const enTetes = donnees[0];
    const idxEmail = enTetes.indexOf('Email');
    const idxNom = enTetes.indexOf('Raison Sociale');
    const idxAdresse = enTetes.indexOf('Adresse');
    const idxSiret = enTetes.indexOf('SIRET');
    for (let i = 1; i < donnees.length; i++) {
      const email = String(donnees[i][idxEmail]).trim();
      if (genererIdentifiantClient(email) === identifiant) {
        return {
          email: email,
          nom: donnees[i][idxNom] || '',
          adresse: donnees[i][idxAdresse] || '',
          siret: donnees[i][idxSiret] || ''
        };
      }
    }
    return null;
  } catch (e) {
    Logger.log(`Erreur dans rechercherClientParIdentifiant: ${e.stack}`);
    return null;
  }
}

/**
 * Récupère toutes les réservations futures pour un client donné.
 * @param {string} emailClient L'e-mail du client.
 * @returns {Object} Un objet contenant les réservations futures du client.
 */
function obtenirReservationsClient(emailClient, exp, sig) {
  try {
    const emailNorm = assertClient(emailClient, exp, sig);
    const feuille = SpreadsheetApp.openById(getSecret('ID_FEUILLE_CALCUL')).getSheetByName(SHEET_FACTURATION);
    const indices = obtenirIndicesEnTetes(feuille, ["Date", "Client (Email)", "Event ID", "Détails", "Client (Raison S. Client)", "ID Réservation", "Montant"]);
    
    const donnees = feuille.getDataRange().getValues();
    const maintenant = new Date();

    const reservations = donnees.slice(1).map(ligne => {
      try {
        if (String(ligne[indices["Client (Email)"]]).trim().toLowerCase() !== emailNorm) {
          return null;
        }
        
        const dateSheet = new Date(ligne[indices["Date"]]);
        if (isNaN(dateSheet.getTime()) || dateSheet < maintenant) {
          return null;
        }

        const eventId = String(ligne[indices["Event ID"]]).trim();
        let dateDebut = dateSheet;
        let dateFin;

        if (eventId) {
          try {
            const evenementRessource = Calendar.Events.get(getSecret('ID_CALENDRIER'), eventId);
            dateDebut = new Date(evenementRessource.start.dateTime || evenementRessource.start.date);
            dateFin = new Date(evenementRessource.end.dateTime || evenementRessource.end.date);
          } catch (err) {
            Logger.log(`Avertissement: L'événement Calendar (ID: ${eventId}) pour la réservation ${ligne[indices["ID Réservation"]]} est introuvable. La durée sera estimée.`);
          }
        }
        
        const details = String(ligne[indices["Détails"]]);
        const matchTotal = details.match(/(\d+)\s*arrêt\(s\)\s*total\(s\)/);
        const matchSup = details.match(/(\d+)\s*arrêt\(s\)\s*sup/);
        const totalStops = matchTotal ? parseInt(matchTotal[1], 10) : (matchSup ? parseInt(matchSup[1], 10) + 1 : 1);
        const retour = details.includes('retour: oui');
        const nbSupp = Math.max(0, totalStops - 1);

        if (!dateFin) {
            const totalArretsCalcules = nbSupp + (retour ? 1 : 0);
            const dureeEstimee = DUREE_BASE + (totalArretsCalcules * DUREE_ARRET_SUP);
            dateFin = new Date(dateDebut.getTime() + dureeEstimee * 60000);
        }

        const totalArretsCalculesPourKm = nbSupp + (retour ? 1 : 0);
        const km = KM_BASE + (totalArretsCalculesPourKm * KM_ARRET_SUP);

        return {
          id: ligne[indices["ID Réservation"]],
          eventId: eventId,
          start: dateDebut.toISOString(),
          end: dateFin.toISOString(),
          details: details,
          clientName: ligne[indices["Client (Raison S. Client)"]],
          amount: parseFloat(ligne[indices["Montant"]]) || 0,
          resident: (indices["Resident"] !== undefined && indices["Resident"] !== -1) ? (ligne[indices["Resident"]] === true) : false,
          km: km
        };

      } catch (e) { 
        Logger.log(`Erreur de traitement d'une ligne de réservation pour ${emailClient}: ${e.toString()}`);
        return null; 
      }
    }).filter(Boolean);
      
    return { success: true, reservations: reservations };
  } catch (e) {
    Logger.log(`Erreur critique dans obtenirReservationsClient pour ${emailClient}: ${e.stack}`);
    return { success: false, error: e.message };
  }
}

/**
 * Calcule le chiffre d'affaires futur pour un client donné.
 * @param {string} emailClient L'e-mail du client.
 * @returns {number} Le total des montants à venir.
 */
function calculerCAEnCoursClient(emailClient, exp, sig) {
  try {
    if (!CA_EN_COURS_ENABLED) return 0;
    const email = assertClient(emailClient, exp, sig);

    const feuille = SpreadsheetApp.openById(getSecret('ID_FEUILLE_CALCUL')).getSheetByName(SHEET_FACTURATION);
    if (!feuille) return 0;
    const indices = obtenirIndicesEnTetes(feuille, ['Date', 'Client (Email)', 'Montant']);
    const lignes = feuille.getDataRange().getValues();
    const aujourdHui = new Date();
    let total = 0;

    lignes.slice(1).forEach(ligne => {
      const emailLigne = String(ligne[indices['Client (Email)']]).trim().toLowerCase();
      if (emailLigne !== email) return;
      const dateResa = new Date(ligne[indices['Date']]);
      if (isNaN(dateResa.getTime()) || dateResa < aujourdHui) return;
      total += parseFloat(ligne[indices['Montant']]) || 0;
    });

    return total;
  } catch (e) {
    Logger.log(`Erreur dans calculerCAEnCoursClient pour ${emailClient}: ${e.stack}`);
    return 0;
  }
}


/**
 * Recherche les métadonnées d'une facture via son identifiant de PDF Drive.
 * @param {string} idPdf Identifiant du fichier PDF dans Drive.
 * @returns {{numero:string,email:string,idPdf:string,url:string,dateISO:(string|null),montant:(number|null)}|null}
 */
function rechercherFactureParId(idPdf) {
  const identifiant = String(idPdf || '').trim();
  if (!identifiant) return null;
  if (!/^[A-Za-z0-9_-]{10,}$/.test(identifiant)) {
    throw new Error('Identifiant PDF invalide.');
  }

  const ss = SpreadsheetApp.openById(getSecret('ID_FEUILLE_CALCUL'));
  const feuilles = BILLING_MULTI_SHEET_ENABLED
    ? ss.getSheets().filter(f => f.getName().startsWith('Facturation'))
    : [ss.getSheetByName(SHEET_FACTURATION)];
  if (!feuilles.length || feuilles.some(f => !f)) {
    throw new Error("La feuille 'Facturation' est introuvable.");
  }

  for (const feuille of feuilles) {
    const header = feuille.getRange(1, 1, 1, Math.max(1, feuille.getLastColumn())).getValues()[0];
    const idx = {
      email: header.indexOf('Client (Email)'),
      numero: header.indexOf('N° Facture'),
      idPdf: header.indexOf('ID PDF'),
      date: header.indexOf('Date'),
      montant: header.indexOf('Montant')
    };
    if (Object.values(idx).some(i => i === -1)) {
      throw new Error("Colonnes requises absentes (Date, Client (Email), N° Facture, ID PDF, Montant).");
    }

    const data = feuille.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (String(row[idx.idPdf] || '').trim() !== identifiant) continue;

      const email = String(row[idx.email] || '').trim().toLowerCase();
      const numero = String(row[idx.numero] || '').trim();
      const dateVal = new Date(row[idx.date]);
      const montant = parseFloat(row[idx.montant]);

      let url;
      try {
        url = DriveApp.getFileById(identifiant).getUrl();
      } catch (driveErr) {
        throw new Error('Fichier PDF introuvable ou inaccessible.');
      }

      return {
        numero: numero,
        email: email,
        idPdf: identifiant,
        url: url,
        dateISO: isNaN(dateVal) ? null : dateVal.toISOString(),
        montant: Number.isFinite(montant) ? montant : null
      };
    }
  }

  return null;
}

/**
 * Récupère les factures (générées) pour un client.
 * @param {string} emailClient L'e-mail du client.
 * @returns {Object} success + liste des factures { numero, dateISO, montant, url, idPdf }.
 */
function obtenirFacturesPourClient(emailClient, exp, sig) {
  try {
    const emailNorm = assertClient(emailClient, exp, sig);
    const ss = SpreadsheetApp.openById(getSecret('ID_FEUILLE_CALCUL'));
    const feuilles = BILLING_MULTI_SHEET_ENABLED
      ? ss.getSheets().filter(f => f.getName().startsWith('Facturation'))
      : [ss.getSheetByName(SHEET_FACTURATION)];
    if (!feuilles.length || feuilles.some(f => !f)) throw new Error("La feuille 'Facturation' est introuvable.");
    const facturesMap = new Map(); // Garantit une facture unique par ID PDF.
    feuilles.forEach(feuille => {
      const header = feuille.getRange(1, 1, 1, feuille.getLastColumn()).getValues()[0];
      const idx = {
        date: header.indexOf('Date'),
        email: header.indexOf('Client (Email)'),
        numero: header.indexOf('N° Facture'),
        idPdf: header.indexOf('ID PDF'),
        montant: header.indexOf('Montant')
      };
      if (Object.values(idx).some(i => i === -1)) throw new Error("Colonnes requises absentes (Date, Client (Email), N° Facture, ID PDF, Montant).");
      const data = feuille.getDataRange().getValues().slice(1);
      data.forEach(row => {
        try {
          const email = String(row[idx.email] || '').trim().toLowerCase();
          if (email !== emailNorm) return;
          const numero = String(row[idx.numero] || '').trim();
          const idPdf = String(row[idx.idPdf] || '').trim();
          if (!numero || !idPdf) return;
          const dateVal = new Date(row[idx.date]);
          const dateISO = isNaN(dateVal) ? null : dateVal.toISOString();
          const montantVal = parseFloat(row[idx.montant]);
          const montant = Number.isFinite(montantVal) ? montantVal : 0;
          const dejaVue = facturesMap.get(idPdf);
          if (dejaVue) {
            if (dateISO) {
              const existingDate = dejaVue.dateISO ? new Date(dejaVue.dateISO) : null;
              if (!existingDate || new Date(dateISO) > existingDate) {
                dejaVue.dateISO = dateISO;
              }
            }
            if (montant !== 0) {
              dejaVue.montant = montant;
            }
            if (numero && !dejaVue.numero) {
              dejaVue.numero = numero;
            }
            return;
          }
          const url = DriveApp.getFileById(idPdf).getUrl();
          facturesMap.set(idPdf, {
            numero: numero,
            dateISO: dateISO,
            montant: montant,
            url: url,
            idPdf: idPdf
          });
        } catch (e) {
          // ignore ligne invalide
        }
      });
    });
    const factures = Array.from(facturesMap.values());
    factures.sort((a, b) => new Date(b.dateISO || 0) - new Date(a.dateISO || 0));
    return { success: true, factures: factures };
  } catch (e) {
    Logger.log('Erreur dans obtenirFacturesPourClient: ' + e.stack);
    return { success: false, error: e.message };
  }
}

/**
 * Renvoie le lien de téléchargement d'une facture pour un client donné.
 * @param {string} idPdf Identifiant du fichier PDF à récupérer.
 * @param {string} emailClient Email du client demandeur.
 */
function obtenirLienFactureParIdClient(idPdf, emailClient, exp, sig) {
  try {
    const emailNorm = assertClient(emailClient, exp, sig);
    const facture = rechercherFactureParId(idPdf);
    if (!facture) {
      throw new Error('Facture introuvable.');
    }
    if (facture.email !== emailNorm) {
      throw new Error('Facture non associée à votre compte.');
    }
    return {
      success: true,
      url: facture.url,
      numero: facture.numero,
      dateISO: facture.dateISO,
      montant: facture.montant
    };
  } catch (e) {
    Logger.log('Erreur dans obtenirLienFactureParIdClient: ' + e.stack);
    return { success: false, error: e.message };
  }
}

/**
 * Envoie une facture spécifique au client par e-mail (pièce jointe PDF).
 * @param {string} emailClient L'e-mail de destination.
 * @param {string} numeroFacture Le numéro de facture à envoyer.
 */
function envoyerFactureClient(emailClient, numeroFacture, exp, sig) {
  try {
    const emailNorm = assertClient(emailClient, exp, sig);
    if (!numeroFacture) throw new Error('Paramètres manquants.');
    const ss = SpreadsheetApp.openById(getSecret('ID_FEUILLE_CALCUL'));
    const feuilles = BILLING_MULTI_SHEET_ENABLED
      ? ss.getSheets().filter(f => f.getName().startsWith('Facturation'))
      : [ss.getSheetByName(SHEET_FACTURATION)];
    if (!feuilles.length || feuilles.some(f => !f)) throw new Error("La feuille 'Facturation' est introuvable.");
    let row = null;
    let idx = null;
    for (const feuille of feuilles) {
      const header = feuille.getRange(1, 1, 1, feuille.getLastColumn()).getValues()[0];
      idx = {
        email: header.indexOf('Client (Email)'),
        numero: header.indexOf('N° Facture'),
        idPdf: header.indexOf('ID PDF'),
        montant: header.indexOf('Montant')
      };
      if (Object.values(idx).some(i => i === -1)) throw new Error("Colonnes requises absentes (Client (Email), N° Facture, ID PDF, Montant).");
      const rows = feuille.getDataRange().getValues().slice(1);
      row = rows.find(r => String(r[idx.numero]).trim() === String(numeroFacture).trim() && String(r[idx.email]).trim().toLowerCase() === emailNorm);
      if (row) break;
    }
    if (!row) throw new Error('Facture introuvable pour ce client.');
    const idPdf = String(row[idx.idPdf] || '').trim();
    if (!idPdf) throw new Error('Aucun fichier PDF associé à cette facture.');
    const montant = parseFloat(row[idx.montant]) || null;
    const fichier = DriveApp.getFileById(idPdf);
    const pdfBlob = fichier.getAs(MimeType.PDF).setName(`${String(row[idx.numero]).trim()}.pdf`);
    const sujet = `[${NOM_ENTREPRISE}] Facture ${String(row[idx.numero]).trim()}`;
    const logoBlock = getLogoEmailBlockHtml();
    const corps = [
      logoBlock,
      `<p>Veuillez trouver ci-joint votre facture <strong>${String(row[idx.numero]).trim()}</strong>${montant !== null ? ` d'un montant de <strong>${montant.toFixed(2)} €</strong>` : ''}.</p>`,
      `<p>Cordiales salutations,<br>${NOM_ENTREPRISE}</p>`
    ].filter(Boolean).join('');
    MailApp.sendEmail({ to: emailNorm, subject: sujet, htmlBody: corps, attachments: [pdfBlob], replyTo: EMAIL_ENTREPRISE });
  return { success: true };
  } catch (e) {
    Logger.log('Erreur dans envoyerFactureClient: ' + e.stack);
    return { success: false, error: e.message };
  }
}

/**
 * Met à jour les détails (nombre d'arrêts, prix, durée) d'une réservation existante.
 * @param {string} idReservation L'ID unique de la réservation à modifier.
 * @param {number} totalStops Le nouveau nombre d'arrêt(s) total(s).
 * @returns {Object} Un résumé de l'opération.
 */
function mettreAJourDetailsReservation(idReservation, totalStops, emailClient, exp, sig) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return { success: false, error: "Le système est occupé, veuillez réessayer." };

  try {
    const emailNorm = emailClient ? assertClient(emailClient, exp, sig) : null;
    const idNorm = assertReservationId(idReservation);
    const feuille = SpreadsheetApp.openById(getSecret('ID_FEUILLE_CALCUL')).getSheetByName(SHEET_FACTURATION);
    const enTete = feuille.getRange(1, 1, 1, feuille.getLastColumn()).getValues()[0];
    const indices = {
      idResa: enTete.indexOf("ID Réservation"), idEvent: enTete.indexOf("Event ID"),
      details: enTete.indexOf("Détails"), email: enTete.indexOf("Client (Email)"),
      montant: enTete.indexOf("Montant"), date: enTete.indexOf("Date")
    };
    if (Object.values(indices).some(i => i === -1)) throw new Error("Colonnes requises introuvables.");

    const donnees = feuille.getDataRange().getValues();
    const indexLigne = donnees.findIndex(row => String(row[indices.idResa]).trim() === idNorm);
    if (indexLigne === -1) return { success: false, error: "Réservation introuvable." };

    const ligneDonnees = donnees[indexLigne];
    const idEvenement = String(ligneDonnees[indices.idEvent]).trim();
    const detailsAnciens = String(ligneDonnees[indices.details]);
    const emailFeuille = String(ligneDonnees[indices.email]).trim().toLowerCase();
    if (emailNorm && emailFeuille !== emailNorm) return { success: false, error: "Accès non autorisé." };

    let ressourceEvenement = null;
    let dateDebutOriginale = new Date(ligneDonnees[indices.date]); // Fallback sur la date du Sheet

    try {
      if (idEvenement) {
        ressourceEvenement = Calendar.Events.get(getSecret('ID_CALENDRIER'), idEvenement);
        dateDebutOriginale = new Date(ressourceEvenement.start.dateTime);
      }
    } catch (e) {
      Logger.log(`Événement ${idEvenement} introuvable pour modification. Seule la feuille de calcul sera mise à jour.`);
      ressourceEvenement = null;
    }
    
    const dateEvenement = formaterDateEnYYYYMMDD(dateDebutOriginale);
    const heureEvenement = formaterDateEnHHMM(dateDebutOriginale);
    const retourPharmacie = detailsAnciens.includes('retour: oui');

    const clientPourCalcul = obtenirInfosClientParEmail(emailNorm || emailFeuille);
    const { prix: nouveauPrix, duree: nouvelleDuree, details: nouveauxDetails } = calculerPrixEtDureeServeur(totalStops, retourPharmacie, dateEvenement, heureEvenement, clientPourCalcul);
    
    // Si l'événement existe, on le met à jour
    if (ressourceEvenement) {
      const nouvelleDateFin = new Date(dateDebutOriginale.getTime() + nouvelleDuree * 60000);
      const ressourceMaj = {
        end: { dateTime: nouvelleDateFin.toISOString() },
        description: ressourceEvenement.description
          .replace(/Total:.*€/, `Total: ${nouveauPrix.toFixed(2)} €`)
          .replace(/Arrêts (?:suppl|totaux):.*\n/, `Arrêts totaux: ${totalStops}, Retour: ${retourPharmacie ? 'Oui' : 'Non'}\n`)
      };
      Calendar.Events.patch(ressourceMaj, getSecret('ID_CALENDRIER'), idEvenement);
    }

    // On met TOUJOURS à jour la feuille de calcul
    feuille.getRange(indexLigne + 1, indices.details + 1).setValue(nouveauxDetails);
    feuille.getRange(indexLigne + 1, indices.montant + 1).setValue(nouveauPrix);

    logActivity(idNorm, emailNorm || emailFeuille, `Modification: ${totalStops} arrêts totaux.`, nouveauPrix, "Modification");
    return { success: true };

  } catch (e) {
    Logger.log(`Erreur dans mettreAJourDetailsReservation: ${e.stack}`);
    return { success: false, error: e.message };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Déplace une réservation à une nouvelle date/heure.
 * @param {string} idReservation L'ID de la réservation à déplacer.
 * @param {string} nouvelleDate La nouvelle date.
 * @param {string} nouvelleHeure La nouvelle heure.
 * @returns {Object} Un résumé de l'opération.
 */
function replanifierReservation(idReservation, nouvelleDate, nouvelleHeure, emailClient, exp, sig) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return { success: false, error: "Le systeme est occupe." };

  try {
    const emailNorm = emailClient ? assertClient(emailClient, exp, sig) : null;
    const idNorm = assertReservationId(idReservation);
    const feuille = SpreadsheetApp.openById(getSecret('ID_FEUILLE_CALCUL')).getSheetByName(SHEET_FACTURATION);
    const enTete = feuille.getRange(1, 1, 1, feuille.getLastColumn()).getValues()[0];
    const headerValues = enTete.map(function (value) { return String(value || '').trim(); });
    const headerIndex = headerValues.reduce(function (acc, value, idx) {
      if (!acc.hasOwnProperty(value)) {
        acc[value] = idx;
      }
      if (typeof value === 'string' && value.normalize) {
        const asciiValue = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (!acc.hasOwnProperty(asciiValue)) {
          acc[asciiValue] = idx;
        }
      }
      return acc;
    }, {});
    const getIndex = function (candidates) {
      for (var i = 0; i < candidates.length; i++) {
        if (headerIndex.hasOwnProperty(candidates[i])) {
          return headerIndex[candidates[i]];
        }
      }
      return -1;
    };
    const indices = {
      idResa: getIndex(["ID Réservation", "ID R?servation", "ID Reservation"]),
      idEvent: getIndex(["Event ID"]),
      email: getIndex(["Client (Email)"]),
      date: getIndex(["Date"]),
      montant: getIndex(["Montant"]),
      details: getIndex(["Détails", "D?tails", "Details"]),
      resident: getIndex(["Resident"]),
      type: getIndex(["Type"]),
      tourneeOfferte: getIndex(["Tournée Offerte Appliquée", "Tournée Offerte Appliqu?e", "Tournee Offerte Appliquee"]),
      typeRemise: getIndex(["Type Remise Appliquée", "Type Remise Appliqu?e", "Type Remise Appliquee"]),
      valeurRemise: getIndex(["Valeur Remise Appliquée", "Valeur Remise Appliqu?e", "Valeur Remise Appliquee"])
    };
    const colonnesRequises = ['idResa', 'idEvent', 'email', 'date', 'montant', 'details'];
    if (colonnesRequises.some(function (cle) { return indices[cle] === -1; })) {
      throw new Error("Colonnes requises introuvables.");
    }
    if (!nouvelleHeure) {
      return { success: false, error: "Merci d'indiquer un horaire valide." };
    }

    const donnees = feuille.getDataRange().getValues();
    const indexLigne = donnees.findIndex(function (row) {
      return String(row[indices.idResa]).trim() === idNorm;
    });
    if (indexLigne === -1) return { success: false, error: "Reservation introuvable." };

    const ligneDonnees = donnees[indexLigne];
    const estResident = indices.resident !== -1 ? ligneDonnees[indices.resident] === true : false;
    const idEvenementAncien = String(ligneDonnees[indices.idEvent]).trim();
    const emailFeuille = String(ligneDonnees[indices.email]).trim().toLowerCase();
    if (emailNorm && emailFeuille !== emailNorm) return { success: false, error: "Acces non autorise." };
    const details = String(ligneDonnees[indices.details]);

    const matchTotal = details.match(/(\d+)\s*arrêt\(s\)\s*total\(s\)/);
    const matchSup = matchTotal ? null : details.match(/(\d+)\s*arrêt\(s\)\s*sup/);
    const arrets = matchTotal
      ? Math.max(0, parseInt(matchTotal[1], 10) - 1)
      : matchSup
        ? parseInt(matchSup[1], 10)
        : 0;
    const retour = details.includes('retour: oui');
    const dureeCalculee = DUREE_BASE + ((arrets + (retour ? 1 : 0)) * DUREE_ARRET_SUP);

    const creneauxDisponibles = obtenirCreneauxDisponiblesPourDate(nouvelleDate, dureeCalculee, idEvenementAncien);
    const residentBypass = estResident && typeof RESIDENT_REPLAN_ALLOW_ANY_SLOT !== 'undefined' && RESIDENT_REPLAN_ALLOW_ANY_SLOT === true;
    if (!Array.isArray(creneauxDisponibles) || creneauxDisponibles.length === 0) {
      if (!residentBypass) {
        return { success: false, error: "Aucun créneau disponible pour la plage demandée." };
      }
    } else if (creneauxDisponibles.indexOf(nouvelleHeure) === -1) {
      if (!residentBypass) {
        return { success: false, error: "Ce créneau n'est plus disponible." };
      }
    }

    const [annee, mois, jour] = nouvelleDate.split('-').map(Number);
    const [heure, minute] = nouvelleHeure.split('h').map(Number);
    const nouvelleDateDebut = new Date(annee, mois - 1, jour, heure, minute);
    const nouvelleDateFin = new Date(nouvelleDateDebut.getTime() + dureeCalculee * 60000);
    const totalStops = Math.max(1, arrets + 1);
    const infosTournee = calculerInfosTourneeBase(totalStops, retour, nouvelleDate, nouvelleHeure);

    const tourneeOfferte = indices.tourneeOfferte !== -1 ? ligneDonnees[indices.tourneeOfferte] === true : false;
    const typeRemise = indices.typeRemise !== -1 ? String(ligneDonnees[indices.typeRemise] || '').trim() : '';
    const valeurRemise = indices.valeurRemise !== -1 ? Number(ligneDonnees[indices.valeurRemise]) || 0 : 0;

    let nouveauMontant = infosTournee.prix;
    let nouveauType = infosTournee.typeCourse;
    const nouveauDetails = infosTournee.details;

    if (estResident && typeof FORFAIT_RESIDENT !== 'undefined') {
      nouveauMontant = nouveauType === 'Urgent'
        ? FORFAIT_RESIDENT.URGENCE_PRICE
        : FORFAIT_RESIDENT.STANDARD_PRICE;
    }

    if (tourneeOfferte) {
      nouveauMontant = 0;
    } else if (typeRemise === 'Pourcentage' && valeurRemise > 0) {
      nouveauMontant = Math.max(0, nouveauMontant * (1 - valeurRemise / 100));
    } else if (typeRemise === 'Montant Fixe' && valeurRemise > 0) {
      nouveauMontant = Math.max(0, nouveauMontant - valeurRemise);
    }

    try {
      if (idEvenementAncien) Calendar.Events.remove(getSecret('ID_CALENDRIER'), idEvenementAncien);
    } catch (e) {
      Logger.log(`L'ancien événement ${idEvenementAncien} n'a pas pu être supprimé (il n'existait probablement plus).`);
    }

    const clientInfos = obtenirInfosClientParEmail(emailNorm || emailFeuille) || {};
    const nomClient = clientInfos.nom || (emailNorm || emailFeuille);
    const titreEvenement = `Réservation ${NOM_ENTREPRISE} - ${nomClient}`;
    const descriptionEvenement = [
      `Client: ${nomClient} (${emailNorm || emailFeuille})`,
      `ID Réservation: ${idNorm}`,
      `Détails: ${nouveauDetails}`,
      `Total: ${Number(nouveauMontant).toFixed(2)} €`,
      'Note: Déplacé par admin.'
    ].join('\n');
    const nouvelEvenement = CalendarApp.getCalendarById(getSecret('ID_CALENDRIER')).createEvent(
      titreEvenement,
      nouvelleDateDebut,
      nouvelleDateFin,
      { description: descriptionEvenement }
    );

    if (!nouvelEvenement) {
      throw new Error("La création du nouvel événement dans le calendrier a échoué.");
    }

    feuille.getRange(indexLigne + 1, indices.date + 1).setValue(nouvelleDateDebut);
    feuille.getRange(indexLigne + 1, indices.idEvent + 1).setValue(nouvelEvenement.getId());
    if (indices.montant !== -1) {
      feuille.getRange(indexLigne + 1, indices.montant + 1).setValue(nouveauMontant);
    }
    if (indices.details !== -1) {
      feuille.getRange(indexLigne + 1, indices.details + 1).setValue(nouveauDetails);
    }
    if (indices.type !== -1) {
      feuille.getRange(indexLigne + 1, indices.type + 1).setValue(nouveauType);
    }

    logActivity(idNorm, emailNorm || emailFeuille, `Déplacement au ${nouvelleDate} à ${nouvelleHeure}.`, nouveauMontant, "Modification");
    return { success: true };

  } catch (e) {
    Logger.log(`Erreur dans replanifierReservation: ${e.stack}`);
    return { success: false, error: e.message };
  } finally {
    lock.releaseLock();
  }
}

