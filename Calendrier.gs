// =================================================================
//                      LOGIQUE DU CALENDRIER
// =================================================================
// Description: Calcule les créneaux disponibles en croisant les
//              données de Google Calendar et les blocages manuels.
// =================================================================

const __CACHE_JOURS_FERIES_FRANCE = Object.create(null);
const __ID_SUFFIX_SEPARATOR = '@';

/**
 * Calcule la date du dimanche de Pâques pour une année donnée (algorithme de Butcher).
 * @param {number} annee
 * @returns {Date}
 */
function calculerDatePaques(annee) {
  const a = annee % 19;
  const b = Math.floor(annee / 100);
  const c = annee % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mois = Math.floor((h + l - 7 * m + 114) / 31); // 3 = mars, 4 = avril
  const jour = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(annee, mois - 1, jour);
}

/**
 * Retourne un nouvel objet Date en ajoutant un nombre de jours.
 * @param {Date} date
 * @param {number} jours
 * @returns {Date}
 */
function ajouterJours(date, jours) {
  const resultat = new Date(date);
  resultat.setDate(resultat.getDate() + jours);
  return resultat;
}

/**
 * Génère (et met en cache) l'ensemble des jours fériés français pour une année.
 * @param {number} annee
 * @returns {Set<string>}
 */
function obtenirSetJoursFeriesFrance(annee) {
  if (__CACHE_JOURS_FERIES_FRANCE[annee]) {
    return __CACHE_JOURS_FERIES_FRANCE[annee];
  }

  const paques = calculerDatePaques(annee);
  const jours = [
    formaterDateEnYYYYMMDD(new Date(annee, 0, 1)),   // Jour de l'An
    formaterDateEnYYYYMMDD(new Date(annee, 4, 1)),   // Fête du Travail
    formaterDateEnYYYYMMDD(new Date(annee, 4, 8)),   // Victoire 1945
    formaterDateEnYYYYMMDD(new Date(annee, 6, 14)),  // Fête Nationale
    formaterDateEnYYYYMMDD(new Date(annee, 7, 15)),  // Assomption
    formaterDateEnYYYYMMDD(new Date(annee, 10, 1)),  // Toussaint
    formaterDateEnYYYYMMDD(new Date(annee, 10, 11)), // Armistice
    formaterDateEnYYYYMMDD(new Date(annee, 11, 25))  // Noël
  ];

  const feriesMobiles = [
    ajouterJours(paques, 1),   // Lundi de Pâques
    ajouterJours(paques, 39),  // Ascension
    ajouterJours(paques, 49),  // Pentecôte (dimanche)
    ajouterJours(paques, 50)   // Lundi de Pentecôte
  ];

  feriesMobiles.forEach(date => jours.push(formaterDateEnYYYYMMDD(date)));

  const set = new Set(jours);
  __CACHE_JOURS_FERIES_FRANCE[annee] = set;
  return set;
}

/**
 * Indique si une date correspond à un jour férié français (bloqué côté public).
 * @param {Date} dateObjet
 * @param {string} dateString
 * @returns {boolean}
 */
function estJourFerieFrancais(dateObjet, dateString) {
  const feries = obtenirSetJoursFeriesFrance(dateObjet.getFullYear());
  return feries.has(dateString);
}

/**
 * Transforme une liste d'événements Google Calendar en intervalles normalisés et les
 * filtre sur la plage fournie.
 * @param {Array} evenements
 * @param {Date} debutPlage
 * @param {Date} finPlage
 * @returns {Array<{id: string, start: Date, end: Date}>}
 */
function normaliserEvenementsPourPlage(evenements, debutPlage, finPlage) {
  if (!Array.isArray(evenements) || !debutPlage || !finPlage) {
    return [];
  }

  return evenements.map(event => {
    if (!event || !event.start || !event.end) return null;

    const startRaw = event.start.dateTime || event.start.date;
    const endRaw = event.end.dateTime || event.end.date;
    if (!startRaw || !endRaw) return null;

    const start = new Date(startRaw);
    const end = new Date(endRaw);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;

    const id = typeof event.id === 'string'
      ? event.id.split(__ID_SUFFIX_SEPARATOR)[0]
      : '';

    return { id, start, end };
  }).filter(intervalle => intervalle && intervalle.start < finPlage && intervalle.end > debutPlage);
}

/**
 * Récupère les événements du calendrier Google pour une période donnée via l'API avancée.
 * @param {Date} dateDebut La date de début de la période.
 * @param {Date} dateFin La date de fin de la période.
 * @returns {Array} Une liste d'événements du calendrier, ou un tableau vide en cas d'erreur.
 */
