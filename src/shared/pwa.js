// Registers the ONE service worker (src/sw.js) that serves the hub and every game offline.
// Works from any page because the path is resolved against this file, not the page.

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  const swUrl = new URL('../sw.js', import.meta.url);
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(swUrl.href).catch(() => {
      /* offline support is a bonus; the game still works online */
    });
  });
}
