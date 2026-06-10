// MEQ Palace service worker.
// Stale-while-revalidate: serve from cache instantly, fetch in background to refresh.
// Bump CACHE_VERSION to force evict old caches.
const CACHE_VERSION = 'meq-palace-v6';

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_VERSION).then(c =>
      c.addAll(['./', './index.html', './manifest.json',
                './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png'])
       .catch(() => {})  // tolerate any single 404
    )
  );
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
  e.respondWith((async () => {
    const cache = await caches.open(CACHE_VERSION);
    const cached = await cache.match(e.request);
    const fetchAndUpdate = fetch(e.request).then(resp => {
      // Cache both same-origin (basic) and cross-origin (opaque) responses.
      if (resp && (resp.status === 200 || resp.type === 'opaque')) {
        cache.put(e.request, resp.clone()).catch(() => {});
      }
      return resp;
    }).catch(() => null);
    if (cached) return cached;
    const fresh = await fetchAndUpdate;
    if (fresh) return fresh;
    // Offline + nothing cached — fall back to the root shell so the app at least opens.
    const shell = await cache.match('./') || await cache.match('./index.html');
    if (shell) return shell;
    return new Response('Offline.', { status: 503, statusText: 'Offline' });
  })());
});