function obtenirEvenementsCalendrierPourPeriode(dateDebut, dateFin) {
  try {
    const evenements = Calendar.Events.list(getSecret('ID_CALENDRIER'), {
      timeMin: dateDebut.toISOString(),
      timeMax: dateFin.toISOString(),
      singleEvents: true,
      orderBy: 'startTime'
    });
    return evenements.items || [];
  } catch (e) {
    Logger.log(`ERREUR API Calendar: ${e.stack}`);
    return [];
  }
}

/**
 * Calcule les créneaux horaires disponibles pour une date et une durée spécifiques.
 * @param {string} dateString La date au format "YYYY-MM-DD".
 * @param {number} duree La durée de la course en minutes.
 * @param {string|null} idEvenementAIgnorer L'ID d'un événement à ignorer (pour la modification).
 * @param {Array|null} evenementsPrecharges Une liste d'événements déjà chargés pour optimiser.
 * @param {Array} autresCoursesPanier Les autres courses dans le panier de l'utilisateur.
 * @returns {Array<string>} Une liste de créneaux disponibles au format "HHhMM".
 */
function obtenirCreneauxDisponiblesPourDate(dateString, duree, idEvenementAIgnorer = null, evenementsPrecharges = null, autresCoursesPanier = [], email, exp, sig) {
  try {
    const sessionUser = Session.getActiveUser();
    const sessionEmail = sessionUser && typeof sessionUser.getEmail === 'function' ? sessionUser.getEmail() : '';
    const estAdmin = !!sessionEmail && sessionEmail.toLowerCase() === ADMIN_EMAIL.toLowerCase();

    const tokensProvided = email !== undefined || exp !== undefined || sig !== undefined;
    const allTokensPresent = Boolean(email) && Boolean(exp) && Boolean(sig);

    if (tokensProvided && !allTokensPresent) {
      throw new Error('Paramètres d\'authentification incomplets.');
    }

    if (typeof CLIENT_PORTAL_SIGNED_LINKS !== 'undefined' && CLIENT_PORTAL_SIGNED_LINKS && (tokensProvided || Boolean(email))) {
      if (!allTokensPresent) {
        throw new Error('Authentification requise pour consulter les créneaux.');
      }
      assertClient(email, exp, sig);
    } else if (allTokensPresent) {
      assertClient(email, exp, sig);
    }

    const [annee, mois, jour] = dateString.split('-').map(Number);
    
    const [heureDebut, minuteDebut] = HEURE_DEBUT_SERVICE.split(':').map(Number);
    const [heureFin, minuteFin] = HEURE_FIN_SERVICE.split(':').map(Number);
    const debutJournee = new Date(annee, mois - 1, jour, heureDebut, minuteDebut);
    const finJournee = new Date(annee, mois - 1, jour, heureFin, minuteFin);

    const maintenant = new Date();

    // CORRECTION : Pour les non-admins, on bloque les jours passés. Pour les admins, on ne bloque JAMAIS.
    if (!estAdmin && new Date(dateString + "T23:59:59") < maintenant) {
        return [];
    }

    const evenementsBruts = Array.isArray(evenementsPrecharges)
      ? evenementsPrecharges
      : obtenirEvenementsCalendrierPourPeriode(debutJournee, finJournee);
    const evenementsCalendrier = normaliserEvenementsPourPlage(evenementsBruts, debutJournee, finJournee);
    
    const plagesManuellementBloquees = obtenirPlagesBloqueesPourDate(debutJournee);
    
    const reservationsPanier = autresCoursesPanier.map(item => {
        const [itemHeureDebut, itemMinuteDebut] = item.startTime.split('h').map(Number);
        const dureeNumerique = parseFloat(item.duree);
        const debut = new Date(annee, mois - 1, jour, itemHeureDebut, itemMinuteDebut);
        if (isNaN(debut.getTime()) || isNaN(dureeNumerique)) { return null; }
        const fin = new Date(debut.getTime() + dureeNumerique * 60000);
        return { id: `panier-${item.id}`, start: debut, end: fin };
    }).filter(Boolean);

    const indisponibilitesNormalisees = [
      ...evenementsCalendrier,
      ...reservationsPanier,
      ...plagesManuellementBloquees.map((e, i) => ({ id: `manuel-${i}`, start: e.start, end: e.end }))
    ].filter(indispo => !isNaN(indispo.start.getTime()) && !isNaN(indispo.end.getTime()));

    const creneauxPotentiels = [];
    let heureActuelle = new Date(debutJournee);
    const idPropreAIgnorer = idEvenementAIgnorer ? idEvenementAIgnorer.split(__ID_SUFFIX_SEPARATOR)[0] : null;

    // CORRECTION : Pour les non-admins, si on est aujourd'hui, on ne propose pas de créneaux déjà passés.
    // Pour les admins, on commence toujours au début du service.
    if (!estAdmin && formaterDateEnYYYYMMDD(debutJournee) === formaterDateEnYYYYMMDD(maintenant) && heureActuelle < maintenant) {
      heureActuelle = new Date(maintenant);
      heureActuelle.setSeconds(0, 0);
      const minutes = heureActuelle.getMinutes();
      const remainder = minutes % INTERVALLE_CRENEAUX_MINUTES;
      if (remainder !== 0) {
        heureActuelle.setMinutes(minutes + (INTERVALLE_CRENEAUX_MINUTES - remainder));
      }
    }

    while (heureActuelle < finJournee) {
      const debutCreneau = new Date(heureActuelle);
      const finCreneau = new Date(debutCreneau.getTime() + duree * 60000);

      if (finCreneau > finJournee) break;
      
      let estLibre = true;
      for (const indispo of indisponibilitesNormalisees) {
        if (indispo.id === idPropreAIgnorer) continue;
        const debutIndispo = indispo.start;
        const finAvecTampon = new Date(indispo.end.getTime() + DUREE_TAMPON_MINUTES * 60000);
        if (debutCreneau < finAvecTampon && finCreneau > debutIndispo) {
          estLibre = false;
          break;
        }
      }
      
      if (estLibre) {
        creneauxPotentiels.push(debutCreneau);
      }
      
      heureActuelle.setMinutes(heureActuelle.getMinutes() + INTERVALLE_CRENEAUX_MINUTES);
    }
    
    return creneauxPotentiels.map(creneau => formaterDateEnHHMM(creneau));
    
  } catch (e) {
    Logger.log(`Erreur dans obtenirCreneauxDisponiblesPourDate pour ${dateString}: ${e.stack}`);
    return [];
  }
}

