const VERSION = 'v1.0.7';
const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './apps.json',
  './offline.html'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  // HTMLはネット優先 → ダメならキャッシュ → さらにダメならoffline.html
  if (req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html')) {
    e.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(VERSION);
        cache.put(req, fresh.clone());
        return fresh;
      } catch {
        const cache = await caches.open(VERSION);
        return (await cache.match(req)) || (await cache.match('./offline.html'));
      }
    })());
    return;
  }

  // 画像・CSSなどは Stale-While-Revalidate 風
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const cached = await cache.match(req);
    const fetchPromise = fetch(req).then((res) => {
      if (res && res.status === 200) cache.put(req, res.clone());
      return res;
    }).catch(() => cached);
    return cached || fetchPromise;
  })());
});