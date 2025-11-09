interface StatusProps {
  status: string;
  label: string;
  seq: number;
  driverEmail: string;
}

interface ActionsProps {
  status: string;
  actions: string[];
  onChange: (status: string) => void;
  onSend: () => void;
}

interface ItemsProps {
  items: { barcode: string; qty: number; temp?: number }[];
  onAdd: (item: { barcode: string; qty: number; temp?: number }) => void;
  onUpdate: (index: number, item: { barcode: string; qty: number; temp?: number }) => void;
  onScan: () => void;
}

interface ReceiverProps {
  receiver: { name?: string; role?: string };
}

interface SignatureProps {
  signature: string | null;
  onDraw: () => void;
  onClear: () => void;
}

interface PhotosProps {
  photos: string[];
  onCapture: () => void;
}

interface LogsProps {
  openedAt: string;
  arrivedAt: string;
  submittedAt: string;
  synced: boolean;
}

let toastTimer: number | null = null;

export const initUI = (): void => {
  // Placeholder pour logiques additionnelles
};

export const renderStatus = (props: StatusProps): void => {
  const container = document.getElementById('status-section');
  if (!container) {
    return;
  }
  container.innerHTML = `
    <div class="status-badge">
      <span>Statut: <strong>${props.label}</strong></span>
      <span>Seq: ${props.seq}</span>
      <span>${props.driverEmail || 'email non défini'}</span>
    </div>
  `;
};

export const renderActions = (props: ActionsProps): void => {
  const container = document.getElementById('action-section');
  if (!container) {
    return;
  }
  container.innerHTML = '';
  props.actions.forEach((status) => {
    const btn = document.createElement('button');
    btn.textContent = status;
    btn.className = 'primary';
    btn.addEventListener('click', () => props.onChange(status));
    container.appendChild(btn);
  });
  const sendBtn = document.createElement('button');
  sendBtn.textContent = 'Envoyer';
  sendBtn.className = 'primary';
  sendBtn.addEventListener('click', () => props.onSend());
  container.appendChild(sendBtn);
};

export const renderItems = (props: ItemsProps): void => {
  const container = document.getElementById('items-section');
  if (!container) {
    return;
  }
  container.innerHTML = `
    <div class="list-items">
      ${props.items
        .map(
          (item, index) => `
            <div class="item-card" data-index="${index}">
              <div>Code: ${item.barcode}</div>
              <div>
                <label>Qté
                  <input type="number" min="0" value="${item.qty}" data-field="qty" data-index="${index}" />
                </label>
              </div>
              <div>
                <label>T°
                  <input type="number" step="0.1" value="${item.temp ?? ''}" data-field="temp" data-index="${index}" />
                </label>
              </div>
            </div>
          `
        )
        .join('')}
    </div>
    <button id="scan-btn" class="primary">Scanner</button>
    <button id="add-item-btn">Ajouter manuel</button>
  `;
  container.querySelectorAll('input').forEach((input) => {
    input.addEventListener('change', () => {
      const index = Number((input as HTMLInputElement).dataset.index);
      const field = (input as HTMLInputElement).dataset.field as 'qty' | 'temp';
      const current = props.items[index];
      const value = field === 'qty' ? Number((input as HTMLInputElement).value) : Number((input as HTMLInputElement).value);
      const updated = { ...current, [field]: value };
      props.onUpdate(index, updated);
    });
  });
  container.querySelector('#scan-btn')?.addEventListener('click', () => props.onScan());
  container.querySelector('#add-item-btn')?.addEventListener('click', () => {
    const code = prompt('Code article');
    if (!code) {
      return;
    }
    props.onAdd({ barcode: code, qty: 1 });
  });
};

export const renderReceiver = (props: ReceiverProps): void => {
  const container = document.getElementById('receiver-section');
  if (!container) {
    return;
  }
  container.innerHTML = `
    <div class="form-field">
      <label>Réceptionnaire
        <input id="receiver-name" value="${props.receiver?.name ?? ''}" placeholder="Nom" />
      </label>
    </div>
    <div class="form-field">
      <label>Fonction
        <input id="receiver-role" value="${props.receiver?.role ?? ''}" placeholder="Rôle" />
      </label>
    </div>
  `;
};

export const bindReceiver = (onChange: (receiver: { name?: string; role?: string }) => void): void => {
  document.getElementById('receiver-name')?.addEventListener('change', (event) => {
    const input = event.target as HTMLInputElement;
    onChange({ name: input.value, role: (document.getElementById('receiver-role') as HTMLInputElement)?.value });
  });
  document.getElementById('receiver-role')?.addEventListener('change', (event) => {
    const input = event.target as HTMLInputElement;
    onChange({ name: (document.getElementById('receiver-name') as HTMLInputElement)?.value, role: input.value });
  });
};

export const renderSignature = (props: SignatureProps): void => {
  const container = document.getElementById('signature-section');
  if (!container) {
    return;
  }
  container.innerHTML = `
    <canvas id="signature-pad" class="signature-pad"></canvas>
    <div class="signature-actions">
      <button id="signature-capture" class="primary">Signer</button>
      <button id="signature-clear">Effacer</button>
    </div>
    ${props.signature ? `<img src="${props.signature}" alt="Signature" />` : ''}
  `;
  container.querySelector('#signature-capture')?.addEventListener('click', () => props.onDraw());
  container.querySelector('#signature-clear')?.addEventListener('click', () => props.onClear());
};

export const renderPhotos = (props: PhotosProps): void => {
  const container = document.getElementById('photos-section');
  if (!container) {
    return;
  }
  container.innerHTML = `
    <div class="photo-grid">
      ${props.photos.map((photo) => `<img src="${photo}" alt="Photo" />`).join('')}
    </div>
    <button id="photo-capture" class="primary">Prendre une photo</button>
  `;
  container.querySelector('#photo-capture')?.addEventListener('click', () => props.onCapture());
};

export const renderLogs = (props: LogsProps): void => {
  const container = document.getElementById('logs-section');
  if (!container) {
    return;
  }
  container.innerHTML = `
    <div>Ouverture: ${props.openedAt}</div>
    <div>Arrivée: ${props.arrivedAt || '—'}</div>
    <div>Soumission: ${props.submittedAt || '—'}</div>
    <div>Sync: ${props.synced ? 'OK' : 'En attente'}</div>
  `;
};

export const showToast = (message: string): void => {
  const toast = document.getElementById('toast');
  if (!toast) {
    return;
  }
  toast.textContent = message;
  toast.hidden = false;
  if (toastTimer) {
    window.clearTimeout(toastTimer);
  }
  toastTimer = window.setTimeout(() => {
    toast.hidden = true;
  }, 4000);
};
