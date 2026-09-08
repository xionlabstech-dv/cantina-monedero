const CACHE_NAME = "cantina-shell-v1";
const CORE_ASSETS = ["/", "/consulta", "/icon.png", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
  );
  self.clients.claim();
});

// Solo cachea navegación/estáticos del mismo origen (network-first con
// respaldo a caché offline). Las llamadas a Supabase (otro origen) nunca
// se cachean, para no servir saldos u operaciones desactualizados.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        // caches.match() resuelve a undefined si no hay nada cacheado, y
        // respondWith(undefined) revienta con "Failed to convert value to
        // 'Response'". Response.error() es un valor válido que produce el
        // mismo resultado visible (fallo de red) sin ese error de más.
        return cached ?? Response.error();
      })
  );
});
