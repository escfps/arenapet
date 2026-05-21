// Arena Pet — Service Worker
// Network-first para navegação (HTML) e cache de assets estáticos.
// Atualiza automaticamente quando uma nova versão é publicada.
const VERSION = "v1";
const STATIC_CACHE = `arenapet-static-${VERSION}`;
const RUNTIME_CACHE = `arenapet-runtime-${VERSION}`;

const PRECACHE_URLS = [
  "/",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((n) => n !== STATIC_CACHE && n !== RUNTIME_CACHE)
          .map((n) => caches.delete(n))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Não cachear chamadas a APIs / server functions / supabase
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_serverFn") || url.hostname.includes("supabase")) {
    return;
  }

  // Navegação (HTML) — network-first com fallback pro shell offline
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(RUNTIME_CACHE);
          cache.put(req, fresh.clone());
          return fresh;
        } catch {
          const cache = await caches.open(RUNTIME_CACHE);
          return (await cache.match(req)) || (await caches.match("/")) || Response.error();
        }
      })()
    );
    return;
  }

  // Assets estáticos — cache-first
  event.respondWith(
    (async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      try {
        const fresh = await fetch(req);
        if (fresh.ok && fresh.type === "basic") {
          const cache = await caches.open(RUNTIME_CACHE);
          cache.put(req, fresh.clone());
        }
        return fresh;
      } catch {
        return cached || Response.error();
      }
    })()
  );
});
