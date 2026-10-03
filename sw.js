// Offline support: the app shell is cached so it opens with no signal.
// Workout data is handled separately by Firestore's own offline cache.
// Bump VERSION whenever you change files, so phones pick up the update.
const VERSION = "twp-v16";
const SHELL = [
  "./", "index.html", "css/styles.css",
  "js/app.js", "js/plan.js", "js/stats.js", "js/firebase.js", "js/library.js", "js/fun.js", "js/safety.js", "js/timer.js", "js/a11y.js",
  "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png", "icons/favicon-64.png", "icons/ears.png", "icons/logo-dark-text.png", "icons/logo-light-text.png",
  "fonts/atkinson-hyperlegible-latin-400-normal.woff2", "fonts/atkinson-hyperlegible-latin-700-normal.woff2", "fonts/lexend-latin-400-normal.woff2", "fonts/lexend-latin-700-normal.woff2", "fonts/opendyslexic-latin-400-normal.woff2", "fonts/opendyslexic-latin-700-normal.woff2"
];
const CDN = ["www.gstatic.com", "cdnjs.cloudflare.com", "fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// Serve from cache right away, refresh the cache in the background.
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin && !CDN.includes(url.hostname)) return; // never touch Firestore or auth traffic
  if (url.hostname === "www.gstatic.com" && !url.pathname.startsWith("/firebasejs/")) return;
  e.respondWith(caches.open(VERSION).then(async cache => {
    const cached = await cache.match(req, { ignoreSearch: sameOrigin });
    const network = fetch(req).then(res => { if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone()); return res; }).catch(() => cached);
    return cached || network;
  }));
});
