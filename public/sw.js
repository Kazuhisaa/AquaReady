// Wave service worker: works offline after the first visit.
// Bump VERSION when this file changes; built assets are content-hashed, so they never go stale.
const VERSION = 'aquaready-v2'; // v2: app renamed to Wave (manifest changed)
const SHELL = ['/', '/index.html', '/manifest.json', '/favicon.svg', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await cache.addAll(SHELL);
    // Also precache the hashed bundles index.html points to, or the first offline open is blank.
    const html = await (await cache.match('/index.html')).text();
    await cache.addAll([...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== VERSION) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  // ignoreVary: the server sends `Vary: Origin`, and module scripts carry an Origin header the precache didn't.
  const fromCache = () => caches.match(request, { ignoreVary: true });

  if (request.mode === 'navigate') {
    // Network first so a new deploy shows up; cached shell when offline.
    event.respondWith(fetch(request).catch(async () => (await caches.match('/index.html')) ?? Response.error()));
    return;
  }
  event.respondWith((async () => {
    const hit = await fromCache();
    if (hit) return hit;
    const res = await fetch(request);
    if (res.ok) (await caches.open(VERSION)).put(request, res.clone());
    return res;
  })());
});
