// =================================================================
//                      FONCTIONS UTILITAIRES
// =================================================================
// Description: Fonctions d'aide génériques, partagées et 
//              réutilisables dans toute l'application.
// =================================================================

// --- FONCTIONS DE FORMATAGE DE DATE (EXISTANTES) ---

/**
 * Convertit un objet Date en chaîne de caractères au format YYYY-MM-DD.
 * @param {Date} date L'objet Date à convertir.
 * @returns {string} La date formatée ou une chaîne vide si l'entrée est invalide.
 */
function formaterDateEnYYYYMMDD(date) {
  if (!(date instanceof Date) || isNaN(date)) {
    Logger.log(`Erreur dans formaterDateEnYYYYMMDD: l'argument n'est pas une Date valide.`);
    return '';
  }
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

/**
 * Convertit un objet Date en chaîne de caractères au format HHhMM.
 * @param {Date} date L'objet Date à convertir.
 * @returns {string} L'heure formatée ou une chaîne vide si l'entrée est invalide.
 */
function formaterDateEnHHMM(date) {
  if (!(date instanceof Date) || isNaN(date)) {
    Logger.log(`Erreur dans formaterDateEnHHMM: l'argument n'est pas une Date valide.`);
    return '';
  }
  return Utilities.formatDate(date, Session.getScriptTimeZone(), "HH'h'mm");
}

/**
 * Formate une date selon un format et un fuseau horaire personnalisés.
 * @param {Date} date L'objet Date à formater.
 * @param {string} format Le format de sortie (ex: "dd/MM/yyyy HH:mm").
 * @param {string} [fuseauHoraire="Europe/Paris"] Le fuseau horaire à utiliser.
 * @returns {string} La date formatée ou une chaîne vide en cas d'erreur.
 */
function formaterDatePersonnalise(date, format, fuseauHoraire = "Europe/Paris") {
  if (!(date instanceof Date) || isNaN(date)) {
    Logger.log(`Erreur dans formaterDatePersonnalise: l'argument n'est pas une Date valide.`);
    return '';
  }
  try {
    return Utilities.formatDate(date, fuseauHoraire, format);
  } catch (e) {
    Logger.log(`Erreur de formatage dans formaterDatePersonnalise: ${e.message}`);
    return '';
  }
}


// --- NOUVELLES FONCTIONS UTILITAIRES AJOUTÉES ---

/**
 * Valide les en-têtes d'une feuille et retourne leurs indices de colonne.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} feuille La feuille à vérifier.
 * @param {Array<string>} enTetesRequis La liste des en-têtes requis.
 * @returns {Object} Un objet mappant les noms d'en-tête à leurs indices.
 */
function obtenirIndicesEnTetes(feuille, enTetesRequis) {
  if (!feuille) throw new Error("La feuille fournie à obtenirIndicesEnTetes est nulle.");
  if (feuille.getLastRow() < 1) throw new Error(`La feuille "${feuille.getName()}" est vide.`);
  const enTete = feuille.getRange(1, 1, 1, feuille.getLastColumn()).getValues()[0];
  const indices = {};
  const enTetesManquants = enTetesRequis.filter(reqHeader => {
    const index = enTete.findIndex(h => String(h).trim() === reqHeader);
    if (index !== -1) {
      indices[reqHeader] = index;
      return false;
    }
    return true;
  });
  if (enTetesManquants.length > 0) {
    throw new Error(`Colonne(s) manquante(s) dans "${feuille.getName()}": ${enTetesManquants.join(', ')}`);
  }
  return indices;
}

/**
 * Obtient un dossier par son nom dans un dossier parent, ou le crée s'il n'existe pas.
 * @param {GoogleAppsScript.Drive.Folder} dossierParent Le dossier parent.
 * @param {string} nomDossier Le nom du dossier à trouver ou créer.
 * @returns {GoogleAppsScript.Drive.Folder} Le dossier trouvé ou créé.
 */
function obtenirOuCreerDossier(dossierParent, nomDossier) {
  const dossiers = dossierParent.getFoldersByName(nomDossier);
  if (dossiers.hasNext()) {
    return dossiers.next();
  }
  return dossierParent.createFolder(nomDossier);
}

/**
 * Exécute une fonction avec backoff exponentiel en cas d'erreur.
 * @param {Function} fn Fonction à exécuter.
 * @param {number} [maxAttempts=5] Nombre maximal de tentatives.
 * @returns {*} Résultat de la fonction.
 * @throws {Error} Dernière erreur si toutes les tentatives échouent.
 */
function executeWithBackoff(fn, maxAttempts = 5) {
  let attempt = 0;
  let delay = 500;
  while (true) {
    try {
      return fn();
    } catch (e) {
      attempt++;
      if (attempt >= maxAttempts) {
        throw e;
      }
      Utilities.sleep(delay);
      delay *= 2;
    }
  }
}

/**
 * Trouve le tableau du bordereau dans un document Google Docs.
 * @param {GoogleAppsScript.Document.Body} corps Le corps du document Google Docs.
 * @returns {GoogleAppsScript.Document.Table|null} Le tableau trouvé ou null.
 */
function trouverTableBordereau(corps) {
    const enTetesAttendus = ["Date", "Heure", "Détails de la course", "Notes", "Montant HT"];
    const tables = corps.getTables();
    for (let i = 0; i < tables.length; i++) {
        const table = tables[i];
        if (table.getNumRows() > 0) {
            const premiereLigne = table.getRow(0);
            if (premiereLigne.getNumCells() >= enTetesAttendus.length) {
                let enTetesTrouves = enTetesAttendus.every((enTete, j) => premiereLigne.getCell(j).getText().trim() === enTete);
                if (enTetesTrouves) {
                    return table;
                }
            }
        }
    }
    return null;
}

/**
 * Journalise une tentative de connexion échouée dans SHEET_LOGS.
 * @param {string} email Adresse e-mail du client.
 * @param {string} ip Adresse IP source.
 */
function logFailedLogin(email, ip) {
  try {
    const ss = SpreadsheetApp.openById(getSecret('ID_FEUILLE_CALCUL'));
    let feuilleLog = ss.getSheetByName(SHEET_LOGS);
    if (!feuilleLog) {
      feuilleLog = ss.insertSheet('Logs');
      feuilleLog.appendRow(['Timestamp', 'Reservation ID', 'Client Email', 'Résumé', 'Montant', 'Statut']);
    }
    feuilleLog.appendRow([new Date(), '', email, `Connexion échouée (IP: ${ip || 'N/A'})`, '', 'Échec']);
  } catch (e) {
    Logger.log(`Impossible de journaliser l'échec de connexion : ${e.toString()}`);
  }
}

// --- FONCTIONS PARTAGÉES DÉPLACÉES DE Code.gs ---

/**
 * Journalise la requête entrante.
 * @param {Object} e L'objet d'événement de la requête.
 */
function logRequest(e) {
  const dateIso = new Date().toISOString();
  const route = e && e.parameter && e.parameter.page ? e.parameter.page : '';
  const ua = e && e.headers ? e.headers['User-Agent'] : '';
  Logger.log(`[Request] ${dateIso} route=${route} ua=${ua}`);
}

/**
 * Permet d'inclure des fichiers (CSS, JS) dans les templates HTML.
 * @param {string} nomFichier Le nom du fichier à inclure.
 * @returns {string} Le contenu du fichier.
 */
function include(nomFichier) {
  try {
    return HtmlService.createTemplateFromFile(nomFichier).evaluate().getContent();
  } catch (e) {
    console.error('Fichier inclus introuvable: ' + nomFichier);
    return '';
  }
}

// Thèmes désactivés: pas de thème utilisateur

/**
 * Récupère un secret depuis les Script Properties.
 * @param {string} name Nom de la propriété.
 * @returns {string} Valeur du secret.
 * @throws {Error} Si la propriété est absente.
 */
function getSecret(name) {
  const sp = PropertiesService.getScriptProperties();
  let value = sp.getProperty(name);
  if (value === null || value === '') {
    if (name === 'DOSSIER_PUBLIC_FOLDER_ID') {
      value = sp.getProperty('DOCS_PUBLIC_FOLDER_ID');
    } else if (name === 'DOCS_PUBLIC_FOLDER_ID') {
      value = sp.getProperty('DOSSIER_PUBLIC_FOLDER_ID');
    }
  }
  if (value === null || value === '') {
    throw new Error(`Propriété manquante: ${name}`);
  }
  return value;
}

/**
 * Enregistre un secret dans les Script Properties.
 * @param {string} name Nom de la propriété.
 * @param {string} value Valeur à stocker.
 */
function setSecret(name, value) {
  PropertiesService.getScriptProperties().setProperty(name, value);
}

/**
 * Vérifie un lien signé pour l'espace client.
 * Le lien doit contenir email, exp (timestamp secondes) et sig (Base64 HMAC-SHA256 de "email|exp").
 * @param {string} email
 * @param {string|number} expSeconds
 * @param {string} sigBase64
 * @returns {boolean}
 */
function verifySignedLink(email, expSeconds, sigBase64) {
  try {
    if (!email || !expSeconds || !sigBase64) return false;
    const exp = Number(expSeconds);
    if (!isFinite(exp)) return false;
    const nowSec = Math.floor(Date.now() / 1000);
    const ttl = (typeof CLIENT_PORTAL_LINK_TTL_HOURS !== 'undefined' ? Number(CLIENT_PORTAL_LINK_TTL_HOURS) : 24) * 3600;
    if (exp < nowSec || exp - nowSec > ttl) return false;
    const secret = getSecret('ELS_SHARED_SECRET');
    if (!secret) return false;
    const data = `${String(email).trim().toLowerCase()}|${exp}`;
    const rawSig = Utilities.computeHmacSha256Signature(data, secret);
    const expected = Utilities.base64Encode(rawSig);
    const expectedWeb = Utilities.base64EncodeWebSafe(rawSig);
    return sigBase64 === expected || sigBase64 === expectedWeb;
  } catch (e) {
    return false;
  }
}

/**
 * Génère un lien signé pour l'Espace Client.
 * Sig = Base64(HMAC-SHA256("email|exp", ELS_SHARED_SECRET)) (web-safe)
 * @param {string} email Adresse e-mail du client.
 * @param {number} [ttlSeconds=86400] Durée de validité en secondes (défaut 24h).
 * @returns {{url:string, exp:number}} URL complète + timestamp d'expiration.
 */
function generateSignedClientLink(email, ttlSeconds) {
  if (!email) throw new Error('Email requis');
  const ttl = (Number(ttlSeconds) > 0 ? Number(ttlSeconds) : (typeof CLIENT_PORTAL_LINK_TTL_HOURS !== 'undefined' ? Number(CLIENT_PORTAL_LINK_TTL_HOURS) : 24) * 3600);
  const exp = Math.floor(Date.now() / 1000) + ttl;
  const secret = getSecret('ELS_SHARED_SECRET');
  if (!secret) throw new Error('Secret manquant: ELS_SHARED_SECRET');
  const data = `${String(email).trim().toLowerCase()}|${exp}`;
  const sig = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(data, secret));
  const baseUrl = ScriptApp.getService().getUrl();
  const url = `${baseUrl}?page=gestion&email=${encodeURIComponent(email)}&exp=${exp}&sig=${encodeURIComponent(sig)}`;
  return { url: url, exp: exp };
}
/**
 * Retourne l'ensemble des drapeaux de configuration exposés au client.
 * @returns {Object} Drapeaux issus de Configuration.gs.
 */
function getConfiguration() {
  return Object.assign({}, FLAGS);
}
