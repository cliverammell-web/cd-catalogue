/* CD Catalogue — offline cache.
   Bump CACHE whenever you upload a new index.html, or the phone will
   keep serving the old one. */
const CACHE = 'cd-catalogue-v9';
const BASE = '/cd-catalogue/';

/* The page and its own files. Anything here failing must not stop the
   rest being cached, so they are added one at a time rather than with
   addAll, which is all-or-nothing. */
const ASSETS = [
  BASE,
  BASE + 'index.html',
  BASE + 'manifest.json',
  BASE + 'icon-192.png',
  BASE + 'icon-512.png'
];

/* Google's font stylesheet is third-party and may be slow or blocked.
   It is nice to have, never a reason for the install to fail. */
const EXTRAS = [
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=DM+Sans:wght@300;400;500&display=swap'
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(
      ASSETS.concat(EXTRAS).map(u => cache.add(u).catch(() => {}))
    );
    // No skipWaiting here: the page decides when an update takes over.
  })());
});

self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const isPage = req.mode === 'navigate' ||
                 req.url.includes('index.html') ||
                 req.url.endsWith(BASE);

  // The page itself: network first so edits appear, cache as the safety net.
  if (isPage) {
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res && res.ok) (await caches.open(CACHE)).put(req, res.clone());
        return res;
      } catch (err) {
        const hit = await caches.match(req) || await caches.match(BASE + 'index.html');
        if (hit) return hit;
        return new Response('CD Catalogue is not cached yet.', {
          status: 503, headers: { 'Content-Type': 'text/plain' }
        });
      }
    })());
    return;
  }

  // Everything else: cache first, and keep whatever we successfully fetch.
  e.respondWith((async () => {
    const hit = await caches.match(req);
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res && res.ok && res.type !== 'opaque') {
        (await caches.open(CACHE)).put(req, res.clone());
      }
      return res;
    } catch (err) {
      return new Response('', { status: 504 });
    }
  })());
});
