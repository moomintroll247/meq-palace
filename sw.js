// MEQ Palace service worker.
// NETWORK-FIRST for the main document (index.html) so code updates apply immediately when
// online; stale-while-revalidate for other assets. Falls back to cache when offline.
// Bump CACHE_VERSION to force evict old caches.
const CACHE_VERSION = 'meq-palace-v12';
const ASSETS = ['./', './index.html', './manifest.json',
                './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE_VERSION).then(c => c.addAll(ASSETS).catch(() => {})));
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(n => n !== CACHE_VERSION).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  const isDoc = e.request.mode === 'navigate'
    || url.pathname.endsWith('/') || url.pathname.endsWith('index.html');

  if (isDoc) {
    // Network-first: always try to get the freshest HTML/code online; fall back to cache offline.
    e.respondWith((async () => {
      try {
        const fresh = await fetch(e.request, { cache: 'no-store' });
        const cache = await caches.open(CACHE_VERSION);
        cache.put('./index.html', fresh.clone()).catch(() => {});
        return fresh;
      } catch {
        const cache = await caches.open(CACHE_VERSION);
        return (await cache.match(e.request)) || (await cache.match('./index.html'))
          || new Response('Offline.', { status: 503 });
      }
    })());
    return;
  }

  // Stale-while-revalidate for everything else (icons, manifest, CDN modules).
  e.respondWith((async () => {
    const cache = await caches.open(CACHE_VERSION);
    const cached = await cache.match(e.request);
    const fetchPromise = fetch(e.request).then(resp => {
      if (resp && (resp.status === 200 || resp.type === 'opaque')) {
        cache.put(e.request, resp.clone()).catch(() => {});
      }
      return resp;
    }).catch(() => null);
    return cached || (await fetchPromise) || new Response('Offline.', { status: 503 });
  })());
});
