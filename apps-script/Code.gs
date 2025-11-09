/** @OnlyCurrentDoc */

const ALLOWED_METHODS = ['GET', 'POST'];
const HEADER_JSON = { 'Content-Type': 'application/json;charset=utf-8' };
const PWA_DOMAIN = PropertiesService.getScriptProperties().getProperty('PWA_DOMAIN') || 'https://DOMAIN';

/**
 * Entrée GET Apps Script.
 * @param {GoogleAppsScript.Events.DoGet} e requête
 * @return {GoogleAppsScript.Content.TextOutput}
 */
function doGet(e) {
  const pathInfo = e?.pathInfo || '';
  if (pathInfo && pathInfo.indexOf('api/') === 0) {
    return handleGetApi(pathInfo, e);
  }
  const html = HtmlService.createTemplateFromFile('Index');
  html.webAppUrl = PWA_DOMAIN;
  return html.evaluate()
    .setTitle('Module Livreur')
    .setSandboxMode(HtmlService.SandboxMode.IFRAME);
}

/**
 * Entrée POST JSON.
 * @param {GoogleAppsScript.Events.DoPost} e requête
 * @return {GoogleAppsScript.Content.TextOutput}
 */
function doPost(e) {
  if (!e || !e.postData) {
    return buildResponse({ ok: false, reason: 'MISSING_BODY' }, 400);
  }
  const pathInfo = e?.pathInfo || '';
  const route = pathInfo ? '/' + pathInfo : '';
  const json = parseBody(e.postData.contents);
  switch (route) {
    case '/api/saveDelivery':
      return buildResponse(handleSaveDelivery(json));
    case '/api/registerDevice':
      return buildResponse(handleRegisterDevice(json));
    default:
      return buildResponse({ ok: false, reason: 'NOT_FOUND' }, 404);
  }
}

function handleGetApi(pathInfo, e) {
  switch ('/' + pathInfo) {
    case '/api/eventInfo':
      return buildResponse(handleEventInfo(e?.parameter?.eventId, e?.parameter?.cmd));
    default:
      return buildResponse({ ok: false, reason: 'NOT_FOUND' }, 404);
  }
}

function buildResponse(payload, status) {
  const response = ContentService.createTextOutput(JSON.stringify(payload));
  response.setMimeType(ContentService.MimeType.JSON);
  if (status) {
    response.setResponseCode(status);
  }
  response.setHeader('Access-Control-Allow-Origin', PWA_DOMAIN);
  response.setHeader('Access-Control-Allow-Credentials', 'true');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  return response;
}

function parseBody(contents) {
  try {
    return JSON.parse(contents);
  } catch (err) {
    throw new Error('INVALID_JSON');
  }
}

function handleSaveDelivery(payload) {
  const userEmail = getCurrentUserEmail();
  assertAllowedDomain(userEmail);
  if (!payload?.eventId || !payload?.cmd) {
    return { ok: false, reason: 'MISSING_FIELDS' };
  }
  const photosFolder = PropertiesService.getScriptProperties().getProperty('DRIVE_PHOTOS_FOLDER_ID') || 'DRIVE_PHOTOS_FOLDER_ID';
  const sigFolder = PropertiesService.getScriptProperties().getProperty('DRIVE_SIG_FOLDER_ID') || 'DRIVE_SIG_FOLDER_ID';
  const signatureFileId = payload.signatureDataUrl ? saveBase64ToDrive(sigFolder, payload.signatureDataUrl, `sign-${payload.eventId}`) : '';
  const photoFileIds = (payload.photos || []).map((photo, index) => saveBase64ToDrive(photosFolder, photo, `photo-${payload.eventId}-${index}`));
  return appendJournalEntry(payload, userEmail, signatureFileId, photoFileIds);
}

function handleRegisterDevice(payload) {
  const email = sanitizeString(payload?.driverEmail, 200);
  if (!email) {
    return { ok: false, reason: 'MISSING_EMAIL' };
  }
  const token = sanitizeString(payload?.token, 1000);
  const platform = sanitizeString(payload?.platform || 'android', 50);
  return upsertDevice(email, token, platform);
}

function handleEventInfo(eventId, cmd) {
  if (!eventId) {
    return { ok: false, reason: 'MISSING_FIELDS' };
  }
  const calendarId = PropertiesService.getScriptProperties().getProperty('CALENDAR_ID') || 'CALENDAR_ID';
  const calendar = CalendarApp.getCalendarById(calendarId);
  const events = calendar.getEvents(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
  const target = events.find((event) => event.getId().split('@')[0] === eventId);
  if (!target) {
    return { ok: false, reason: 'NOT_FOUND' };
  }
  const meta = parseEventDescription(target.getDescription());
  return {
    ok: true,
    status: 'OPEN',
    items: [],
    driverEmail: meta.conducteur || '',
    receiver: { name: '', role: '' }
  };
}
