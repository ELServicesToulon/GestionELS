/**
 * ELS – AUDIT + TRACE + WEBAPP (tout-en-un)
 * Contenu:
 *  - auditProject(): feuille "Audit_AppsScript" (scopes, webapps, triggers, libs, props, versions, secrets)
 *  - installAuditTrigger(): trigger hebdo Lundi 03:00
 *  - setupTraceSheet(): feuille "TRACE_Livraisons" + validations + protections
 *  - logDeliveryEvent(evt): journalise un événement (pseudonymisation via HMAC)
 *  - doPost(e): endpoint WebApp sécurisé (HMAC + fenêtre ±5 min + anti-rejeu + idempotence)
 * Props requises: TRACE_SECRET (chaîne longue aléatoire)
 * Fuseau: Fichier > Paramètres du projet > Europe/Paris
 */

/* ========================  A. AUDIT  ======================== */
function generateTraceSecret() {
  const secret = Utilities.base64Encode(
    Utilities.getUuid() + Utilities.getUuid() + Utilities.getUuid()
  ).replace(/=+$/,'');
  PropertiesService.getScriptProperties().setProperty('TRACE_SECRET', secret);
  Logger.log('TRACE_SECRET créé ✅ : ' + secret);
}

/**
 * Génère la feuille "Audit_AppsScript" avec l'état du projet.
 * Nécessite le service avancé: Script (Apps Script API) activé.
 */
