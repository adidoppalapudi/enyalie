/**
 * Registers public/sw.js, which caches the app so it opens offline.
 *
 * Only production builds register it (`npm run build` + `npm run preview`, or
 * a deployed copy). During `npm run dev` it stays off so edits always show up.
 * Browsers only allow service workers on https or localhost, so opening the
 * dev server from a phone over Wi-Fi works, just without offline support.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch((error: unknown) => {
      console.warn('Rekall: offline support is unavailable (service worker registration failed).', error);
    });
  });
}
