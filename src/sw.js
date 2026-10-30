// ONE service worker for the hub and every game. Cache-first, versioned cache name.
// The file list comes from precache.json, which scripts/build-game-list.mjs generates.
// All paths are relative, so this works under /<repo>/ on GitHub Pages.

const PREFIX = 'game-hub-';
const META = PREFIX + 'meta';

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const response = await fetch('precache.json', { cache: 'no-store' });
      if (!response.ok) throw new Error('precache.json not available');
      const { version, files } = await response.json();
      const cache = await caches.open(PREFIX + version);
      await cache.addAll(files);
      const meta = await caches.open(META);
      await meta.put('version', new Response(version));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const meta = await caches.open(META);
      const saved = await meta.match('version');
      const version = saved ? await saved.text() : null;
      const keep = new Set([META, PREFIX + version]);
      for (const key of await caches.keys()) {
        if (key.startsWith(PREFIX) && !keep.has(key)) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      const cached = await caches.match(request, { ignoreSearch: true });
      if (cached) return cached;
      try {
        return await fetch(request);
      } catch (error) {
        if (request.mode === 'navigate') {
          const fallback = await caches.match('index.html');
          if (fallback) return fallback;
        }
        throw error;
      }
    })(),
  );
});
