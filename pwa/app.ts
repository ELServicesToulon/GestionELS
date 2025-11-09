declare class ImageCapture {
  constructor(track: MediaStreamTrack);
  grabFrame(): Promise<ImageBitmap>;
}

interface BatteryManager {
  level: number;
}

import { initUI, renderStatus, renderActions, renderItems, renderReceiver, bindReceiver, renderSignature, renderPhotos, renderLogs, showToast } from './ui.js';
import { createQueue } from './idb.js';
import { setupBarcodeScanner } from './barcode.js';
import { setupSignaturePad } from './signature.js';
import { requestCurrentPosition } from './geo.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const firebaseConfig: any = null; // TODO: importer depuis firebase-config.js après bundling.

interface DeliveryItem {
  barcode: string;
  qty: number;
  temp?: number;
}

interface DeliveryPayload {
  eventId: string;
  cmd: string;
  driverEmail: string;
  clientUUID: string;
  seq: number;
  status: string;
  items: DeliveryItem[];
  receiver?: { name?: string; role?: string };
  temp?: number;
  signatureDataUrl?: string | null;
  photos: string[];
  geo?: { lat: number; lng: number; accuracy?: number } | null;
  device: { id: string; battery?: number; appVersion: string };
  timestamps: Record<string, string>;
}

type StatusKey = 'OPEN' | 'ARRIVED' | 'OK' | 'NC' | 'ABSENT' | 'WAIT' | 'CANCEL' | 'DONE';

const appState = {
  eventId: '',
  cmd: '',
  status: 'OPEN' as StatusKey,
  items: [] as DeliveryItem[],
  receiver: { name: '', role: '' },
  signature: null as string | null,
  photos: [] as string[],
  driverEmail: '',
  clientUUID: crypto.randomUUID(),
  seq: 0,
  openedAt: new Date().toISOString(),
  arrivedAt: '',
  submittedAt: '',
  fcmToken: '',
  messagingReady: false,
  synced: false
};

const queue = createQueue('livreur-db', 1);

const STATUS_ACTIONS: Record<StatusKey, StatusKey[]> = {
  OPEN: ['ARRIVED', 'CANCEL', 'WAIT'],
  ARRIVED: ['OK', 'NC', 'ABSENT', 'WAIT'],
  OK: ['DONE'],
  NC: ['DONE'],
  ABSENT: ['DONE'],
  WAIT: ['OK', 'NC', 'ABSENT', 'CANCEL'],
  CANCEL: ['DONE'],
  DONE: []
};

const STATUS_LABELS: Record<StatusKey, string> = {
  OPEN: 'Ouverte',
  ARRIVED: 'Arrivé',
  OK: 'Livraison OK',
  NC: 'Non Conformité',
  ABSENT: 'Absent',
  WAIT: 'Attente',
  CANCEL: 'Annulé',
  DONE: 'Clôturé'
};

const WEB_APP_URL = 'WEB_APP_URL';

let messaging: import('firebase/messaging').Messaging | null = null;

const initializeFirebaseMessaging = async (): Promise<void> => {
  if (!firebaseConfig) {
    console.warn('firebaseConfig manquant');
    return;
  }
  const { initializeApp } = await import('https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js');
  const { getMessaging, getToken, onMessage, isSupported } = await import('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging.js');
  if (!(await isSupported())) {
    console.warn('Firebase messaging non supporté');
    return;
  }
  const app = initializeApp(firebaseConfig);
  messaging = getMessaging(app);
  try {
    const token = await getToken(messaging, {
      vapidKey: 'TODO:VAPID_KEY'
    });
    if (token) {
      appState.fcmToken = token;
      appState.messagingReady = true;
      await registerDevice(token, 'web');
    }
  } catch (error) {
    console.error('Erreur getToken', error);
  }
  onMessage(messaging, (payload) => {
    console.info('Message web reçu', payload);
    if (payload?.data?.eventId && payload.data.eventId === appState.eventId) {
      showToast('Notification reçue.');
    }
  });
};

const parseUrlParams = (): void => {
  const url = new URL(window.location.href);
  appState.eventId = url.searchParams.get('eventId') || '';
  appState.cmd = url.searchParams.get('cmd') || '';
};

