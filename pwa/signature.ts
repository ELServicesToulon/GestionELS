export const setupSignaturePad = async (): Promise<string | null> => {
  const canvas = document.getElementById('signature-pad') as HTMLCanvasElement | null;
  if (!canvas) {
    return null;
  }
  return new Promise((resolve) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      resolve(null);
      return;
    }
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    ctx.scale(ratio, ratio);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#f5f5f5';
    let drawing = false;
    const getPos = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      };
    };
    const start = (event: PointerEvent) => {
      drawing = true;
      const pos = getPos(event);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    };
    const move = (event: PointerEvent) => {
      if (!drawing) {
        return;
      }
      event.preventDefault();
      const pos = getPos(event);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    };
    const end = () => {
      drawing = false;
    };
    canvas.addEventListener('pointerdown', start);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointerleave', end);
    const confirmBtn = document.createElement('button');
    confirmBtn.textContent = 'Valider signature';
    confirmBtn.className = 'primary';
    confirmBtn.addEventListener('click', () => {
      canvas.removeEventListener('pointerdown', start);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', end);
      canvas.removeEventListener('pointerleave', end);
      confirmBtn.remove();
      resolve(canvas.toDataURL('image/png'));
    });
    canvas.parentElement?.appendChild(confirmBtn);
  });
};
