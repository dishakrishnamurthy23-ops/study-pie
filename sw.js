/* Offline helper: keeps a copy of the app so it opens without internet.
   It always asks GitHub for the newest files first (skipping any old saved copy),
   and only uses the saved copy when there is no internet. */
const CACHE = "study-pie-v4";
const FILES = ["./", "index.html", "style.css", "config.js", "plan-data.js", "app.js",
               "manifest.webmanifest", "icon-192.png", "icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener("activate", e => e.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim())
));

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const sameSite = new URL(e.request.url).origin === location.origin;
  e.respondWith(
    fetch(e.request, sameSite ? { cache: "no-store" } : {})
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