function auditProject() {
  const ss = SpreadsheetApp.getActive() || SpreadsheetApp.create('Audit_AppsScript_' + new Date().toISOString());
  const sh = createOrClearSheet_(ss, 'Audit_AppsScript');

  const scriptId = ScriptApp.getScriptId();
  const now = new Date();

  // 1) Scopes (runtime + manifest)
  const scopesRuntime = tryCatch_(() => ScriptApp.getOAuthScopes(), []);
  const content = tryCatch_(() => Script.Projects.getContent({scriptId}), null);
  const manifest = getManifest_(content);
  const scopesManifest = (manifest && manifest.oauthScopes) ? manifest.oauthScopes : [];

  // 2) Déploiements + WebApp
  const deployments = tryCatch_(() => Script.Projects.Deployments.list({scriptId}).deployments || [], []);
  const versions = tryCatch_(() => Script.Projects.Versions.list({scriptId}).versions || [], []);

  // 3) Triggers
  const triggers = tryCatch_(() => ScriptApp.getProjectTriggers(), []);

  // 4) Dépendances (libs + services avancés)
  const libs = (manifest && manifest.dependencies && manifest.dependencies.libraries) ? manifest.dependencies.libraries : [];
  const advServices = (manifest && manifest.dependencies && manifest.dependencies.enabledAdvancedServices) ? manifest.dependencies.enabledAdvancedServices : [];

  // 5) Propriétés (clés visibles, pas valeurs)
  const scriptProps = PropertiesService.getScriptProperties().getProperties();
  const userProps = PropertiesService.getUserProperties().getProperties();

  // 6) Scan de secrets potentiels
  const suspectFindings = scanCodeForSecrets_(content);

  // 7) Résumé risques simples
  const broadScopes = [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/admin.directory.user',
  ];
  const flaggedScopes = (scopesRuntime || []).filter(s => broadScopes.includes(s));
  const usesDriveFull = flaggedScopes.includes('https://www.googleapis.com/auth/drive');
  const usesGmailModify = flaggedScopes.includes('https://www.googleapis.com/auth/gmail.modify');

  const webApps = flatten_((deployments || []).map(d => (d.entryPoints || []).filter(e => e.type === 'WEB_APP').map(e => ({
    deploymentId: d.deploymentId,
    versionNumber: d.deploymentConfig && d.deploymentConfig.versionNumber,
    updateTime: d.updateTime || '',
    url: (e.webApp && e.webApp.url) || '',
    access: (e.webApp && e.webApp.access) || '',
    executeAs: (e.webApp && e.webApp.executeAs) || '',
  }))));

  // --- Écriture feuille ---
  let r = 1;
  sh.getRange(r++,1,1,2).setValues([['Audit horodaté', now.toISOString()]]);
  sh.getRange(r++,1,1,2).setValues([['Script ID', scriptId]]);
  r++;

  r = writeBlock_(sh, r, 'Scopes (runtime) – utilisés par le code', arrayOf_(scopesRuntime));
  r = writeBlock_(sh, r, 'Scopes (manifest) – déclarés', arrayOf_(scopesManifest));
  r = writeBlock_(sh, r, 'Scopes potentiellement larges (à réduire si possible)', arrayOf_(flaggedScopes));

  r = writeTable_(sh, r, 'Déploiements Web App', ['deploymentId','versionNumber','updateTime','executeAs','access','url'], webApps);

  const versionsTbl = (versions || []).map(v => ({
    versionNumber: v.versionNumber,
    description: v.description || '',
    createTime: v.createTime || ''
  }));
  r = writeTable_(sh, r, 'Versions', ['versionNumber','description','createTime'], versionsTbl);

  const trigRows = (triggers || []).map(t => ({
    handlerFunction: t.getHandlerFunction(),
    type: String(t.getEventType ? t.getEventType() : t.getTriggerSource()),
    source: String(t.getTriggerSource()),
    schedule: t.getTriggerSource() === ScriptApp.TriggerSource.CLOCK ? 'time-based' : ''
  }));
  r = writeTable_(sh, r, 'Triggers', ['handlerFunction','type','source','schedule'], trigRows);

  const libRows = (libs || []).map(l => ({libraryId: l.libraryId, userSymbol: l.userSymbol, version: l.version || '', developmentMode: !!l.developmentMode}));
  r = writeTable_(sh, r, 'Bibliothèques', ['libraryId','userSymbol','version','developmentMode'], libRows);

  const advRows = (advServices || []).map(s => ({serviceId: s.serviceId, version: s.version}));
  r = writeTable_(sh, r, 'Services avancés', ['serviceId','version'], advRows);

  r = writeKVBlock_(sh, r, 'ScriptProperties (clés visibles, pas les valeurs)', scriptProps);
  r = writeKVBlock_(sh, r, 'UserProperties (clés visibles, pas les valeurs)', userProps);

  r = writeBlock_(sh, r, 'Motifs secrets suspects dans le code (vérifier & déplacer en Properties)', suspectFindings.length ? suspectFindings : ['RAS']);

  const recos = [];
  if (usesDriveFull) recos.push('Remplacer scope Drive complet par drive.file si possible.');
  if (usesGmailModify) recos.push('Limiter Gmail à gmail.send ou éviter Gmail si non nécessaire.');
  if (webApps.some(w => w.executeAs === 'USER_ACCESSING')) recos.push('Pour process serveur, préférer executeAs=ME + access=DOMAIN si adapté.');
  if (Object.keys(scriptProps).length === 0 && suspectFindings.length) recos.push('Déplacer clés/API en ScriptProperties et supprimer du code.');
  if (triggers.length === 0) recos.push('Ajouter un trigger d’audit périodique (hebdo) pour surveiller dérives.');
  r = writeBlock_(sh, r, 'Recommandations rapides', recos.length ? recos : ['OK']);

  sh.autoResizeColumns(1, 8);
  SpreadsheetApp.flush();
  Logger.log('Audit terminé → ' + ss.getUrl());
}

/* ========================  B. TRIGGER  ======================== */

/**
 * Installe un trigger hebdo (lundi 03:00 Europe/Paris) pour auditProject().
 * Idempotent (supprime l’existant).
 */
function installAuditTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'auditProject')
    .forEach(t => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger('auditProject')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(3)
    .create();

  Logger.log('Trigger hebdo installé – Lundi 03:00');
}

/* ========================  C. TRACE – FEUILLE & LOGGER  ======================== */

/**
 * Crée/normalise la feuille TRACE_Livraisons (schéma, validations, protections).
 */
