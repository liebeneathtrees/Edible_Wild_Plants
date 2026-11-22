// Edible Wild Plants service worker (v1.0.1).
// Makes the guide work offline after a visit: the app itself, the fonts and every photo you have seen.
// The app keeps its own copies of photo look-ups (localStorage), so API requests are never cached here.
const SHELL_CACHE = 'ew-shell-1.0.1', IMG_CACHE = 'ew-img-v1', FONT_CACHE = 'ew-font-v1', MAX_IMG = 800;
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
const IMG_HOSTS = /(^|\.)upload\.wikimedia\.org$|(^|\.)inaturalist-open-data\.s3\.amazonaws\.com$|(^|\.)static\.inaturalist\.org$/;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL_CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('ew-shell-') && k !== SHELL_CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

function trim(cache) {
  cache.keys().then(keys => { if (keys.length > MAX_IMG) keys.slice(0, keys.length - MAX_IMG).forEach(k => cache.delete(k)); });
}

self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // The app: network first, so updates arrive; the saved copy when offline.
  if (url.origin === self.location.origin) {
    e.respondWith(fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(SHELL_CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || caches.match('./index.html'))));
    return;
  }
  // Photos: saved the first time they are seen, then served from the saved copy.
  if (IMG_HOSTS.test(url.hostname)) {
    e.respondWith(caches.open(IMG_CACHE).then(c => c.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok || res.type === 'opaque') { c.put(req, res.clone()); trim(c); }
      return res;
    }))));
    return;
  }
  // Fonts: the saved copy right away, refreshed in the background.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(FONT_CACHE).then(c => c.match(req).then(hit => {
      const net = fetch(req).then(res => { if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    })));
  }
});