const loadEventInfo = async (): Promise<void> => {
  if (!appState.eventId) {
    return;
  }
  try {
    const response = await fetch(`${WEB_APP_URL}/api/eventInfo?eventId=${encodeURIComponent(appState.eventId)}&cmd=${encodeURIComponent(appState.cmd)}`, {
      credentials: 'include'
    });
    if (!response.ok) {
      throw new Error('Impossible de charger les métadonnées');
    }
    const data = await response.json();
    if (data?.status) {
      appState.status = data.status as StatusKey;
    }
    if (data?.items) {
      appState.items = data.items;
    }
    if (data?.driverEmail) {
      appState.driverEmail = data.driverEmail;
    }
    if (data?.receiver) {
      appState.receiver = data.receiver;
    }
    renderAll();
  } catch (error) {
    console.error(error);
    showToast('Erreur chargement fiche. Mode offline.');
    renderAll();
  }
};

const registerServiceWorker = async (): Promise<void> => {
  if (!('serviceWorker' in navigator)) {
    return;
  }
  try {
    await navigator.serviceWorker.register('./service-worker.js');
    await navigator.serviceWorker.register('./firebase-messaging-sw.js', { scope: './' });
    console.info('Service workers enregistrés');
  } catch (error) {
    console.error('SW registration error', error);
  }
};

