const CACHE_NAME = 'anti-cfd-cache-v17';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/qr_code_testeur.png',
  './illustrations/01_lapin_et_pistolet.jpg',
  './illustrations/02_decompte_et_viseur.jpg',
  './illustrations/03_cercle_et_carre.jpg',
  './illustrations/04_pistolet_ciel.jpg',
  './illustrations/05_index_et_auriculaire.jpg',
  './illustrations/06_doigts_flechis_croises.jpg',
  './illustrations/07_trajectoires_spatiales.jpg',
  './videos/respiration_coherence_cardiaque.mp4',
  './videos/01_lapin_et_pistolet.mp4'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Do not intercept non-GET requests or browser-extension schemes
  if (event.request.method !== 'GET') return;

  // Gestion spécifique des requêtes Range pour les vidéos sous Safari iOS
  if (event.request.headers.get('range')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(event.request.url).then((response) => {
          if (!response) return new Response('Video not found', { status: 404 });
          return response.arrayBuffer().then((buffer) => {
            const range = event.request.headers.get('range');
            const bytes = range.replace(/bytes=/, '').split('-');
            const start = parseInt(bytes[0], 10);
            const end = bytes[1] ? parseInt(bytes[1], 10) : buffer.byteLength - 1;
            const chunk = buffer.slice(start, end + 1);
            return new Response(chunk, {
              status: 206,
              statusText: 'Partial Content',
              headers: {
                'Content-Range': `bytes ${start}-${end}/${buffer.byteLength}`,
                'Content-Length': chunk.byteLength,
                'Content-Type': response.headers.get('Content-Type') || 'video/mp4',
                'Accept-Ranges': 'bytes'
              }
            });
          });
        });
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        // Cache dynamic assets if same origin
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Fallback for HTML documents
        if (event.request.destination === 'document') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
