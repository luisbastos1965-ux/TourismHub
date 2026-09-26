const CACHE_NAME = 'turmapro-prof-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/prof.html',
  '/style.css',
  '/js/prof-app.js',
  '/js/prof/ui.js',
  '/js/prof/store.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE)));
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
