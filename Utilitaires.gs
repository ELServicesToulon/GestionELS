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

/**
 * Retourne le mois en toutes lettres au format français (ex: "aout 2025").
 * @param {Date} date
 * @returns {string}
 */
function formatMoisFrancais(date) {
  if (!(date instanceof Date) || isNaN(date)) {
    return '';
  }
  const mois = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  return `${mois[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * Formate un montant en euros avec la convention française.
 * @param {number|string} valeur
 * @returns {string}
 */
function formatMontantEuro(valeur) {
  const nombre = Number(valeur);
  if (!isFinite(nombre)) {
    return '';
  }
  return nombre.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Remplace un placeholder par une image Drive (logo) dans un document Google Docs.
 * @param {GoogleAppsScript.Document.Body} corps
 * @param {string} placeholder Texte à remplacer (ex: {{logo}})
 * @param {string|null} fileId ID du fichier Drive
 * @param {number} [largeurMax] Largeur maximale en pixels
 * @returns {boolean} true si une image a été insérée
 */
function insererImageDepuisPlaceholder(corps, placeholder, fileId, largeurMax, fallbackBlob) {
  try {
    let blob = null;
    if (fileId) {
      blob = DriveApp.getFileById(fileId).getBlob();
    } else if (fallbackBlob) {
      blob = fallbackBlob;
    }
    if (!blob) return false;

    if (blob.getContentType() === 'image/svg+xml') {
      try {
        blob = blob.getAs(MimeType.PNG);
      } catch (e) {
        Logger.log('Impossible de convertir le SVG du logo en PNG: ' + e.message);
      }
    }

    let range = corps.findText(placeholder);
    let insere = false;
    while (range) {
      const elementTexte = range.getElement();
      if (!elementTexte) break;
      const paragraphe = elementTexte.getParent().asParagraph();
      paragraphe.clear();
      const image = paragraphe.insertInlineImage(0, blob);
      if (largeurMax && image.getWidth() > largeurMax) {
        const ratio = image.getHeight() / image.getWidth();
        image.setWidth(largeurMax);
        image.setHeight(Math.round(largeurMax * ratio));
      }
      insere = true;
      range = corps.findText(placeholder);
    }
    return insere;
  } catch (e) {
    Logger.log(`Impossible d'insérer l'image pour ${placeholder}: ${e.message}`);
    return false;
  }
}

/**
 * Récupère le logo depuis Drive (secret ID_LOGO) et le retourne sous forme de blob.
 * @returns {GoogleAppsScript.Base.Blob|null}
 */
function getLogoSvgBlob() {
  const blob = getLogoBlob();
  if (blob) return blob;
  // Fallback legacy: tente de récupérer un éventuel SVG statique dans Logo.html
  try {
    let svg = loadInlineSvgFromFile('Logo');
    if (!svg) {
      svg = loadInlineSvgFromFile('Logo_Fallback_SVG');
    }
    if (!svg) return null;
    return Utilities.newBlob(svg, 'image/svg+xml', 'logo.svg');
  } catch (e) {
    Logger.log('Impossible de récupérer un logo statique: ' + e.message);
    return null;
  }
}

function loadInlineSvgFromFile(filename) {
  try {
    const template = HtmlService.createTemplateFromFile(filename);
    const content = template.getCode();
    if (!content) return '';
    const match = content.match(/<svg[\s\S]*?<\/svg>/i);
    return match ? match[0] : '';
  } catch (e) {
    return '';
  }
}

/**
 * Récupère le logo principal sous forme de blob depuis Drive.
 * @returns {GoogleAppsScript.Base.Blob|null}
 */
function getLogoBlob() {
  try {
    const fileId = getSecret('ID_LOGO');
    if (!fileId) return null;
    const file = DriveApp.getFileById(fileId);
    if (!file) return null;
    return file.getBlob();
  } catch (e) {
    Logger.log('Impossible de récupérer le logo Drive: ' + e.message);
    return null;
  }
}

/**
 * Retourne une data URL (PNG si possible) du logo pour une utilisation dans des e-mails HTML.
 * @returns {string} Data URL ou chaîne vide en cas d'erreur.
 */
function getLogoDataUrl() {
  try {
    const driveLogo = blobToDataUrl(getLogoBlob());
    if (driveLogo) {
      return driveLogo;
    }

    const bundledLogo = getBundledLogoDataUrl();
    if (bundledLogo) {
      return bundledLogo;
    }

    return blobToDataUrl(getLogoSvgBlob());
  } catch (e) {
    Logger.log('Impossible de générer la data URL du logo: ' + e.message);
    return '';
  }
}

/**
 * Convertit un blob d'image en data URL.
 * @param {GoogleAppsScript.Base.Blob} blob
 * @returns {string}
 */
function blobToDataUrl(blob) {
  if (!blob) {
    return '';
  }
  try {
    let safeBlob = blob;
    if (safeBlob.getContentType() === 'image/svg+xml') {
      try {
        safeBlob = safeBlob.getAs(MimeType.PNG);
      } catch (conversionError) {
        Logger.log('Logo: conversion SVG -> PNG échouée, utilisation du SVG brut. ' + conversionError.message);
      }
    }
    const bytes = safeBlob.getBytes();
    if (!bytes || !bytes.length) {
      return '';
    }
    const contentType = safeBlob.getContentType() || 'image/png';
    const base64 = Utilities.base64Encode(bytes);
    return 'data:' + contentType + ';base64,' + base64;
  } catch (error) {
    Logger.log('Impossible de convertir le blob du logo en data URL: ' + error.message);
    return '';
  }
}

/**
 * Charge la data URL du logo 3D embarqué dans le dépôt.
 * @returns {string}
 */
function getBundledLogoDataUrl() {
  try {
    const output = HtmlService.createHtmlOutputFromFile('Logo3D_b64');
    if (!output) {
      return '';
    }
    const content = (output.getContent() || '').trim();
    if (!content) {
      return '';
    }
    return content.replace(/\s+/g, '');
  } catch (e) {
    Logger.log('Impossible de charger la data URL du logo embarqué: ' + e.message);
    return '';
  }
}

/**
 * Retourne une URL publique (Google Drive) pour le logo.
 * @returns {string}
 */
function getLogoPublicUrl() {
  try {
    const fileId = getSecret('ID_LOGO');
    if (!fileId) return '';
    return 'https://drive.google.com/uc?export=view&id=' + encodeURIComponent(fileId);
  } catch (e) {
    Logger.log('Impossible de construire l’URL publique du logo: ' + e.message);
    return '';
  }
}

/**
 * Construit un bloc HTML prêt à être injecté dans un e-mail avec le logo de l'entreprise.
 * @returns {string} HTML contenant le logo ou chaîne vide.
 */
function getLogoEmailBlockHtml() {
  try {
    const dataUrl = getLogoDataUrl();
    if (!dataUrl) return '';
    const altText = 'Logo ' + (typeof NOM_ENTREPRISE !== 'undefined' ? NOM_ENTREPRISE : 'EL Services');
    return '<div style="text-align:center;margin:0 0 24px;">' +
      '<img src="' + dataUrl + '" alt="' + altText + '" style="max-width:160px;width:100%;height:auto;display:inline-block;" />' +
      '</div>';
  } catch (e) {
    Logger.log('Impossible de générer le bloc e-mail du logo: ' + e.message);
    return '';
  }
}


// --- NOUVELLES FONCTIONS UTILITAIRES AJOUTÉES ---

/**
 * Convertit un montant en euros vers des centimes (entier).
 * @param {number|string} n Montant en euros.
 * @returns {number} Montant en centimes.
 */
function toCents(n) {
  return Math.round(Number(n) * 100);
}

/**
 * Convertit un montant en centimes vers une chaîne en euros.
 * @param {number} c Montant en centimes.
 * @returns {string} Montant formaté en euros avec 2 décimales.
 */
function fromCents(c) {
  return (c / 100).toFixed(2);
}

/**
 * Génère un numéro de facture séquentiel unique par année.
 * Format: AAAA-0001.
 * @returns {string} Numéro de facture.
 */
function nextInvoiceNumber() {
  const lock = LockService.getScriptLock();
  lock.tryLock(5000);
  try {
    const props = PropertiesService.getScriptProperties();
    const year = new Date().getFullYear();
    const key = `INV_SEQ_${year}`;
    const cur = Number(props.getProperty(key) || '0') + 1;
    props.setProperty(key, String(cur));
    return `${year}-${String(cur).padStart(4, '0')}`;
  } finally {
    lock.releaseLock();
  }
}

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
 * Trouve le tableau du bordereau dans un document Google Docs.
 * @param {GoogleAppsScript.Document.Body} corps Le corps du document Google Docs.
 * @returns {GoogleAppsScript.Document.Table|null} Le tableau trouvé ou null.
 */
function trouverTableBordereau(corps) {
  // Autorise des variations (accents, casse, synonymes) et retourne aussi la correspondance de colonnes.
  const expected = {
    date: ["date"],
    heure: ["heure", "horaire"],
    details: ["details de la course", "details", "detail", "description", "prestation"],
    notes: ["notes", "note", "commentaire", "remarque", "observations"],
    remise: ["remise", "reductions", "discount", "offerte"],
    montant: ["montant ht", "montant", "montant ttc", "total ht", "total ttc", "total"]
  };
  const required = ['date', 'heure', 'details', 'montant'];

  const normalize = s => String(s || "")
    .replace(/\u00A0/g, " ")
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim().replace(/\s+/g, ' ');

  const tables = corps.getTables();
  for (let i = 0; i < tables.length; i++) {
    const table = tables[i];
    if (table.getNumRows() === 0) continue;
    const headerRow = table.getRow(0);

    const columns = {};
    for (let col = 0; col < headerRow.getNumCells(); col++) {
      const text = normalize(headerRow.getCell(col).getText());
      Object.keys(expected).forEach(key => {
        if (columns[key] !== undefined) return;
        if (expected[key].some(token => text.includes(token))) {
          columns[key] = col;
        }
      });
    }

    const ok = required.every(key => columns[key] !== undefined);
    if (ok) {
      return { table: table, columns: columns };
    }
  }
  return null;
}

/**
 * Test helper: journalise les en-têtes trouvés dans le modèle de facture.
 * Exécuter via `npx clasp run test_logHeadersModeleFacture`.
 */
function test_logHeadersModeleFacture() {
  const fileId = getSecret('ID_MODELE_FACTURE');
  const doc = DocumentApp.openById(fileId);
  const corps = doc.getBody();
  const tables = corps.getTables();
  const headers = [];
  for (let i = 0; i < tables.length; i++) {
    const t = tables[i];
    if (t.getNumRows() === 0) continue;
    const r0 = t.getRow(0);
    const cols = [];
    for (let c = 0; c < r0.getNumCells(); c++) {
      cols.push(r0.getCell(c).getText());
    }
    headers.push(cols.join(' | '));
  }
  Logger.log('Tables dans le modèle:');
  headers.forEach((h, idx) => Logger.log(`#${idx + 1}: ${h}`));
  const res = trouverTableBordereau(corps);
  if (res) {
    Logger.log(`Table bordereau détectée: colonnes ${JSON.stringify(res.columns)}`);
  } else {
    Logger.log('Aucun tableau de bordereau détecté par la fonction.');
  }
  return headers;
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

/**
 * Vérifie le lien signé et normalise l'email.
 * @param {string} email
 * @param {string|number} exp
 * @param {string} sig
 * @returns {string} Email normalisé.
 * @throws {Error} Si le lien ou l'email est invalide.
 */
function assertClient(email, exp, sig) {
  const emailNorm = String(email || '').trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(emailNorm)) throw new Error('Email invalide.');
  if (typeof CLIENT_PORTAL_SIGNED_LINKS !== 'undefined' && CLIENT_PORTAL_SIGNED_LINKS) {
    if (!verifySignedLink(emailNorm, exp, sig)) throw new Error('Lien invalide.');
  }
  return emailNorm;
}

/**
 * Valide et normalise un identifiant de réservation.
 * @param {string|number} id
 * @returns {string} Identifiant normalisé.
 * @throws {Error} Si l'identifiant est vide.
 */
function assertReservationId(id) {
  const norm = String(id || '').trim();
  if (!norm) throw new Error('ID réservation invalide.');
  return norm;
}
