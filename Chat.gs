// =================================================================
//                      MODULE CHAT & DEMANDES
// =================================================================
// Description: Gère le chat anonyme inter-pharmacies et la collecte
//              des demandes d'intégration de tournée.
// =================================================================

const CHAT_THREAD_GLOBAL = 'THR_GLOBAL';
const CHAT_RATE_LIMIT_WINDOW_SECONDS = 10;
const CHAT_RATE_LIMIT_BURST = 3;

/**
 * Retourne le classeur principal (feuille de calcul partagée).
 * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet}
 */
function getMainSpreadsheet() {
  const sheetId = getSecret('ID_FEUILLE_CALCUL');
  try {
    const ss = SpreadsheetApp.openById(sheetId);
    if (!ss) {
      throw new Error('openById a renvoyé une valeur indéfinie.');
    }
    return ss;
  } catch (err) {
    throw new Error(`Impossible d'ouvrir la feuille principale (ID_FEUILLE_CALCUL=${sheetId}): ${err}`);
  }
}

/**
 * S'assure qu'une feuille existe et possède une ligne d'en-têtes.
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @param {string} sheetName
 * @param {string[]} headers
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
function ensureSheetWithHeaders(ss, sheetName, headers) {
  if (!ss) {
    throw new Error('Spreadsheet principal manquant pour ' + sheetName);
  }
  const existing = ss.getSheetByName(sheetName);
  const sheet = existing || ss.insertSheet(sheetName);
  const hasHeaders = sheet.getLastRow() > 0 && sheet.getRange(1, 1, 1, headers.length).getValues().some(row => row.some(Boolean));
  if (!hasHeaders) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/**
 * Retourne (et initialise si besoin) la feuille Chat.
 */
function getChatSheet(ss) {
  return ensureSheetWithHeaders(ss, SHEET_CHAT, [
    'timestamp',
    'thread_id',
    'author_type',
    'author_ref',
    'author_pseudo',
    'message',
    'visible_to',
    'status',
    'attachments'
  ]);
}

/**
 * Retourne (et initialise si besoin) la feuille ChatMeta.
 */
function getChatMetaSheet(ss) {
  return ensureSheetWithHeaders(ss, SHEET_CHAT_META, ['key', 'value']);
}

/**
 * Retourne (et initialise si besoin) la feuille des demandes de tournée.
 */
function getDemandesSheet(ss) {
  return ensureSheetWithHeaders(ss, SHEET_DEMANDES_TOURNEE, [
    'timestamp',
    'etablissement_type',
    'etablissement_nom',
    'contact_email',
    'contact_tel',
    'adresse',
    'jours_souhaites',
    'plage_horaire',
    'details',
    'statut',
    'pharmacie_cible',
    'note_interne'
  ]);
}

/**
 * Récupère (ou génère) le sel utilisé pour l'anonymisation des pharmacies.
 * @returns {string}
 */
function getChatSalt() {
  const ss = getMainSpreadsheet();
  const metaSheet = getChatMetaSheet(ss);
  const data = metaSheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === 'salt' && data[i][1]) {
      return String(data[i][1]);
    }
  }
  const salt = Utilities.getUuid().replace(/-/g, '');
  metaSheet.appendRow(['salt', salt]);
  return salt;
}

/**
 * Calcule un pseudo stable (hash SHA-256 tronqué) à partir d'une référence pharmacie.
 * @param {string} authorRef
 * @returns {string}
 */
function computeChatPseudo(authorRef) {
  const salt = getChatSalt();
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    salt + String(authorRef || '')
  );
  const hex = digest.map(byte => ('0' + ((byte & 0xff).toString(16))).slice(-2)).join('').toUpperCase();
  return 'Pharmacie #' + hex.substring(0, 3);
}

/**
 * Nettoie un texte (suppression des balises HTML et caractères de contrôle).
 * @param {string} text
 * @param {number} [maxLength=1000]
 * @returns {string}
 */
