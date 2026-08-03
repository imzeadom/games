const CACHE_NAME = "paper-arcade-v7";
const ASSET_REFERENCE_PATTERN =
  /(?:\/assets\/|assets\/|\.\.?\/)[A-Za-z0-9_./-]+\.(?:css|js|woff2?)/g;
const APP_SHELL = [
  "/",
  "/sudoku",
  "/1024",
  "/sky-hop",
  "/twilight-canopy",
  "/maze",
  "/crossword",
  "/tools/dice",
  "/history",
  "/privacy",
  "/manifest.webmanifest",
  "/manifest-sudoku.webmanifest",
  "/manifest-1024.webmanifest",
  "/manifest-sky-hop.webmanifest",
  "/manifest-twilight.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-1024-192.png",
  "/icon-1024-512.png",
  "/icon-sky-192.png",
  "/icon-sky-512.png",
  "/sky-hop-background.png",
  "/sky-lark.png",
  "/favicon.ico",
];

function sameOriginUrl(request) {
  const url = new URL(request.url);
  return url.origin === self.location.origin ? url : null;
}

function canonicalNavigationUrl(request) {
  const url = new URL(request.url);
  url.search = "";
  url.hash = "";
  return url.href;
}

function isRscRequest(request) {
  return (
    request.headers.get("RSC") === "1" ||
    request.headers.get("Accept")?.includes("text/x-component") ||
    request.headers.has("Next-Router-Prefetch")
  );
}

function isCacheableAsset(request, url) {
  if (url.search) return false;
  return (
    ["font", "image", "manifest", "script", "style"].includes(
      request.destination,
    ) || url.pathname.startsWith("/assets/")
  );
}

async function precacheApp() {
  const cache = await caches.open(CACHE_NAME);
  const scheduledUrls = new Set(APP_SHELL);
  let pendingUrls = [...APP_SHELL];

  while (pendingUrls.length > 0) {
    const batch = pendingUrls;
    pendingUrls = [];
    const responses = await Promise.all(
      batch.map(async (path) => {
        const url = new URL(path, self.location.origin).href;
        const response = await fetch(
          new Request(url, { cache: "reload", credentials: "same-origin" }),
        );
        if (!response.ok) throw new Error(`Unable to precache ${path}`);
        return { url, response };
      }),
    );

    for (const { url, response } of responses) {
      await cache.put(url, response.clone());
      const contentType = response.headers.get("Content-Type") ?? "";
      if (!/html|css|javascript/.test(contentType)) continue;

      const body = await response.text();
      for (const match of body.matchAll(ASSET_REFERENCE_PATTERN)) {
        const reference = match[0];
        const assetPath = reference.startsWith("assets/")
          ? `/${reference}`
          : new URL(reference, url).pathname;
        if (!assetPath.startsWith("/assets/")) continue;
        if (!scheduledUrls.has(assetPath)) {
          scheduledUrls.add(assetPath);
          pendingUrls.push(assetPath);
        }
      }
    }
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(precacheApp());
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) => key.startsWith("paper-arcade-") && key !== CACHE_NAME,
            )
            .map((key) => caches.delete(key)),
        ),
      ),
      self.clients.claim(),
    ]),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

async function fetchAndCacheNavigation(request, cache) {
  const response = await fetch(new Request(request, { cache: "no-store" }));
  if (response.ok) {
    await cache.put(canonicalNavigationUrl(request), response.clone());
  }
  return response;
}

async function serveNavigation(event) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(canonicalNavigationUrl(event.request));

  if (cached) {
    event.waitUntil(
      fetchAndCacheNavigation(event.request, cache).catch(() => undefined),
    );
    return cached;
  }

  try {
    return await fetchAndCacheNavigation(event.request, cache);
  } catch {
    return (
      (await cache.match(new URL("/", self.location.origin).href)) ??
      new Response("离线资源尚未准备好，请联网打开一次后重试。", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      })
    );
  }
}

async function serveAsset(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok && response.type !== "opaque") {
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = sameOriginUrl(event.request);
  if (!url) return;

  if (event.request.mode === "navigate") {
    event.respondWith(serveNavigation(event));
    return;
  }

  // RSC responses vary by router state and used to grow the cache without bound.
  if (isRscRequest(event.request)) return;

  if (isCacheableAsset(event.request, url)) {
    event.respondWith(serveAsset(event.request));
  }
});
