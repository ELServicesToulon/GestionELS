const LIVREUR_JOURNAL_HEADERS = ['ts_srv','eventId','cmd','status','lat','lng','accuracy','items_json','temp','receiver_name','receiver_role','sign_fileId','photo_fileIds','deviceId','battery','appVersion','clientUUID','seq','userEmail'];
const LIVREUR_DEVICES_HEADERS = ['driverEmail','fcmToken','platform','updated_ts'];

/**
 * Retourne la feuille journal append-only du module livreur.
 * @return {GoogleAppsScript.Spreadsheet.Sheet}
 */
function livreurGetJournalSheet() {
  const ss = getMainSpreadsheet();
  return ensureSheetWithHeaders(ss, LIVREUR_JOURNAL_SHEET, LIVREUR_JOURNAL_HEADERS);
}

/**
 * Retourne la feuille de mapping des tokens FCM.
 * @return {GoogleAppsScript.Spreadsheet.Sheet}
 */
function livreurGetDevicesSheet() {
  const ss = getMainSpreadsheet();
  return ensureSheetWithHeaders(ss, LIVREUR_DEVICES_SHEET, LIVREUR_DEVICES_HEADERS);
}

/**
 * Vérifie l'existence d'une ligne identique selon la clé composite.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {string} eventId
 * @param {string} cmd
 * @param {string} clientUUID
 * @param {number} seq
 * @return {boolean}
 */
function livreurHasExistingEntry_(sheet, eventId, cmd, clientUUID, seq) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return false;
  }
  const range = sheet.getRange(2, 1, lastRow - 1, LIVREUR_JOURNAL_HEADERS.length);
  const values = range.getValues();
  for (var i = 0; i < values.length; i += 1) {
    const row = values[i];
    if (row[1] === eventId && row[2] === cmd && row[16] === clientUUID && Number(row[17]) === Number(seq)) {
      return true;
    }
  }
  return false;
}

/**
 * Ajoute une entrée de journal pour une fiche livraison.
 * @param {Object} entryPayload
 * @return {{ok:boolean,reason?:string,ts?:string,duplicate?:boolean}}
 */
function livreurAppendJournalEntry(entryPayload) {
  const sheet = livreurGetJournalSheet();
  if (livreurHasExistingEntry_(sheet, entryPayload.eventId, entryPayload.cmd, entryPayload.clientUUID, entryPayload.seq)) {
    return { ok: true, duplicate: true, ts: new Date().toISOString() };
  }
  const serverTs = new Date();
  const geo = entryPayload.geo || null;
  const photoIds = Array.isArray(entryPayload.photoFileIds) ? entryPayload.photoFileIds : [];
  const sanitizedItemsJson = sanitizeMultiline(JSON.stringify(entryPayload.items || []), 4000);
  const row = [
    serverTs,
    sanitizeScalar(entryPayload.eventId, 120),
    sanitizeScalar(entryPayload.cmd, 120),
    sanitizeScalar(entryPayload.status, 32),
    geo && typeof geo.lat === 'number' ? Number(geo.lat) : '',
    geo && typeof geo.lng === 'number' ? Number(geo.lng) : '',
    geo && typeof geo.accuracy === 'number' ? Number(geo.accuracy) : '',
    sanitizedItemsJson,
    entryPayload.temp === '' ? '' : Number(entryPayload.temp),
    sanitizeScalar(entryPayload.receiver && entryPayload.receiver.name, 120),
    sanitizeScalar(entryPayload.receiver && entryPayload.receiver.role, 80),
    sanitizeScalar(entryPayload.signatureFileId, 200),
    photoIds.map(function (id) { return sanitizeScalar(id, 200); }).filter(String).join(','),
    sanitizeScalar(entryPayload.device && entryPayload.device.id, 120),
    entryPayload.device && entryPayload.device.battery !== '' ? Number(entryPayload.device.battery) : '',
    sanitizeScalar(entryPayload.device && entryPayload.device.appVersion, 32),
    sanitizeScalar(entryPayload.clientUUID, 120),
    Number(entryPayload.seq || 0),
    sanitizeEmail(entryPayload.userEmail)
  ];
  sheet.getRange(sheet.getLastRow() + 1, 1, 1, LIVREUR_JOURNAL_HEADERS.length).setValues([row]);
  return { ok: true, ts: serverTs.toISOString() };
}

/**
 * Insère ou met à jour un enregistrement device/token.
 * @param {{driverEmail:string,token:string,platform:string}} record
 * @return {{ok:boolean,reason?:string}}
 */
function livreurUpsertDevice(record) {
  const sheet = livreurGetDevicesSheet();
  const email = sanitizeEmail(record.driverEmail);
  const token = sanitizeScalar(record.token, 1024);
  const platform = sanitizeScalar(record.platform || 'android', 32) || 'android';
  if (!email || !token) {
    return { ok: false, reason: 'MISSING_FIELDS' };
  }
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    const range = sheet.getRange(2, 1, lastRow - 1, LIVREUR_DEVICES_HEADERS.length);
    const values = range.getValues();
    for (var i = 0; i < values.length; i += 1) {
      if (values[i][0] === email) {
        range.getCell(i + 1, 1).offset(0, 0, 1, LIVREUR_DEVICES_HEADERS.length)
          .setValues([[email, token, platform, new Date()]]);
        return { ok: true };
      }
    }
  }
  sheet.getRange(lastRow + 1, 1, 1, LIVREUR_DEVICES_HEADERS.length).setValues([[email, token, platform, new Date()]]);
  return { ok: true };
}