function sanitizeMultiline(text, maxLength) {
  const limit = Number(maxLength) > 0 ? Number(maxLength) : 1000;
  const raw = String(text || '').replace(/[\u0000-\u001F\u007F]/g, '').replace(/<[^>]*>/g, '');
  return raw.trim().substring(0, limit);
}

/**
 * Nettoie une valeur simple (alphanumérique + ponctuation minimale).
 * @param {string} value
 * @param {number} maxLength
 * @returns {string}
 */
function sanitizeScalar(value, maxLength) {
  const limit = Number(maxLength) > 0 ? Number(maxLength) : 255;
  const raw = String(value || '').replace(/[\u0000-\u001F\u007F]/g, '');
  return raw.trim().substring(0, limit);
}

/**
 * Nettoie un code client pharmacie (4 à 8 caractères alphanumériques).
 * @param {string} code
 * @returns {string|null}
 */
function sanitizePharmacyCode(code) {
  const cleaned = String(code || '').trim().toUpperCase();
  if (!cleaned || cleaned.length < 4 || cleaned.length > 8) return null;
  if (!/^[A-Z0-9]+$/.test(cleaned)) return null;
  return cleaned;
}

/**
 * Construit une clé anonymisée pour le rate limiting (session + IP + utilisateur).
 * @param {string} sessionId
 * @returns {string}
 */
function buildChatRateKey(sessionId) {
  const sessionPart = sanitizeScalar(sessionId || '', 64) || 'anon';
  let ipPart = '';
  try {
    ipPart = typeof Session.getTemporaryActiveUserKey === 'function' ? (Session.getTemporaryActiveUserKey() || '') : '';
  } catch (_err) {
    ipPart = '';
  }
  const userEmail = (Session.getActiveUser() && Session.getActiveUser().getEmail()) || '';
  const composite = [sessionPart, ipPart, userEmail].join('|');
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, composite);
  return digest.map(byte => ('0' + ((byte & 0xff).toString(16))).slice(-2)).join('');
}

/**
 * Applique un rate limit (1 message / 10s, burst 3) partagé entre session et IP.
 * @param {string} sessionId
 * @returns {boolean}
 */
function isChatRateAllowed(sessionId) {
  const key = buildChatRateKey(sessionId);
  const cache = CacheService.getScriptCache();
  const cacheKey = 'chat_rate:' + key;
  const now = Date.now();
  let history = [];
  const cached = cache.get(cacheKey);
  if (cached) {
    try {
      history = JSON.parse(cached).filter(ts => (now - Number(ts)) < (CHAT_RATE_LIMIT_WINDOW_SECONDS * 1000));
    } catch (_err) {
      history = [];
    }
  }
  if (history.length >= CHAT_RATE_LIMIT_BURST) {
    return false;
  }
  history.push(now);
  cache.put(cacheKey, JSON.stringify(history), CHAT_RATE_LIMIT_WINDOW_SECONDS);
  try {
    PropertiesService.getScriptProperties().setProperty('chat_rate_last:' + key, String(now));
  } catch (_err) {
    // Pas critique : on ignore les erreurs d'écriture éventuelles.
  }
  return true;
}

/**
 * Poste un message dans le chat.
 * @param {Object} rawPayload
 * @returns {{ok:boolean, reason?:string}}
 */