function setupTraceSheet() {
  const SHEET_NAME = 'TRACE_Livraisons';
  const ss = SpreadsheetApp.getActive() || SpreadsheetApp.create('TRACE_Livraisons');
  const sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  sh.clear();

  const headers = [
    'ts_iso','tournee_id','livraison_id','ehpad_id','patient_hash','chauffeur_id',
    'status','gps_lat','gps_lng','photo_url','signature_hash','anomalie_code',
    'anomalie_note','app_version','device_id','by_user'
  ];
  sh.getRange(1,1,1,headers.length).setValues([headers]).setFontWeight('bold');

  const statusList = ['PENDING','EN_ROUTE','DELIVERED','FAILED'];
  const anomList   = ['','LATE','ABSENT','REFUS','ERREUR_PREPA','AUTRE'];

  const statusRule = SpreadsheetApp.newDataValidation().requireValueInList(statusList, true).setAllowInvalid(false).build();
  const anomRule   = SpreadsheetApp.newDataValidation().requireValueInList(anomList, true).setAllowInvalid(true).build();

  sh.getRange(2, headers.indexOf('status')+1, sh.getMaxRows(), 1).setDataValidation(statusRule);
  sh.getRange(2, headers.indexOf('anomalie_code')+1, sh.getMaxRows(), 1).setDataValidation(anomRule);

  sh.setFrozenRows(1);
  sh.autoResizeColumns(1, headers.length);
  sh.getRange('A:A').setNumberFormat('@');
  sh.getRange('G:G').setNumberFormat('@');
  sh.getRange('L:L').setNumberFormat('@');

  const prot = sh.getRange(1,1,1,headers.length).protect().setDescription('Headers protégés');
  try { prot.removeEditors(prot.getEditors()); } catch(e){}

  Logger.log('Feuille TRACE_Livraisons prête: ' + ss.getUrl());
}

/**
 * Journalise un évènement de livraison (pseudonymisation HMAC).
 * Props: TRACE_SECRET (ScriptProperties)
 */
function logDeliveryEvent(evt) {
  const SHEET_NAME = 'TRACE_Livraisons';
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  if (!sh) throw new Error('TRACE_Livraisons introuvable. Lancez setupTraceSheet().');

  const secret = PropertiesService.getScriptProperties().getProperty('TRACE_SECRET');
  if (!secret) throw new Error('TRACE_SECRET manquant dans ScriptProperties.');

  const nowIso = new Date().toISOString();
  const hash = (txt) => Utilities.base64Encode(
    Utilities.computeHmacSha256Signature(txt || '', secret)
  ).replace(/=+$/,'');

  const row = [
    nowIso,
    evt.tournee_id || '',
    evt.livraison_id || '',
    evt.ehpad_id || '',
    hash(evt.patient_ref || ''),                 // pas d’identité en clair
    evt.chauffeur_id || '',
    evt.status || 'PENDING',
    evt.gps_lat || '',
    evt.gps_lng || '',
    evt.photo_url || '',
    evt.signature_ref ? hash(evt.signature_ref) : '',
    evt.anomalie_code || '',
    evt.anomalie_note ? String(evt.anomalie_note).slice(0,180) : '',
    evt.app_version || '',
    evt.device_id || '',
    Session.getActiveUser().getEmail() || 'system'
  ];

  sh.appendRow(row);
}

/* ========================  D. WEBAPP SECURISEE  ======================== */

/**
 * WebApp JSON → TRACE_Livraisons via logDeliveryEvent(evt)
 * Sécurité: HMAC SHA256(ts.body), tolérance ±300s, anti-rejeu, idempotence.
 * Appel: POST URL?ts=1699999999&sig=BASE64  body=JSON(evt)
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return _resp(400, {ok:false, error:'EMPTY_BODY'});
    }
    const body = e.postData.contents;
    const params = e.parameter || {};
    const ts = parseInt(params.ts, 10);
    const sig = params.sig || '';
    if (!ts || !sig) return _resp(400, {ok:false, error:'MISSING_TS_OR_SIG'});

    const nowSec = Math.floor(Date.now()/1000);
    if (Math.abs(nowSec - ts) > 300) return _resp(401, {ok:false, error:'TS_OUT_OF_WINDOW'});

    const secret = PropertiesService.getScriptProperties().getProperty('TRACE_SECRET');
    if (!secret) return _resp(500, {ok:false, error:'TRACE_SECRET_NOT_SET'});

    const computed = Utilities.base64Encode(
      Utilities.computeHmacSha256Signature(`${ts}.${body}`, secret)
    ).replace(/=+$/,'');
    if (computed !== sig) return _resp(401, {ok:false, error:'BAD_SIGNATURE'});

    let evt;
    try { evt = JSON.parse(body); } catch(_) {
      return _resp(400, {ok:false, error:'INVALID_JSON'});
    }

    const idemKey = buildIdemKey_(evt, ts);
    const cache = CacheService.getScriptCache();
    if (cache.get(idemKey)) return _resp(200, {ok:true, dedup:true, idemKey});
    cache.put(idemKey, '1', 600); // 10 min

    const required = ['tournee_id','livraison_id','ehpad_id','chauffeur_id','status'];
    const missing = required.filter(k => !evt[k]);
    if (missing.length) return _resp(400, {ok:false, error:'MISSING_FIELDS', fields:missing});

    logDeliveryEvent(evt);
    return _resp(200, {ok:true, idemKey});
  } catch (err) {
    return _resp(500, {ok:false, error:'SERVER_ERROR', detail:String(err)});
  }
}

/* ========================  E. HELPERS COMMUNS  ======================== */