const registerDevice = async (token: string, platform: string): Promise<void> => {
  if (!appState.driverEmail) {
    return;
  }
  try {
    await fetch(`${WEB_APP_URL}/api/registerDevice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        driverEmail: appState.driverEmail,
        token,
        platform
      })
    });
  } catch (error) {
    console.error('registerDevice', error);
  }
};

const ensureDriverEmail = async (): Promise<void> => {
  if (appState.driverEmail) {
    return;
  }
  const email = prompt('Entrez votre email professionnel');
  if (!email) {
    throw new Error('Email requis');
  }
  appState.driverEmail = email.trim().toLowerCase();
};

const renderAll = (): void => {
  renderStatus({ status: appState.status, label: STATUS_LABELS[appState.status], seq: appState.seq, driverEmail: appState.driverEmail });
  renderActions({
    status: appState.status,
    actions: STATUS_ACTIONS[appState.status],
    onChange: updateStatus,
    onSend: submitPayload
  });
  renderItems({ items: appState.items, onAdd: addItem, onUpdate: updateItem, onScan: triggerScan });
  renderReceiver({ receiver: appState.receiver });
  bindReceiver((receiver) => {
    appState.receiver = { ...appState.receiver, ...receiver };
  });
  renderSignature({ signature: appState.signature, onDraw: captureSignature, onClear: clearSignature });
  renderPhotos({ photos: appState.photos, onCapture: capturePhoto });
  renderLogs({
    openedAt: appState.openedAt,
    arrivedAt: appState.arrivedAt,
    submittedAt: appState.submittedAt,
    synced: appState.synced
  });
  document.getElementById('loader')?.setAttribute('hidden', 'true');
  document.getElementById('main')?.removeAttribute('hidden');
};

const updateStatus = async (next: StatusKey): Promise<void> => {
  appState.status = next;
  if (next === 'ARRIVED') {
    appState.arrivedAt = new Date().toISOString();
  }
  renderAll();
};

const addItem = (item: DeliveryItem): void => {
  appState.items.push(item);
  renderItems({ items: appState.items, onAdd: addItem, onUpdate: updateItem, onScan: triggerScan });
};

const updateItem = (index: number, item: DeliveryItem): void => {
  appState.items[index] = item;
  renderItems({ items: appState.items, onAdd: addItem, onUpdate: updateItem, onScan: triggerScan });
};

const triggerScan = async (): Promise<void> => {
  try {
    const barcode = await setupBarcodeScanner();
    if (!barcode) {
      showToast('Aucun code détecté');
      return;
    }
    addItem({ barcode, qty: 1 });
    showToast(`Code ${barcode}`);
  } catch (error) {
    console.error(error);
    showToast('Scanner indisponible');
  }
};

const captureSignature = async (): Promise<void> => {
  const signature = await setupSignaturePad();
  if (signature) {
    appState.signature = signature;
    renderSignature({ signature: appState.signature, onDraw: captureSignature, onClear: clearSignature });
  }
};

const clearSignature = (): void => {
  appState.signature = null;
  renderSignature({ signature: appState.signature, onDraw: captureSignature, onClear: clearSignature });
};

const capturePhoto = async (): Promise<void> => {
  if (!navigator.mediaDevices?.getUserMedia) {
    showToast('Caméra non disponible');
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    const track = stream.getVideoTracks()[0];
    const imageCapture = new ImageCapture(track);
    const bitmap = await imageCapture.grabFrame();
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    ctx?.drawImage(bitmap, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
    appState.photos.push(dataUrl);
    track.stop();
    renderPhotos({ photos: appState.photos, onCapture: capturePhoto });
  } catch (error) {
    console.error(error);
    showToast('Capture photo échouée');
  }
};

const collectPayload = async (): Promise<DeliveryPayload> => {
  const geo = await requestCurrentPosition(5000);
  const battery = (navigator as Navigator & { getBattery?: () => Promise<BatteryManager> }).getBattery
    ? await (await (navigator as Navigator & { getBattery: () => Promise<BatteryManager> }).getBattery()).then((b) => b.level)
    : undefined;
  appState.seq += 1;
  const payload: DeliveryPayload = {
    eventId: appState.eventId,
    cmd: appState.cmd,
    driverEmail: appState.driverEmail,
    clientUUID: appState.clientUUID,
    seq: appState.seq,
    status: appState.status,
    items: appState.items,
    receiver: appState.receiver,
    temp: undefined,
    signatureDataUrl: appState.signature,
    photos: appState.photos,
    geo: geo ? { lat: geo.coords.latitude, lng: geo.coords.longitude, accuracy: geo.coords.accuracy } : null,
    device: {
      id: await resolveDeviceId(),
      battery,
      appVersion: '1.0.0'
    },
    timestamps: {
      opened: appState.openedAt,
      arrived: appState.arrivedAt,
      submitted: new Date().toISOString()
    }
  };
  return payload;
};

const resolveDeviceId = async (): Promise<string> => {
  const storageKey = 'livreur-device-id';
  let id = localStorage.getItem(storageKey);
  if (!id) {
    id = `ANDROID-${crypto.randomUUID()}`;
    localStorage.setItem(storageKey, id);
  }
  return id;
};

const submitPayload = async (): Promise<void> => {
  try {
    await ensureDriverEmail();
  } catch (error) {
    showToast('Email requis pour envoyer');
    return;
  }
  const payload = await collectPayload();
  queue.add(async () => sendPayload(payload));
  showToast('Envoi programmé');
};

const sendPayload = async (payload: DeliveryPayload): Promise<void> => {
  try {
    const response = await fetch(`${WEB_APP_URL}/api/saveDelivery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      throw new Error('Erreur API');
    }
    const result = await response.json();
    if (result?.ok) {
      appState.submittedAt = result.ts;
      appState.synced = true;
      renderLogs({
        openedAt: appState.openedAt,
        arrivedAt: appState.arrivedAt,
        submittedAt: appState.submittedAt,
        synced: appState.synced
      });
      showToast('Fiche envoyée');
    } else {
      throw new Error(result?.reason || 'Erreur');
    }
  } catch (error) {
    console.error(error);
    showToast('Envoi échoué, réessai automatique.');
    throw error;
  }
};

const handleSyncMessage = (): void => {
  navigator.serviceWorker?.addEventListener('message', (event) => {
    if (event.data?.type === 'SYNC_QUEUE') {
      queue.flush();
    }
  });
};

const registerBackgroundSync = async (): Promise<void> => {
  if (!('serviceWorker' in navigator)) {
    return;
  }
  const registration = await navigator.serviceWorker.ready;
  try {
    await registration.sync.register('sync-queue');
  } catch (error) {
    console.warn('Background sync non disponible', error);
  }
};

const init = async (): Promise<void> => {
  parseUrlParams();
  await registerServiceWorker();
  handleSyncMessage();
  await ensureDriverEmail().catch((err) => {
    console.warn(err);
  });
  await loadEventInfo();
  initUI();
  renderAll();
  await initializeFirebaseMessaging();
  registerBackgroundSync();
  window.addEventListener('online', () => {
    showToast('Connexion retrouvée');
    queue.flush();
  });
  window.addEventListener('offline', () => showToast('Mode hors-ligne'));
};

queue.setRetryListener((attempt) => {
  showToast(`Retry ${attempt}`);
});

window.addEventListener('load', () => {
  init().catch((error) => console.error(error));
});

export {};
