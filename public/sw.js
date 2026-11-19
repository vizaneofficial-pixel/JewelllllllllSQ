// StallIQ Service Worker — Static App Shell Only
// Security rule: NEVER cache /api/*, WebSocket /live, Firebase Auth, or Firestore user project data.
const CACHE_NAME = 'stalliq-shell-v2';
const FONT_CACHE_NAME = 'stalliq-fonts-v1';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon.svg',
  '/favicon.ico',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-512x512.png',
  '/apple-touch-icon.png',
];

function isPublicFontRequest(url) {
  return (
    url.origin === 'https://fonts.googleapis.com' ||
    url.origin === 'https://fonts.gstatic.com'
  );
}

function isSensitiveOrDynamic(url) {
  if (url.origin !== self.location.origin && !isPublicFontRequest(url)) return true;
  if (url.pathname.startsWith('/api/')) return true;
  if (url.pathname.startsWith('/live')) return true;
  if (url.pathname.startsWith('/__')) return true;
  return false;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const urlsToCache = new Set(STATIC_ASSETS);

      try {
        const res = await fetch('/sw-precache.json', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data?.assets)) {
            for (const asset of data.assets) {
              if (typeof asset === 'string' && asset.startsWith('/')) {
                urlsToCache.add(asset);
              }
            }
          }
        }
      } catch {
        // Dev mode or offline during install: rely on STATIC_ASSETS
      }

      await Promise.allSettled(
        Array.from(urlsToCache).map((assetUrl) => cache.add(assetUrl))
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE_NAME && k !== FONT_CACHE_NAME)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    void self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  if (isSensitiveOrDynamic(url)) {
    return;
  }

  // Public Google Fonts stylesheets/font files (safe cache-first with background refresh)
  if (isPublicFontRequest(url)) {
    event.respondWith(
      caches.open(FONT_CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) {
          event.waitUntil(
            fetch(request.url)
              .then((res) => {
                if (res && res.status === 200) {
                  return cache.put(request, res.clone());
                }
              })
              .catch(() => {})
          );
          return cached;
        }
        try {
          const res = await fetch(request);
          if (res && res.status === 200) {
            await cache.put(request, res.clone());
          }
          return res;
        } catch {
          return new Response('', {
            status: 200,
            headers: { 'Content-Type': 'text/css; charset=utf-8' },
          });
        }
      })
    );
    return;
  }

  // Network-first for HTML navigations so fresh deploys load immediately, with deterministic offline shell fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/', copy)).catch(() => {});
          }
          return res;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          const cachedRoot = await cache.match('/');
          if (cachedRoot) return cachedRoot;
          const cachedIndex = await cache.match('/index.html');
          if (cachedIndex) return cachedIndex;
          return new Response(
            '<!doctype html><html><body style="background:#0B0A10;color:#F5F3FA;font-family:sans-serif;padding:24px"><h2>StallIQ is offline</h2><p>Open StallIQ once with internet to cache the offline shell.</p></body></html>',
            { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          );
        })
    );
    return;
  }

  // Cache-first only for static app shell assets & icons
  const isStaticAsset =
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/src/') ||
    STATIC_ASSETS.includes(url.pathname) ||
    /\.(?:js|css|svg|png|ico|woff2?|webmanifest)$/i.test(url.pathname);

  if (!isStaticAsset) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached =
        (await cache.match(url.pathname)) || (await cache.match(request));
      if (cached) {
        // Content-hashed /assets/* files are immutable; only refresh unhashed assets in background
        if (!url.pathname.startsWith('/assets/')) {
          event.waitUntil(
            fetch(url.pathname)
              .then((res) => {
                if (res && res.status === 200 && res.type === 'basic') {
                  return cache.put(url.pathname, res.clone());
                }
              })
              .catch(() => {})
          );
        }
        return cached;
      }

      const res = await fetch(request);
      if (res && res.status === 200 && res.type === 'basic') {
        await cache.put(url.pathname, res.clone());
      }
      return res;
    })
  );
});