/**
 * Génère l'état complet des créneaux pour une date donnée.
 * @param {string} dateString Date au format "YYYY-MM-DD".
 * @param {number} duree Durée de la course en minutes.
 * @param {string|null} idEvenementAIgnorer ID d'un événement à ignorer.
 * @param {Array|null} evenementsPrecharges Liste d'événements préchargés.
 * @param {Array} autresCoursesPanier Autres courses à prendre en compte.
 * @returns {Array<Object>} Liste de créneaux avec état.
 */
function obtenirEtatCreneauxPourDate(dateString, duree, idEvenementAIgnorer = null, evenementsPrecharges = null, autresCoursesPanier = []) {
  try {
    const [annee, mois, jour] = dateString.split('-').map(Number);
    const [heureDebut, minuteDebut] = HEURE_DEBUT_SERVICE.split(':').map(Number);
    const [heureFin, minuteFin] = HEURE_FIN_SERVICE.split(':').map(Number);
    const debutJournee = new Date(annee, mois - 1, jour, heureDebut, minuteDebut);
    const finJournee = new Date(annee, mois - 1, jour, heureFin, minuteFin);

    const maintenant = new Date();
    const estAujourdHui = formaterDateEnYYYYMMDD(maintenant) === dateString;

    const evenementsBruts = Array.isArray(evenementsPrecharges)
      ? evenementsPrecharges
      : obtenirEvenementsCalendrierPourPeriode(debutJournee, finJournee);
    const evenementsCalendrier = normaliserEvenementsPourPlage(evenementsBruts, debutJournee, finJournee);

    const plagesManuellementBloquees = obtenirPlagesBloqueesPourDate(debutJournee);

    const reservationsPanier = autresCoursesPanier.map(item => {
      const [itemHeureDebut, itemMinuteDebut] = item.startTime.split('h').map(Number);
      const dureeNumerique = parseFloat(item.duree);
      const debut = new Date(annee, mois - 1, jour, itemHeureDebut, itemMinuteDebut);
      if (isNaN(debut.getTime()) || isNaN(dureeNumerique)) { return null; }
      const fin = new Date(debut.getTime() + dureeNumerique * 60000);
      return { id: `panier-${item.id}`, start: debut, end: fin };
    }).filter(Boolean);

    const indisponibilitesNormalisees = [
      ...evenementsCalendrier,
      ...reservationsPanier,
      ...plagesManuellementBloquees.map((e, i) => ({ id: `manuel-${i}`, start: e.start, end: e.end }))
    ].filter(indispo => !isNaN(indispo.start.getTime()) && !isNaN(indispo.end.getTime()));

    const creneaux = [];
    let heureActuelle = new Date(debutJournee);
    const idPropreAIgnorer = idEvenementAIgnorer ? idEvenementAIgnorer.split(__ID_SUFFIX_SEPARATOR)[0] : null;

    while (heureActuelle < finJournee) {
      const debutCreneau = new Date(heureActuelle);
      const finCreneau = new Date(debutCreneau.getTime() + duree * 60000);
      if (finCreneau > finJournee) break;

      const taken = indisponibilitesNormalisees.some(indispo => {
        if (indispo.id === idPropreAIgnorer) return false;
        const finAvecTampon = new Date(indispo.end.getTime() + DUREE_TAMPON_MINUTES * 60000);
        return debutCreneau < finAvecTampon && finCreneau > indispo.start;
      });
      const inPast = estAujourdHui && debutCreneau < maintenant;

      creneaux.push({ time: formaterDateEnHHMM(debutCreneau), status: taken ? 'closed' : 'open', taken, inPast });

      heureActuelle.setMinutes(heureActuelle.getMinutes() + INTERVALLE_CRENEAUX_MINUTES);
    }

    return creneaux;
  } catch (e) {
    Logger.log(`Erreur dans obtenirEtatCreneauxPourDate pour ${dateString}: ${e.stack}`);
    return [];
  }
}

