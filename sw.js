// Service worker: app-skallet ligger i cache, så spillet starter uten nett.
// Motiv og brikker genereres lokalt, så det finnes ingenting å laste ned
// under spilling — appen er offline av natur, ikke som et tillegg.
//
// Strategien er nett først med kort tidsfrist, ikke cache først.
// Cache først høres raskere ut, men gir én utdatert last etter hver
// oppdatering: ny index.html fra nettet sammen med gammel JavaScript fra
// cachen. Det brakk appen i praksis.
//
// «Nett først» er heller ikke nok alene. En vanlig fetch går gjennom
// nettleserens egen HTTP-cache, og GitHub Pages sender max-age=600. Da kan
// en fersk service worker rekke å legge ti minutter gammel JavaScript i
// cachen sin. Derfor hentes skallet med cache: 'reload' ved installasjon,
// og alt annet med cache: 'no-cache', som tvinger en revalidering mot
// serveren. Kostnaden er en 304, og gevinsten er at filene alltid følger
// hverandre.

const CACHE = 'puslespill-v8';
const NETT_FRIST_MS = 2500;

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
  './js/lyd.js',
  './js/core/rng.js',
  './js/core/grid.js',
  './js/core/shape.js',
  './js/core/puzzle.js',
  './js/core/spill.js',
  './js/core/vanskelighet.js',
  './js/render/atlas.js',
  './js/render/camera.js',
  './js/render/renderer.js',
  './js/input/gester.js',
  './js/ui/skuff.js',
  './js/ui/beskjaer.js',
  './js/lagring.js',
  './js/art/noise.js',
  './js/art/neon.js',
  './js/art/eget.js',
  './js/art/tegning.js',
  './js/art/scener.js',
  './js/art/motiver.js',
  './js/art/palettes.js',
];

async function forhandslast() {
  const cache = await caches.open(CACHE);
  await Promise.all(SKALL.map(async (url) => {
    // cache: 'reload' går utenom nettleserens HTTP-cache helt.
    const svar = await fetch(new Request(url, { cache: 'reload' }));
    if (svar.ok) await cache.put(url, svar);
  }));
}

self.addEventListener('install', (e) => {
  e.waitUntil(forhandslast().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((navn) => Promise.all(navn.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

async function nettForst(req) {
  const cache = await caches.open(CACHE);
  try {
    const svar = await Promise.race([
      fetch(req, { cache: 'no-cache' }),
      new Promise((_, avvis) => setTimeout(() => avvis(new Error('treg')), NETT_FRIST_MS)),
    ]);
    if (svar && svar.ok) cache.put(req, svar.clone());
    return svar;
  } catch {
    const truffet = await cache.match(req);
    if (truffet) return truffet;
    if (req.mode === 'navigate') {
      const skall = await cache.match('./index.html');
      if (skall) return skall;
    }
    return new Response('Offline', { status: 503, statusText: 'Offline' });
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(nettForst(req));
});
