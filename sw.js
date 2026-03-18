/* ============================================================
   AstroChitra Service Worker v2 (Modified for Immediate Updates)
   ============================================================ */

const CACHE_VERSION    = 'astrochitra-v3';
const STATIC_CACHE     = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE    = `${CACHE_VERSION}-runtime`;
const ALL_CACHES       = [STATIC_CACHE, RUNTIME_CACHE];

/* Files to precache on install (app shell) */
const PRECACHE_ASSETS = [
  './index.html',
  './manifest.json',
  './Astrochitra-color-logo.svg',
  './android-chrome-192x192.png',
  './android-chrome-512x512.png',
  './apple-touch-icon.png',
  './favicon.ico',
  './favicon-16x16.png',
  './favicon-32x32.png',
];

/* Cross-origin CDN assets to cache at runtime */
const CDN_HOSTNAMES = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'cdnjs.cloudflare.com',
];

/* ── Install: precache the app shell ────────────────────────── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting()) // activate immediately
  );
});

/* ── Activate: purge stale caches ───────────────────────────── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => !ALL_CACHES.includes(key))
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim()) // take control of open tabs
  );
});

/* ── Message handler ─────────────────────────────────────────── */
// The page sends { type: 'SKIP_WAITING' } when the user clicks "Reload"
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

/* ── Fetch strategy ─────────────────────────────────────────── */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and non-http(s) requests
  if (request.method !== 'GET') return;
  if (!url.protocol.startsWith('http')) return;

  // ── 1. App shell (same origin) → Network-First for index.html, Cache-First for others ────────────────
  if (url.origin === self.location.origin) {
    // Use network-first for index.html to ensure immediate updates
    if (url.pathname === '/index.html' || url.pathname === '/') {
      event.respondWith(networkFirst(request, RUNTIME_CACHE));
    } else {
      event.respondWith(cacheFirst(request, STATIC_CACHE));
    }
    return;
  }

  // ── 2. CDN assets (fonts, icons) → Stale-While-Revalidate ───
  if (CDN_HOSTNAMES.includes(url.hostname)) {
    event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
    return;
  }

  // ── 3. Everything else → Network-First ──────────────────────
  event.respondWith(networkFirst(request, RUNTIME_CACHE));
});

/* ══════════════════════════════════════════════════════════════
   Strategy helpers
══════════════════════════════════════════════════════════════ */

/**
 * Cache-First: serve from cache, else fetch + cache.
 * Best for versioned/immutable assets (app shell, icons).
 */
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

/**
 * Network-First: try network, cache on success, fall back to cache.
 * Best for pages / API responses that change often.
 */
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

/**
 * Stale-While-Revalidate: serve cache instantly, refresh in background.
 * Best for CDN fonts/icons that rarely change.
 */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);

  return cached || fetchPromise;
}

/* ── Push Notifications ─────────────────────────────────────── */
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch {}

  const title   = data.title || 'AstroChitra';
  const options = {
    body:    data.body    || 'New cosmic insight awaits.',
    icon:    './android-chrome-192x192.png',
    badge:   './android-chrome-512x512.png',
    image:   data.image   || undefined,
    vibrate: [200, 100, 200],
    tag:     data.tag     || 'astrochitra-notification',
    renotify: true,
    data:    { url: data.url || 'https://astrochitra.com' },
    actions: [
      { action: 'open',    title: 'Open App' },
      { action: 'dismiss', title: 'Dismiss'  },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  const url = event.notification.data?.url || 'https://astrochitra.com';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // Focus existing window if already open
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) return client.focus();
      }
      return clients.openWindow(url);
    })
  );
});
