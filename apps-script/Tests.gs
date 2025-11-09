function test_sheetStoreIdempotence() {
  const sheetId = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (!sheetId) {
    Logger.log('SHEET_ID non configuré, test ignoré');
    return { ok: false, reason: 'UNCONFIGURED' };
  }
  const payload = {
    eventId: 'TEST_EVENT',
    cmd: 'CMD123',
    status: 'OPEN',
    items: [],
    receiver: { name: 'Test', role: 'Agent' },
    photos: [],
    device: { id: 'TEST', appVersion: '1.0.0' },
    clientUUID: 'UUID',
    seq: 1
  };
  appendJournalEntry(payload, 'test@example.com', '', []);
  const result = appendJournalEntry(payload, 'test@example.com', '', []);
  return result.duplicate === true;
}

function test_fcmJwtGeneration() {
  const sa = PropertiesService.getScriptProperties().getProperty('FCM_SA_JSON');
  if (!sa) {
    Logger.log('FCM_SA_JSON manquant');
    return { ok: false, reason: 'UNCONFIGURED' };
  }
  const serviceAccount = JSON.parse(sa);
  const token = buildFcmJwt(serviceAccount);
  return Boolean(token);
}

function test_endToEndSimulation() {
  const sheetId = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (!sheetId) {
    return { ok: false, reason: 'UNCONFIGURED' };
  }
  const payload = {
    eventId: 'SIM_EVENT',
    cmd: 'CMD999',
    status: 'OPEN',
    items: [{ barcode: '123', qty: 1 }],
    receiver: { name: 'Simu', role: 'Test' },
    photos: [],
    device: { id: 'SIM', appVersion: '1.0.0' },
    clientUUID: 'SIMUUID',
    seq: Math.floor(Math.random() * 1000)
  };
  const result = handleSaveDelivery(payload);
  return result.ok === true;
}
