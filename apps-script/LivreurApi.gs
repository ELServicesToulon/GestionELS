/**
 * Routeur HTTP pour le module livreur (PWA + notifications).
 * Fournit les endpoints REST consommés par la TWA et le worker Calendar.
 */
const LIVREUR_API_ROUTES = Object.freeze({
  '/api/savedelivery': 'POST',
  '/api/registerdevice': 'POST',
  '/api/eventinfo': 'GET',
  '/app': 'GET',
  '/app/': 'GET'
});

/**
 * Gère les requêtes GET dirigées vers le module livreur.
 * @param {GoogleAppsScript.Events.DoGet} e
 * @return {GoogleAppsScript.Content.TextOutput|null}
 */
function livreurHandleGet(e) {
  if (!LIVREUR_MODULE_ENABLED) {
    return null;
  }
  const path = livreurNormalizePath_(e && e.pathInfo);
  if (!path) {
    return null;
  }
  if (!Object.prototype.hasOwnProperty.call(LIVREUR_API_ROUTES, path)) {
    return null;
  }
  if (path === '/app' || path === '/app/') {
    return livreurRenderLauncher_();
  }
  if (path === '/api/eventinfo') {
    const eventId = e && e.parameter ? e.parameter.eventId : '';
    const cmd = e && e.parameter ? e.parameter.cmd : '';
    return livreurBuildJsonResponse_(livreurHandleEventInfo(eventId, cmd));
  }
  return livreurBuildJsonResponse_({ ok: false, reason: 'NOT_FOUND' }, 404);
}

/**
 * Gère les requêtes POST/OPTIONS dirigées vers le module livreur.
 * @param {GoogleAppsScript.Events.DoPost} e
 * @return {GoogleAppsScript.Content.TextOutput|null}
 */
function livreurHandlePost(e) {
  if (!LIVREUR_MODULE_ENABLED) {
    return null;
  }
  const path = livreurNormalizePath_(e && e.pathInfo);
  if (!path || !Object.prototype.hasOwnProperty.call(LIVREUR_API_ROUTES, path)) {
    return null;
  }
  const method = String(e && e.requestMethod ? e.requestMethod : 'POST').toUpperCase();
  if (method === 'OPTIONS') {
    return livreurBuildEmptyResponse_(204);
  }
  const expected = LIVREUR_API_ROUTES[path];
  if (expected !== method) {
    return livreurBuildJsonResponse_({ ok: false, reason: 'METHOD_NOT_ALLOWED' }, 405);
  }
  let payload = {};
  try {
    payload = livreurParseJsonPayload_(e && e.postData ? e.postData.contents : '');
  } catch (_err) {
    return livreurBuildJsonResponse_({ ok: false, reason: 'INVALID_JSON' }, 400);
  }
  switch (path) {
    case '/api/savedelivery':
      return livreurBuildJsonResponse_(livreurHandleSaveDelivery(payload));
    case '/api/registerdevice':
      return livreurBuildJsonResponse_(livreurHandleRegisterDevice(payload));
    default:
      return livreurBuildJsonResponse_({ ok: false, reason: 'NOT_FOUND' }, 404);
  }
}

/**
 * Traite la sauvegarde d'une fiche livraison.
 * @param {Object} payload
 * @return {{ok:boolean,reason?:string,ts?:string,duplicate?:boolean}}
 */