function createOrClearSheet_(ss, name){
  const sh = ss.getSheetByName(name) || ss.insertSheet(name);
  sh.clear();
  return sh;
}
function writeBlock_(sh, r, title, lines){
  sh.getRange(r++,1).setValue(title).setFontWeight('bold');
  (lines || []).forEach(line => sh.getRange(r++,1).setValue(line));
  r++; return r;
}
function writeKVBlock_(sh, r, title, obj){
  sh.getRange(r++,1).setValue(title).setFontWeight('bold');
  Object.keys(obj || {}).sort().forEach(k => sh.getRange(r++,1,1,2).setValues([[k,'(masqué)']]));
  r++; return r;
}
function writeTable_(sh, r, title, headers, rows){
  sh.getRange(r++,1).setValue(title).setFontWeight('bold');
  sh.getRange(r,1,1,headers.length).setValues([headers]).setFontWeight('bold'); r++;
  if ((rows||[]).length){
    const data = rows.map(o => headers.map(h => (o[h]!==undefined && o[h]!==null) ? String(o[h]) : ''));
    sh.getRange(r,1,data.length,headers.length).setValues(data);
    r += data.length;
  }
  r++; return r;
}
function arrayOf_(arr){ return (arr && arr.length) ? arr : ['(aucun)']; }
function flatten_(a){ return [].concat.apply([], a); }
function tryCatch_(fn, fallback){ try { return fn(); } catch(e){ return fallback; } }

function getManifest_(content){
  if (!content || !content.files) return null;
  const mf = content.files.find(f => f.name === 'appsscript' && f.type === 'JSON');
  return mf ? JSON.parse(mf.source) : null;
}
function scanCodeForSecrets_(content){
  if (!content || !content.files) return [];
  const files = content.files.filter(f => f.type === 'SERVER_JS' || f.type === 'HTML' || f.type === 'JSON');
  const findings = [];
  const reList = [
    /api[_-]?key\s*[:=]\s*['"][A-Za-z0-9_\-]{16,}['"]/gi,
    /secret\s*[:=]\s*['"][A-Za-z0-9_\-]{16,}['"]/gi,
    /token\s*[:=]\s*['"][A-Za-z0-9_\-]{16,}['"]/gi,
    /OPENAI_API_KEY\s*[:=]\s*['"][^'"]+['"]/gi
  ];
  files.forEach(f=>{
    const src = f.source || '';
    reList.forEach(re=>{
      const m = src.match(re);
      if (m && m.length) findings.push(`${f.name}: ${m.slice(0,3).join(' | ')}${m.length>3?' …':''}`);
    });
  });
  return findings;
}
function _resp(status, obj){
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON)
    .setResponseCode(status);
}
function buildIdemKey_(evt, ts){
  const parts = ['IDEM', evt && evt.livraison_id || '', evt && evt.tournee_id || '', evt && evt.status || '', String(ts)];
  return parts.join('|').slice(0,230);
}

/* ========================  F. DEMO (optionnel)  ======================== */

function demo_log() {
  logDeliveryEvent({
    tournee_id: '2025-11-11-AM-Var',
    livraison_id: 'PKG-000123',
    ehpad_id: 'EHPAD-VALFLEURI',
    patient_ref: 'DOSS-84521',
    chauffeur_id: 'DRV-07',
    status: 'DELIVERED',
    gps_lat: 43.124, gps_lng: 5.928,
    photo_url: 'https://drive.google.com/…',
    signature_ref: 'SIG-12345',
    anomalie_code: '',
    anomalie_note: '',
    app_version: 'ELSDriver 1.3.2',
    device_id: 'XCover6-ELS-03'
  });
}


