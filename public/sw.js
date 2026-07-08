/* Kill-switch service worker.
 * Replaces the previous network-first app-shell SW that was serving stale
 * HTML / JS to installed PWAs and returning visitors. On activation it
 * deletes its own caches, claims all clients, force-reloads any open
 * windows, and unregisters itself so the browser will fetch fresh content
 * directly from the network from then on.
 *
 * Manifest-based installability (Add to Home Screen / app icon) is
 * unaffected — only the SW layer is removed. */

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    try {
      const names = await caches.keys();
      // Only delete caches this SW owns. The previous worker used the
      // "msreg-runtime-v1" name; also clear any future variants.
      const ours = names.filter((n) => n === "msreg-runtime-v1" || n.startsWith("msreg-"));
      await Promise.allSettled(ours.map((n) => caches.delete(n)));
      await self.clients.claim();
      const clients = await self.clients.matchAll({ type: "window" });
      await Promise.allSettled(clients.map((c) => c.navigate(c.url)));
    } finally {
      await self.registration.unregister();
    }
  })());
});

// Pass every fetch through to the network — never serve from cache.
self.addEventListener("fetch", () => {});
