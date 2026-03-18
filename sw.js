/* ============================================================
   AstroChitra Service Worker — Network-First Strategy
   Change CACHE_VERSION on every deployment to force update.
   ============================================================ */

const CACHE_VERSION = 'astrochitra-v1';
const CACHE_ASSETS = [
  './index.html',
  './manifest.json'
];

// ── Install: pre-cache shell ──────────────────────────────────
self.addEventListener('install', event => {
  self.skipWaiting(); // activate immediately on update
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache => cache.addAll(CACHE_ASSETS))
  );
});

// ── Activate: purge old caches ────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_VERSION)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim()) // take control of open tabs
  );
});

// ── Fetch: Network-First ──────────────────────────────────────
// Always tries the network first. Falls back to cache only if
// the network fails (e.g. user is truly offline).
self.addEventListener('fetch', event => {
  // Skip non-GET and cross-origin requests
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    fetch(event.request)
      .then(networkResponse => {
        // Clone & refresh cache with latest from network
        const clone = networkResponse.clone();
        caches.open(CACHE_VERSION).then(cache => cache.put(event.request, clone));
        return networkResponse;
      })
      .catch(() =>
        // Network failed — serve stale cache as fallback
        caches.match(event.request).then(cached => cached || fetch(event.request))
      )
  );
});

// ── Push Notifications (stub — wire up later) ─────────────────
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'AstroChitra';
  const options = {
    body: data.body || 'New cosmic insight awaits.',
    icon: 'https://astrochitra.com/Astrochitra-color-logo.svg',
    badge: 'https://astrochitra.com/Astrochitra-color-logo.svg',
    data: { url: data.url || 'https://astrochitra.com' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || 'https://astrochitra.com';
  event.waitUntil(clients.openWindow(url));
});
