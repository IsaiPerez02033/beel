// Service Worker de Beel — estrategia conservadora para evitar versiones viejas.
// - Páginas (navegación): network-first (siempre la última versión; cache solo offline)
// - Assets con hash de Next (/_next/static): cache-first (son inmutables)
// - API (/api/...): nunca se intercepta (siempre red)
const CACHE = "beel-v1";
const STATIC_CACHE = "beel-static-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== CACHE && k !== STATIC_CACHE)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Nunca interceptar API ni autenticación → siempre red
  if (url.pathname.startsWith("/api/")) return;
  if (url.origin !== self.location.origin) return;

  // Assets inmutables de Next.js → cache-first
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const res = await fetch(request);
        if (res.ok) cache.put(request, res.clone());
        return res;
      })
    );
    return;
  }

  // Navegación / páginas → network-first (cae a cache solo si no hay red)
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(request);
          const cache = await caches.open(CACHE);
          cache.put(request, res.clone());
          return res;
        } catch {
          const cached = await caches.match(request);
          return cached || caches.match("/");
        }
      })()
    );
    return;
  }
});

// ── Web Push ──────────────────────────────────────────────────────────────────

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Beel", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Beel";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: data.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clientList) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) {
            try { await client.navigate(url); } catch {}
          }
          return;
        }
      }
      await self.clients.openWindow(url);
    })()
  );
});
