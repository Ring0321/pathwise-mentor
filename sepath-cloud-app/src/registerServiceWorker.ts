function isLocalPreviewHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

function clearLocalPreviewWorkers(): void {
  window.addEventListener("load", () => {
    navigator.serviceWorker.getRegistrations?.().then((registrations) => {
      registrations.forEach((registration) => registration.unregister());
    }).catch(() => {});

    if ("caches" in window) {
      caches.keys().then((keys) => {
        keys.filter((key) => key.startsWith("sepath-public-trial")).forEach((key) => caches.delete(key));
      }).catch(() => {});
    }
  });
}

export function registerTrialServiceWorker(): void {
  if (!("serviceWorker" in navigator)) return;
  if (!["http:", "https:"].includes(window.location.protocol)) return;
  if (isLocalPreviewHost(window.location.hostname)) {
    clearLocalPreviewWorkers();
    return;
  }

  const normalizedBase = "/";
  const workerUrl = `${normalizedBase}sw.js`;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register(workerUrl, { scope: normalizedBase }).catch(() => {
      // Offline support is a resilience bonus. The app must stay usable if a browser blocks SW.
    });
  });
}
