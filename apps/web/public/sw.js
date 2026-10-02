/* Fold service worker: caches the app shell, passes the websocket and the API through. */
const SHELL = "fold-shell-v1";
const SHELL_URLS = ["/", "/manifest.webmanifest", "/favicon.svg", "/logo.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((c) => c.addAll(SHELL_URLS))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Live traffic goes straight through: the websocket upgrade and the JSON API are never cached.
  if (url.pathname.startsWith("/ws") || url.pathname.startsWith("/api/")) return;
  if (req.mode === "navigate") {
    // Network first for the shell so a new build is picked up; fall back to the cached shell offline.
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches
            .open(SHELL)
            .then((c) => c.put("/", copy))
            .catch(() => undefined);
          return res;
        })
        .catch(() => caches.match("/").then((hit) => hit ?? Response.error())),
    );
    return;
  }
  // Hashed assets and icons: cache first, then network, and remember what we fetched.
  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ??
        fetch(req).then((res) => {
          if (res.ok && (url.pathname.startsWith("/assets/") || url.pathname.endsWith(".svg"))) {
            const copy = res.clone();
            caches
              .open(SHELL)
              .then((c) => c.put(req, copy))
              .catch(() => undefined);
          }
          return res;
        }),
    ),
  );
});
