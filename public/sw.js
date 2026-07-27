const CACHE_NAME = "paper-arcade-v2";
const APP_SHELL = [
  "/",
  "/sudoku",
  "/1024",
  "/sky-hop",
  "/manifest.webmanifest",
  "/manifest-sudoku.webmanifest",
  "/manifest-1024.webmanifest",
  "/manifest-sky-hop.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-1024-192.png",
  "/icon-1024-512.png",
  "/icon-sky-192.png",
  "/icon-sky-512.png",
  "/sky-hop-background.png",
  "/sky-lark.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() =>
        caches.match(event.request).then((cached) => cached ?? caches.match("/")),
      ),
  );
});
