export const requestCurrentPosition = async (timeoutMs: number): Promise<GeolocationPosition | null> => {
  if (!navigator.geolocation) {
    return null;
  }
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(null), timeoutMs);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        window.clearTimeout(timer);
        resolve(position);
      },
      () => {
        window.clearTimeout(timer);
        resolve(null);
      },
      {
        enableHighAccuracy: false,
        maximumAge: 60_000,
        timeout: timeoutMs
      }
    );
  });
};
