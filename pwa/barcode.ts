export const setupBarcodeScanner = async (): Promise<string | null> => {
  if ('BarcodeDetector' in window) {
    const detector = new BarcodeDetector({ formats: ['code_128', 'qr_code', 'ean_13'] });
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    const track = stream.getVideoTracks()[0];
    const imageCapture = new ImageCapture(track);
    try {
      const bitmap = await imageCapture.grabFrame();
      const barcodes = await detector.detect(bitmap);
      track.stop();
      return barcodes[0]?.rawValue || null;
    } catch (error) {
      track.stop();
      throw error;
    }
  }
  return fallbackBarcodePrompt();
};

const fallbackBarcodePrompt = async (): Promise<string | null> => {
  const manual = prompt('Scanner indisponible. Entrer code manuellement.');
  return manual ? manual.trim() : null;
};
