// Tofol service worker — offline reading + edit queue
const CACHE_NAME = "tofol-v1";
const OFFLINE_QUEUE_KEY = "tofol-offline-queue";

// Resources to precache
const PRECACHE = ["/login", "/"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only cache GET requests for same-origin HTML and static assets
  if (request.method !== "GET") return;
  if (url.origin !== self.location.origin) return;

  // API routes: network only, never cache
  if (url.pathname.startsWith("/api/")) return;

  // Document pages and navigation: cache with network-first strategy
  if (request.mode === "navigate" || request.headers.get("Accept")?.includes("text/html")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached ?? caches.match("/")))
    );
    return;
  }

  // Static assets: cache first
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ??
        fetch(request).then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
    )
  );
});