function chatPostMessage(rawPayload) {
  try {
    const payload = rawPayload || {};
    if (!isChatRateAllowed(payload.sessionId || '')) {
      return { ok: false, reason: 'RATE_LIMIT' };
    }

    const message = sanitizeMultiline(payload.message, 1000);
    if (!message) {
      return { ok: false, reason: 'EMPTY_MESSAGE' };
    }

    const ss = getMainSpreadsheet();
    const chatSheet = getChatSheet(ss);
    const userEmail = (Session.getActiveUser() && Session.getActiveUser().getEmail()) || '';
    const adminEmail = (ADMIN_EMAIL || '').toLowerCase();
    const isAdminUser = userEmail && userEmail.toLowerCase() === adminEmail;

    const requestedType = String(payload.authorType || 'pharmacy').toLowerCase();
    const wantsAdminVisibility = String(payload.visibleTo || '').toLowerCase() === 'admin' || requestedType === 'admin';

    let authorType = 'pharmacy';
    let visibleTo = wantsAdminVisibility ? 'admin' : 'pharmacy';
    let authorRef = '';
    let authorPseudo = '';

    if (requestedType === 'admin' && isAdminUser) {
      authorType = 'admin';
      visibleTo = wantsAdminVisibility ? 'admin' : 'all';
      authorRef = userEmail;
      authorPseudo = 'Admin';
    } else {
      const code = sanitizePharmacyCode(payload.pharmacyCode);
      if (!code) {
        return { ok: false, reason: 'INVALID_CODE' };
      }
      authorRef = 'PHC_' + code;
      authorPseudo = computeChatPseudo(authorRef);
      if (!wantsAdminVisibility) {
        visibleTo = 'pharmacy';
      }
    }

    const threadId = sanitizeScalar(payload.threadId || CHAT_THREAD_GLOBAL, 64) || CHAT_THREAD_GLOBAL;

    chatSheet.appendRow([
      new Date(),
      threadId,
      authorType,
      authorRef,
      authorPseudo,
      message,
      visibleTo,
      'active',
      ''
    ]);

    return { ok: true };
  } catch (err) {
    console.error('[chatPostMessage]', err);
    return { ok: false, reason: 'ERROR' };
  }
}

/**
 * Retourne la liste des messages du chat, filtrés depuis un timestamp donné.
 * @param {{since?:number, audience?:string}} [options]
 * @returns {{messages:Array<Object>, lastTs:number}}
 */
function chatGetMessages(options) {
  try {
    const params = options || {};
    const since = Number(params.since) || 0;
    const audience = String(params.audience || 'pharmacy').toLowerCase();
    const includeAdmin = audience === 'admin';

    const ss = getMainSpreadsheet();
    const chatSheet = ss.getSheetByName(SHEET_CHAT);
    if (!chatSheet) {
      return { messages: [], lastTs: since };
    }

    const lastRow = chatSheet.getLastRow();
    if (lastRow <= 1) {
      return { messages: [], lastTs: since };
    }

    const range = chatSheet.getRange(2, 1, lastRow - 1, 9);
    const rows = range.getValues();
    const messages = [];
    let lastTimestamp = since;

    for (let i = 0; i < rows.length; i++) {
      const [ts, threadId, authorType, _authorRef, authorPseudo, msg, visibleTo, status] = rows[i];
      if (String(status || '').toLowerCase() !== 'active') {
        continue;
      }

      const timestamp = ts instanceof Date ? ts.getTime() : Number(ts) || 0;
      if (since && timestamp <= since) {
        continue;
      }

      const visibility = String(visibleTo || 'pharmacy').toLowerCase();
      if (visibility === 'admin' && !includeAdmin) {
        continue;
      }

      messages.push({
        timestamp: timestamp,
        threadId: threadId || CHAT_THREAD_GLOBAL,
        authorType: authorType || 'pharmacy',
        authorPseudo: authorPseudo || '',
        message: msg || '',
        visibleTo: visibility
      });

      if (timestamp > lastTimestamp) {
        lastTimestamp = timestamp;
      }
    }

    if (messages.length > 200) {
      messages.splice(0, messages.length - 200);
    }

    return { messages: messages, lastTs: lastTimestamp };
  } catch (err) {
    console.error('[chatGetMessages]', err);
    return { messages: [], lastTs: Number(options && options.since) || 0 };
  }
}

/**
 * Masque un message (statut hidden). Réservé à l'administrateur.
 * @param {number|string} timestamp
 * @returns {{ok:boolean, reason?:string}}
 */
