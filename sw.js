// Service worker: app-skallet ligger i cache, så spillet starter uten nett.
// Motiv og brikker genereres lokalt, så det finnes ingenting å laste ned
// under spilling — appen er offline av natur, ikke som et tillegg.

const CACHE = 'puslespill-v3';

const SKALL = [
  './',
  './index.html',
  './css/style.css',
  './manifest.webmanifest',
  './icons/ikon.svg',
  './icons/ikon-180.png',
  './icons/ikon-192.png',
  './icons/ikon-512.png',
  './js/main.js',
  './js/core/rng.js',
  './js/core/grid.js',
  './js/core/shape.js',
  './js/core/puzzle.js',
  './js/core/spill.js',
  './js/lyd.js',
  './js/render/atlas.js',
  './js/render/camera.js',
  './js/render/renderer.js',
  './js/input/gester.js',
  './js/art/noise.js',
  './js/art/neon.js',
  './js/art/tegning.js',
  './js/art/scener.js',
  './js/art/motiver.js',
  './js/art/palettes.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(SKALL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((navn) => Promise.all(navn.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  // Navigasjon: prøv nett først så nye versjoner kommer fram, fall tilbake
  // til cache når iPaden er offline.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((r) => {
          const kopi = r.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', kopi));
          return r;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then((truffet) => truffet || fetch(req).then((r) => {
      if (r.ok) {
        const kopi = r.clone();
        caches.open(CACHE).then((c) => c.put(req, kopi));
      }
      return r;
    }))
  );
});
