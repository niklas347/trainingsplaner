/* Service Worker: macht die App offline nutzbar (z. B. auf dem Trainingsplatz ohne Netz).
   Strategie: erst Netz (immer aktuell), ohne Netz die gespeicherte Version.
   Bei neuen Dateien: Liste ergänzen und VERSION erhöhen. */

const VERSION = 'v4';
const CACHE = `trainingsplaner-${VERSION}`;
const FILES = [
  './', 'index.html', 'manifest.json', 'css/style.css',
  'js/fields.js', 'js/items.js', 'js/icons.js', 'js/steps.js', 'js/library.js', 'js/trainings.js', 'js/app.js',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('trainingsplaner-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function fetchWithTimeout(request, ms) {
  return Promise.race([
    fetch(request),
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const res = await fetchWithTimeout(req, 4000);
      if (res.ok) cache.put(req, res.clone());
      return res;
    } catch (err) {
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      if (req.mode === 'navigate') {
        const page = await cache.match('index.html');
        if (page) return page;
      }
      throw err;
    }
  })());
});
