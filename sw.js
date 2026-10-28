const CACHE = "reverso-gestor-automotive-v1";
const STATIC_DESTINATIONS = new Set(["document", "script", "style", "font", "image", "manifest"]);
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    // Retire only the known cache of this previous Gestor, not other sites on the origin.
    const names = await caches.keys();
    await Promise.all(names.filter(name => name === "reverso-works-v8").map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || request.headers.has("Authorization")) return;
  if (!STATIC_DESTINATIONS.has(request.destination) || url.pathname.includes("/api/") || url.pathname.includes("/manus-storage/")) return;
  // Revalidate the HTML entry on navigation; hashed assets keep normal browser caching.
  const options = { cache: request.destination === "document" ? "no-cache" : "default" };
  event.respondWith(fetch(request, options).then(response => {
    if (response.ok && !/private|no-store/i.test(response.headers.get("Cache-Control") || "")) {
      const copy = response.clone();
      void caches.open(CACHE).then(cache => cache.put(request, copy)).catch(() => undefined);
    }
    return response;
  }).catch(async () => (await caches.match(request)) || Response.error()));
});
