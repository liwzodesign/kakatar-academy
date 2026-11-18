/*
 * Service worker Kakatar Academy.
 * - Fichiers de l'application (JS/CSS/images versionnés) : cache d'abord (rapide, utilisable hors ligne).
 * - Pages : réseau d'abord, puis la dernière version en cache, puis la page hors ligne.
 * - API, médias privés, administration : JAMAIS mis en cache (données personnelles et jetons).
 */
const VERSION = 'kakatar-v1';
const SHELL = ['/', '/offline.html', '/logo.svg', '/logo-mark.svg', '/icons/icon-192.png', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const NEVER_CACHE = /^\/(api|admin|graphql|media|health|metrics)(\/|$)/;

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || NEVER_CACHE.test(url.pathname)) return;

  // Navigation (pages de l'application)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(VERSION).then((cache) => cache.put('/', copy));
          return response;
        })
        .catch(() => caches.match('/').then((cached) => cached || caches.match('/offline.html')))
    );
    return;
  }

  // Ressources statiques : cache d'abord
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/') || /\.(svg|png|woff2?)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(VERSION).then((cache) => cache.put(request, copy));
        }
        return response;
      }))
    );
  }
});
