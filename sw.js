'use strict';

const CACHE_VERSION = 'mesh-v5';
const CACHE_SHELL = CACHE_VERSION + '-shell';
const CACHE_RUNTIME = CACHE_VERSION + '-runtime';

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/admin.html',
  '/manifest.json',
  '/assets/logo.png',
  '/assets/logo.jpg',
  'https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;600;700;800&family=Libre+Baskerville:wght@700&display=swap',
];

function isApiRequest(url) {
  return url.pathname.startsWith('/api/');
}

function isNavigationRequest(request) {
  return request.mode === 'navigate' ||
    (request.method === 'GET' && request.headers.get('accept')?.includes('text/html'));
}

function isStaticAsset(url) {
  if (url.origin === self.location.origin) {
    return url.pathname === '/index.html' ||
      url.pathname === '/admin.html' ||
      url.pathname === '/manifest.json' ||
      url.pathname.startsWith('/assets/');
  }
  return url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.status === 200) {
    const cache = await caches.open(CACHE_RUNTIME);
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(CACHE_RUNTIME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (_err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw _err;
  }
}

async function navigationFallback() {
  const cache = await caches.open(CACHE_SHELL);
  return (await cache.match('/index.html')) ||
    (await cache.match('/')) ||
    new Response('Sin conexión. Recargue cuando tenga internet.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_SHELL).then((cache) =>
      cache.addAll(PRECACHE_URLS).catch((err) => {
        console.warn('[SW] Precache parcial:', err);
        return Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(url)));
      })
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_SHELL && key !== CACHE_RUNTIME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (isApiRequest(url)) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (isNavigationRequest(request)) {
    const cacheKey = url.pathname === '/' ? '/index.html' : url.pathname;
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copia = response.clone();
            caches.open(CACHE_SHELL).then((cache) => cache.put(cacheKey, copia));
          }
          return response;
        })
        .catch(async () => (await caches.match(cacheKey)) || navigationFallback())
    );
    return;
  }

  if (isStaticAsset(url) || url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request));
    return;
  }

  event.respondWith(cacheFirst(request));
});