/**
 * Renvoie la disponibilité de chaque jour du mois pour l'affichage du calendrier public.
 * @param {number|string} mois Le mois (1-12).
 * @param {number|string} annee L'année.
 * @returns {Object} Un objet avec le niveau de disponibilité pour chaque jour.
 */
function obtenirDonneesCalendrierPublic(mois, annee) {
  const fallbackDate = new Date();
  let moisNormalise = typeof mois === 'string' ? Number(mois.trim()) : Number(mois);
  let anneeNormalisee = typeof annee === 'string' ? Number(annee.trim()) : Number(annee);
  let fallbackUtilise = false;

  if (!Number.isFinite(moisNormalise)) {
    moisNormalise = NaN;
  }
  if (!Number.isFinite(anneeNormalisee)) {
    anneeNormalisee = NaN;
  }

  if (!Number.isInteger(moisNormalise) || moisNormalise < 1 || moisNormalise > 12) {
    moisNormalise = fallbackDate.getMonth() + 1;
    fallbackUtilise = true;
  }

  if (!Number.isInteger(anneeNormalisee) || anneeNormalisee < 2000) {
    anneeNormalisee = fallbackDate.getFullYear();
    fallbackUtilise = true;
  }

  mois = moisNormalise;
  annee = anneeNormalisee;

  const cache = CacheService.getScriptCache();
  const cleCache = `dispo_${annee}_${String(mois).padStart(2, '0')}`;
  const donneesEnCache = cache.get(cleCache);

  if (donneesEnCache) {
    return JSON.parse(donneesEnCache);
  }

  try {
    if (fallbackUtilise) {
      Logger.log(`WARN obtenirDonneesCalendrierPublic: paramètres invalides normalisés -> mois=${mois}, annee=${annee}`);
    }

    const disponibilite = {};
    const dateDebutMois = new Date(annee, mois - 1, 1);
    const dateFinMois = new Date(annee, mois, 0);
    const evenementsDuMois = obtenirEvenementsCalendrierPourPeriode(dateDebutMois, new Date(annee, mois, 1));
    
    const maintenant = new Date();
    const dateAujourdhuiString = formaterDateEnYYYYMMDD(maintenant);
    const [heureFin, minuteFin] = HEURE_FIN_SERVICE.split(':').map(Number);

    for (let d = new Date(dateDebutMois); d <= dateFinMois; d.setDate(d.getDate() + 1)) {
      const dateString = formaterDateEnYYYYMMDD(d);
      
      if (d.getDay() === 0) { // Dimanche
        disponibilite[dateString] = { disponibles: 0, total: 0 };
        continue;
      }

      const debutServiceJour = new Date(d);
      debutServiceJour.setHours(...HEURE_DEBUT_SERVICE.split(':').map(Number));
      const finServiceJour = new Date(d);
      finServiceJour.setHours(heureFin, minuteFin, 0, 0);
      const totalCreneauxPossiblesBrut = Math.floor(((finServiceJour - debutServiceJour) / 60000) / INTERVALLE_CRENEAUX_MINUTES);
      const totalCreneauxPossibles = totalCreneauxPossiblesBrut > 0 ? totalCreneauxPossiblesBrut : 1;

      if (estJourFerieFrancais(d, dateString)) {
        disponibilite[dateString] = { disponibles: 0, total: totalCreneauxPossibles };
        continue;
      }

      if (dateString < dateAujourdhuiString || (dateString === dateAujourdhuiString && maintenant > finServiceJour)) {
          disponibilite[dateString] = { disponibles: 0, total: 0 };
          continue;
      }

      const creneaux = obtenirCreneauxDisponiblesPourDate(dateString, DUREE_BASE, null, evenementsDuMois);
      
      disponibilite[dateString] = { disponibles: creneaux.length, total: totalCreneauxPossibles };
    }

    const resultat = { disponibilite: disponibilite };
    cache.put(cleCache, JSON.stringify(resultat), 7200); // Cache de 2 heures

    return resultat;
  } catch (e) {
    Logger.log(`ERREUR dans obtenirDonneesCalendrierPublic: ${e.toString()}`);
    return { disponibilite: {} };
  }
}