function chatAdminHide(timestamp) {
  const userEmail = (Session.getActiveUser() && Session.getActiveUser().getEmail()) || '';
  if (!userEmail || userEmail.toLowerCase() !== String(ADMIN_EMAIL || '').toLowerCase()) {
    return { ok: false, reason: 'UNAUTHORIZED' };
  }
  const tsNumber = Number(timestamp);
  if (!tsNumber) {
    return { ok: false, reason: 'INVALID_TIMESTAMP' };
  }
  const ss = getMainSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_CHAT);
  if (!sheet) {
    return { ok: false, reason: 'NOT_FOUND' };
  }
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return { ok: false, reason: 'NOT_FOUND' };
  }
  const rows = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
  for (let i = 0; i < rows.length; i++) {
    const rowTimestamp = rows[i][0];
    const rowTs = rowTimestamp instanceof Date ? rowTimestamp.getTime() : Number(rowTimestamp) || 0;
    if (rowTs === tsNumber) {
      sheet.getRange(i + 2, 8).setValue('hidden');
      return { ok: true };
    }
  }
  return { ok: false, reason: 'NOT_FOUND' };
}

/**
 * Enregistre une demande d'intégration de tournée.
 * @param {Object} rawData
 * @returns {{ok:boolean, reason?:string}}
 */
function tourneeSubmitDemande(rawData) {
  try {
    const data = rawData || {};
    const etabType = sanitizeScalar(data.etabType, 32);
    const etabNom = sanitizeScalar(data.etabNom, 128);
    const email = sanitizeScalar(data.email, 128);
    const tel = sanitizeScalar(data.tel, 64);
    const adresse = sanitizeScalar(data.adresse, 255);
    const jours = sanitizeScalar(data.jours, 128);
    const plage = sanitizeScalar(data.plage, 64);
    const details = sanitizeMultiline(data.details, 1500);

    if (!etabType || !etabNom || !email) {
      return { ok: false, reason: 'MISSING_FIELDS' };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { ok: false, reason: 'INVALID_EMAIL' };
    }

    const ss = getMainSpreadsheet();
    const sheet = getDemandesSheet(ss);
    sheet.appendRow([
      new Date(),
      etabType,
      etabNom,
      email,
      tel,
      adresse,
      jours,
      plage,
      details,
      'nouvelle',
      '',
      ''
    ]);

    try {
      const adminEmail = getSecret('ADMIN_EMAIL');
      if (adminEmail) {
        const sujet = 'Nouvelle demande de tournée: ' + etabNom;
        const lignes = [
          '<p>Type: ' + etabType + '</p>',
          '<p>Nom: ' + etabNom + '</p>',
          '<p>Email: ' + email + '</p>',
          tel ? '<p>Téléphone: ' + tel + '</p>' : '',
          adresse ? '<p>Adresse: ' + adresse + '</p>' : '',
          jours ? '<p>Jours souhaités: ' + jours + '</p>' : '',
          plage ? '<p>Plage horaire: ' + plage + '</p>' : '',
          details ? '<p>Détails: ' + details.replace(/\n/g, '<br>') + '</p>' : ''
        ].filter(Boolean);
        MailApp.sendEmail({
          to: adminEmail,
          subject: sujet,
          htmlBody: lignes.join('')
        });
      }
    } catch (notifErr) {
      console.warn('[tourneeSubmitDemande] Mail notification failed:', notifErr);
    }

    return { ok: true };
  } catch (err) {
    console.error('[tourneeSubmitDemande]', err);
    return { ok: false, reason: 'ERROR' };
  }
}

/**
 * Provisionne explicitement les feuilles nécessaires au module chat.
 * À exécuter manuellement si l'on veut créer les onglets avant le premier usage.
 * @returns {{ok:boolean}}
 */
function chatProvisionSheets() {
  const ss = getMainSpreadsheet();
  getChatSheet(ss);
  getChatMetaSheet(ss);
  getDemandesSheet(ss);
  getChatSalt(); // s'assure que le sel est présent.
  return { ok: true };
}
