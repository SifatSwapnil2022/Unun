/*
 * Unun's service worker does one thing: when a page cannot be fetched because the phone
 * is offline, it shows a page that says so, instead of the browser's error. It keeps no
 * copy of menus, prices or orders, because an old price shown as current is worse than
 * no price.
 */
const CACHE = 'unun-offline-v1';
const OFFLINE_PAGE = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(new Request(OFFLINE_PAGE, { cache: 'reload' })))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names.filter((name) => name !== CACHE).map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  // Only whole pages. Data, images and scripts go to the network as if this file were not here.
  if (event.request.mode !== 'navigate') return;

  event.respondWith(
    fetch(event.request).catch(async () => {
      const cached = await caches.match(OFFLINE_PAGE);
      return cached ?? Response.error();
    }),
  );
});
