const JOURNAL_HEADERS = ['ts_srv','eventId','cmd','status','lat','lng','accuracy','items_json','temp','receiver_name','receiver_role','sign_fileId','photo_fileIds','deviceId','battery','appVersion','clientUUID','seq','userEmail'];
const DEVICES_HEADERS = ['driverEmail','fcmToken','platform','updated_ts'];

/**
 * Récupère feuille journal.
 * @return {GoogleAppsScript.Spreadsheet.Sheet}
 */
function getJournalSheet() {
  const sheetId = PropertiesService.getScriptProperties().getProperty('SHEET_ID') || 'SHEET_ID';
  const ss = SpreadsheetApp.openById(sheetId);
  let sheet = ss.getSheetByName('journal');
  if (!sheet) {
    sheet = ss.insertSheet('journal');
    sheet.appendRow(JOURNAL_HEADERS);
  }
  return sheet;
}

/**
 * Récupère feuille devices.
 */
function getDevicesSheet() {
  const sheetId = PropertiesService.getScriptProperties().getProperty('SHEET_ID') || 'SHEET_ID';
  const ss = SpreadsheetApp.openById(sheetId);
  let sheet = ss.getSheetByName('devices');
  if (!sheet) {
    sheet = ss.insertSheet('devices');
    sheet.appendRow(DEVICES_HEADERS);
  }
  return sheet;
}

/**
 * Vérifie idempotence via clés composites.
 */
function hasExistingEntry(sheet, eventId, cmd, clientUUID, seq) {
  const rows = sheet.getLastRow() - 1;
  if (rows <= 0) {
    return false;
  }
  const range = sheet.getRange(2, 1, rows, JOURNAL_HEADERS.length);
  const values = range.getValues();
  return values.some((row) => row[1] === eventId && row[2] === cmd && row[16] === clientUUID && Number(row[17]) === Number(seq));
}

/**
 * Ajoute ligne journal.
 */
function appendJournalEntry(payload, userEmail, signatureFileId, photoFileIds) {
  const sheet = getJournalSheet();
  if (hasExistingEntry(sheet, payload.eventId, payload.cmd, payload.clientUUID, payload.seq)) {
    return { ok: true, ts: new Date().toISOString(), duplicate: true };
  }
  const geo = roundGeo(payload.geo);
  const row = [
    new Date(),
    sanitizeString(payload.eventId, 120),
    sanitizeString(payload.cmd, 120),
    sanitizeString(payload.status, 20),
    geo ? geo.lat : '',
    geo ? geo.lng : '',
    geo ? geo.accuracy : '',
    JSON.stringify(payload.items || []),
    payload.temp || '',
    sanitizeString(payload.receiver?.name, 120),
    sanitizeString(payload.receiver?.role, 120),
    signatureFileId || '',
    photoFileIds.join(','),
    sanitizeString(payload.device?.id, 120),
    payload.device?.battery ?? '',
    sanitizeString(payload.device?.appVersion, 20),
    sanitizeString(payload.clientUUID, 120),
    payload.seq,
    sanitizeString(userEmail, 200)
  ];
  sheet.appendRow(row);
  return { ok: true, ts: new Date().toISOString() };
}

/**
 * Enregistre device.
 */
function upsertDevice(driverEmail, token, platform) {
  const sheet = getDevicesSheet();
  const rows = sheet.getLastRow() - 1;
  if (rows > 0) {
    const range = sheet.getRange(2, 1, rows, DEVICES_HEADERS.length);
    const values = range.getValues();
    for (let index = 0; index < values.length; index += 1) {
      if (values[index][0] === driverEmail) {
        sheet.getRange(index + 2, 1, 1, DEVICES_HEADERS.length).setValues([[driverEmail, token, platform, new Date()]]);
        return { ok: true };
      }
    }
  }
  sheet.appendRow([driverEmail, token, platform, new Date()]);
  return { ok: true };
}