function livreurHandleSaveDelivery(payload) {
  if (!payload || typeof payload !== 'object') {
    return { ok: false, reason: 'MISSING_FIELDS' };
  }
  try {
    const userEmail = getCurrentUserEmail();
    assertAllowedDomain(userEmail);
    const eventId = sanitizeScalar(payload.eventId, 120);
    const cmd = sanitizeScalar(payload.cmd, 120);
    const clientUUID = sanitizeScalar(payload.clientUUID, 120);
    const seq = Number(payload.seq || 0);
    if (!eventId || !cmd || !clientUUID || !seq) {
      return { ok: false, reason: 'MISSING_FIELDS' };
    }
    const status = sanitizeScalar(payload.status, 20) || 'OPEN';
    const receiver = {
      name: sanitizeScalar(payload.receiver && payload.receiver.name, 120),
      role: sanitizeScalar(payload.receiver && payload.receiver.role, 80)
    };
    const sanitizedItems = Array.isArray(payload.items)
      ? payload.items.slice(0, 50).map(function (item) {
          return {
            barcode: sanitizeScalar(item && item.barcode, 120),
            qty: Number(item && item.qty) || 0,
            temp: typeof item !== 'undefined' && typeof item.temp === 'number' ? Number(item.temp) : ''
          };
        })
      : [];
    const geo = livreurRoundGeo(payload.geo);
    const deviceId = sanitizeScalar(payload.device && payload.device.id, 120);
    const battery = payload.device && typeof payload.device.battery === 'number'
      ? Math.max(0, Math.min(1, Number(payload.device.battery)))
      : '';
    const appVersion = sanitizeScalar(payload.device && payload.device.appVersion, 32);
    const temp = typeof payload.temp === 'number' ? Number(payload.temp) : '';
    const timestamps = payload.timestamps && typeof payload.timestamps === 'object'
      ? {
          opened: sanitizeScalar(payload.timestamps.opened, 40),
          arrived: sanitizeScalar(payload.timestamps.arrived, 40),
          submitted: sanitizeScalar(payload.timestamps.submitted, 40)
        }
      : {};
    const photosFolderId = livreurGetConfigValue_('DRIVE_PHOTOS_FOLDER_ID', '');
    const sigFolderId = livreurGetConfigValue_('DRIVE_SIG_FOLDER_ID', '');
    if (!photosFolderId || !sigFolderId) {
      return { ok: false, reason: 'UNCONFIGURED' };
    }
    const limitedPhotos = Array.isArray(payload.photos) ? payload.photos.slice(0, 10) : [];
    var signatureFileId = '';
    if (payload.signatureDataUrl) {
      signatureFileId = saveBase64ToDrive(sigFolderId, String(payload.signatureDataUrl), 'sign-' + eventId);
    }
    const photoFileIds = [];
    for (var i = 0; i < limitedPhotos.length; i += 1) {
      const photoDataUrl = String(limitedPhotos[i] || '');
      if (!photoDataUrl) {
        continue;
      }
      photoFileIds.push(saveBase64ToDrive(photosFolderId, photoDataUrl, 'photo-' + eventId + '-' + i));
    }
    const entryPayload = {
      eventId: eventId,
      cmd: cmd,
      status: status,
      items: sanitizedItems,
      receiver: receiver,
      temp: temp,
      signatureFileId: signatureFileId,
      photoFileIds: photoFileIds,
      geo: geo,
      device: { id: deviceId, battery: battery, appVersion: appVersion },
      clientUUID: clientUUID,
      seq: seq,
      timestamps: timestamps,
      userEmail: userEmail
    };
    return livreurAppendJournalEntry(entryPayload);
  } catch (err) {
    const message = err && err.message ? String(err.message) : '';
    if (message === 'UNCONFIGURED') {
      return { ok: false, reason: 'UNCONFIGURED' };
    }
    if (message === 'INVALID_JSON') {
      return { ok: false, reason: 'INVALID_JSON' };
    }
    return { ok: false, reason: 'ERROR', details: sanitizeScalar(message, 200) };
  }
}

/**
 * Enregistre le token FCM d'un chauffeur.
 * @param {Object} payload
 * @return {{ok:boolean,reason?:string}}
 */
function livreurHandleRegisterDevice(payload) {
  if (!payload || typeof payload !== 'object') {
    return { ok: false, reason: 'MISSING_FIELDS' };
  }
  const email = sanitizeEmail(payload.driverEmail);
  if (!email) {
    return { ok: false, reason: 'INVALID_EMAIL' };
  }
  try {
    assertAllowedDomain(email);
  } catch (_err) {
    return { ok: false, reason: 'UNAUTHORIZED' };
  }
  const token = sanitizeScalar(payload.token, 1024);
  if (!token) {
    return { ok: false, reason: 'MISSING_FIELDS' };
  }
  const platform = sanitizeScalar(payload.platform || 'android', 32) || 'android';
  return livreurUpsertDevice({ driverEmail: email, token: token, platform: platform });
}

/**
 * Retourne les métadonnées d'un événement Calendar pour préremplir la fiche.
 * @param {string} eventIdRaw
 * @param {string} cmdRaw
 * @return {{ok:boolean,reason?:string,meta?:Object,driverEmail?:string}}
 */
