function test_livreurSheetStoreIdempotence() {
  try {
    const sheet = livreurGetJournalSheet();
    if (!sheet) {
      return { ok: false, reason: 'UNCONFIGURED' };
    }
  } catch (err) {
    return { ok: false, reason: 'ERROR', details: String(err) };
  }
  const payload = {
    eventId: 'TEST_EVENT',
    cmd: 'CMD123',
    status: 'OPEN',
    items: [],
    receiver: { name: 'Test', role: 'Agent' },
    temp: '',
    signatureFileId: '',
    photoFileIds: [],
    geo: null,
    device: { id: 'TEST', battery: '', appVersion: '1.0.0' },
    clientUUID: 'UUID',
    seq: 1,
    userEmail: 'test@example.com'
  };
  livreurAppendJournalEntry(payload);
  const result = livreurAppendJournalEntry(payload);
  return result.duplicate === true ? { ok: true } : { ok: false, reason: 'FAILED' };
}

function test_livreurFcmJwtGeneration() {
  try {
    const sa = getSecret('FCM_SA_JSON');
    if (!sa) {
      return { ok: false, reason: 'UNCONFIGURED' };
    }
    const token = livreurBuildFcmJwt(JSON.parse(sa));
    return token ? { ok: true } : { ok: false, reason: 'FAILED' };
  } catch (_err) {
    return { ok: false, reason: 'UNCONFIGURED' };
  }
}

function test_livreurEndToEndSimulation() {
  try {
    const sheet = livreurGetJournalSheet();
    if (!sheet) {
      return { ok: false, reason: 'UNCONFIGURED' };
    }
  } catch (_err) {
    return { ok: false, reason: 'UNCONFIGURED' };
  }
  const payload = {
    eventId: 'SIM_EVENT',
    cmd: 'CMD999',
    clientUUID: 'SIMUUID',
    seq: Math.floor(Math.random() * 1000) + 1,
    status: 'OPEN',
    items: [{ barcode: '123', qty: 1 }],
    receiver: { name: 'Simu', role: 'Test' },
    photos: [],
    temp: '',
    signatureDataUrl: '',
    photoFileIds: [],
    geo: null,
    device: { id: 'SIM', battery: '', appVersion: '1.0.0' },
    timestamps: {},
    userEmail: 'sim@example.com'
  };
  const result = livreurHandleSaveDelivery(payload);
  if (result && result.ok) {
    return { ok: true };
  }
  if (result && result.reason === 'UNAUTHORIZED') {
    return { ok: false, reason: 'UNAUTHORIZED' };
  }
  return { ok: false, reason: 'FAILED' };
}
