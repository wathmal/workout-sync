/* Fit Sync — minimal shell service worker.
 * Network-first for the app shell (html/css/js/img/font); NEVER caches /api so
 * macros / coverage / agenda are always live. Offline = app still opens, data
 * waits for signal. Bump CACHE to invalidate. */
const CACHE = "fit-sync-shell-v1";
const SHELL_DEST = new Set(["document", "script", "style", "image", "font"]);

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // live data only — never cache

  const isShell = req.mode === "navigate" || SHELL_DEST.has(req.destination);
  if (!isShell) return;

  event.respondWith(
    (async () => {
      try {
        const fresh = await fetch(req);
        if (fresh && fresh.status === 200 && fresh.type === "basic") {
          const cache = await caches.open(CACHE);
          cache.put(req, fresh.clone());
        }
        return fresh;
      } catch {
        const cached = await caches.match(req);
        if (cached) return cached;
        if (req.mode === "navigate") {
          const root = await caches.match("/");
          if (root) return root;
        }
        throw new Error("offline and uncached");
      }
    })(),
  );
});