function livreurHandleEventInfo(eventIdRaw, cmdRaw) {
  const eventId = sanitizeScalar(eventIdRaw, 200);
  if (!eventId) {
    return { ok: false, reason: 'MISSING_FIELDS' };
  }
  const calendarId = livreurResolveCalendarId_();
  if (!calendarId) {
    return { ok: false, reason: 'UNCONFIGURED' };
  }
  const event = livreurFindCalendarEvent_(calendarId, eventId);
  if (!event) {
    return { ok: false, reason: 'NOT_FOUND' };
  }
  const meta = typeof livreurParseEventDescription === 'function'
    ? livreurParseEventDescription(event.getDescription())
    : {};
  const driverEmail = sanitizeEmail(meta.conducteur || meta.driverEmail || '');
  return {
    ok: true,
    eventId: eventId,
    cmd: sanitizeScalar(cmdRaw, 120),
    driverEmail: driverEmail,
    meta: {
      ehpad: sanitizeScalar(meta.ehpad || '', 120),
      fenetre: sanitizeScalar(meta.fenetre || '', 120),
      adresse: sanitizeMultiline(meta.adresse || '', 200)
    }
  };
}

// ---------------------------------------------------------------------------
// Helpers internes
// ---------------------------------------------------------------------------

function livreurNormalizePath_(pathInfo) {
  if (!pathInfo) {
    return '';
  }
  const raw = String(pathInfo).trim();
  if (!raw) {
    return '';
  }
  let normalized = raw.charAt(0) === '/' ? raw : '/' + raw;
  normalized = normalized.replace(/\/+/g, '/');
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.replace(/\/+$/, '/');
  }
  return normalized.toLowerCase();
}

function livreurRenderLauncher_() {
  const template = HtmlService.createTemplateFromFile('Index');
  template.webAppUrl = livreurGetPwaOrigin_();
  return template.evaluate()
    .setTitle('Module Livreur')
    .setSandboxMode(HtmlService.SandboxMode.IFRAME);
}

function livreurBuildJsonResponse_(payload, status) {
  const response = ContentService.createTextOutput(JSON.stringify(payload || {}));
  response.setMimeType(ContentService.MimeType.JSON);
  if (status) {
    response.setResponseCode(status);
  }
  livreurApplyCors_(response);
  return response;
}

function livreurBuildEmptyResponse_(status) {
  const response = ContentService.createTextOutput('');
  response.setMimeType(ContentService.MimeType.JSON);
  if (status) {
    response.setResponseCode(status);
  }
  livreurApplyCors_(response);
  return response;
}

function livreurApplyCors_(response) {
  const origin = livreurGetPwaOrigin_();
  response.setHeader('Access-Control-Allow-Origin', origin);
  response.setHeader('Access-Control-Allow-Credentials', 'true');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
}

function livreurParseJsonPayload_(contents) {
  if (!contents) {
    return {};
  }
  try {
    return JSON.parse(String(contents));
  } catch (_err) {
    throw new Error('INVALID_JSON');
  }
}

function livreurGetPwaOrigin_() {
  const defaults = 'https://DOMAIN';
  try {
    const origin = sanitizeScalar(getSecret('LIVREUR_PWA_ORIGIN'), 200);
    return origin || defaults;
  } catch (_err) {
    const fallback = PropertiesService.getScriptProperties().getProperty('PWA_DOMAIN');
    return sanitizeScalar(fallback, 200) || defaults;
  }
}

function livreurGetConfigValue_(key, defaultValue) {
  try {
    const value = sanitizeScalar(getSecret(key), 256);
    return value || defaultValue;
  } catch (_err) {
    const raw = PropertiesService.getScriptProperties().getProperty(key);
    if (!raw) {
      return defaultValue;
    }
    return sanitizeScalar(raw, 256) || defaultValue;
  }
}

function livreurResolveCalendarId_() {
  try {
    return sanitizeScalar(getSecret('CALENDAR_ID'), 256);
  } catch (_err) {
    try {
      return sanitizeScalar(getSecret('ID_CALENDRIER'), 256);
    } catch (_err2) {
      const raw = PropertiesService.getScriptProperties().getProperty('CALENDAR_ID')
        || PropertiesService.getScriptProperties().getProperty('ID_CALENDRIER');
      return sanitizeScalar(raw, 256);
    }
  }
}

function livreurFindCalendarEvent_(calendarId, eventId) {
  if (!calendarId) {
    return null;
  }
  const calendar = CalendarApp.getCalendarById(calendarId);
  if (!calendar) {
    return null;
  }
  const direct = CalendarApp.getEventById(eventId);
  if (direct) {
    return direct;
  }
  const suffixed = CalendarApp.getEventById(eventId + '@google.com');
  if (suffixed) {
    return suffixed;
  }
  const start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const events = calendar.getEvents(start, end);
  for (var i = 0; i < events.length; i += 1) {
    const evt = events[i];
    if (evt && evt.getId && evt.getId().split('@')[0] === eventId) {
      return evt;
    }
  }
  return null;
}
