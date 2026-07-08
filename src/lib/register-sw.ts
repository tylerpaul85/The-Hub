// Service worker registration is disabled. The previous app-shell SW caused
// stale HTML/JS to be served to returning visitors and installed PWAs across
// devices. `public/sw.js` is now a kill-switch worker that unregisters
// itself on activation; this module ensures we never register a new one and
// proactively unregisters any leftover SWs on every load.
export function registerServiceWorker() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker
    .getRegistrations()
    .then((regs) => regs.forEach((r) => r.unregister().catch(() => {})))
    .catch(() => {});
  if ("caches" in window) {
    caches.keys().then((names) => {
      names
        .filter((n) => n === "msreg-runtime-v1" || n.startsWith("msreg-"))
        .forEach((n) => caches.delete(n).catch(() => {}));
    }).catch(() => {});
  }
}
