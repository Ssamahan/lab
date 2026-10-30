/* ============================================================================
   LAB SYSTEMS · SERVICE WORKER — offline-first shell & asset cache
   Strategy: precache the shell + core, stale-while-revalidate for modules,
   navigation fallback to index.html so deep links work with no network.
   ========================================================================== */
const VERSION = 'v6.9.76';
const SHELL = 'lab-shell-' + VERSION;
const RUNTIME = 'lab-runtime-' + VERSION;

const CORE = [
  './',
  './index.html',
  './manifest.json',
  './assets/css/tokens.css',
  './assets/css/app.css',
  './assets/css/modules.css',
  './assets/css/landing.css',
  './assets/data/plan-archive.js',
  './assets/js/core/icons.js',
  './assets/js/core/seed.js',
  './assets/js/core/utils.js',
  './assets/js/core/store.js',
  './assets/js/core/ui.js',
  './assets/js/core/charts.js',
  './assets/js/core/sheets.js',
  './assets/js/core/i18n.js',
  './assets/js/core/auth.js',
  './assets/js/core/landing.js',
  './assets/js/core/shared.js',
  './assets/js/core/shell.js',
  './assets/js/core/sync.js',
  './assets/js/core/boot.js',
  './assets/favicon-32.png',
  './assets/favicon-192.png',
  './assets/favicon-512.png',
  './assets/favicon.svg',
  './assets/fonts/fraunces-latin-300-normal.woff2',
  './assets/fonts/fraunces-latin-400-normal.woff2',
  './assets/fonts/fraunces-latin-400-italic.woff2',
  './assets/fonts/fraunces-latin-500-normal.woff2',
  './assets/fonts/fraunces-latin-600-normal.woff2',
  './assets/fonts/inter-latin-400-normal.woff2',
  './assets/fonts/inter-latin-500-normal.woff2',
  './assets/fonts/inter-latin-600-normal.woff2',
  './assets/fonts/inter-latin-700-normal.woff2',
  './assets/fonts/ibm-plex-mono-latin-400-normal.woff2',
  './assets/fonts/ibm-plex-mono-latin-500-normal.woff2',
  './assets/fonts/ibm-plex-mono-latin-600-normal.woff2'
];

const MODULES = [
  'dash', 'samples', 'stock', 'training', 'revenue', 'roster',
  'leave', 'eqa', 'pbf', 'quality', 'equipment', 'staff',
  'security', 'design', 'roadmap'
].map(m => './assets/js/modules/' + m + '.js');

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    // addAll fails atomically; add individually so one 404 never blocks install
    await Promise.all(CORE.concat(MODULES).map(url =>
      cache.add(new Request(url, { cache: 'reload' })).catch(() => null)
    ));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== SHELL && k !== RUNTIME).map(k => caches.delete(k)));
    if (self.registration.navigationPreload) {
      try { await self.registration.navigationPreload.enable(); } catch (e) {}
    }
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  const data = event.data || {};
  if (data.type === 'SKIP_WAITING') self.skipWaiting();
  if (data.type === 'CLEAR_CACHE') {
    event.waitUntil(caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))));
  }
});

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  } catch (err) {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    throw err;
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request, { ignoreSearch: true });
  const network = fetch(request).then(res => {
    if (res && res.ok) cache.put(request, res.clone());
    return res;
  }).catch(() => null);
  return cached || network || Response.error();
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;          // never cache third-party
  if (url.pathname.endsWith('/sw.js')) return;

  // Navigations: network first, fall back to cached shell (deep links included)
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const preload = await event.preloadResponse;
        if (preload) return preload;
        return await networkFirst(req, SHELL);
      } catch (e) {
        const cache = await caches.open(SHELL);
        return (await cache.match('./index.html')) || Response.error();
      }
    })());
    return;
  }

  // Code is network-first: an update is visible on the next load, and the cache
  // is only the offline fallback. Anything else is what made fixed bugs look
  // unfixed on a device that had visited before.
  if (/\.(?:css|js|json|webmanifest)$/.test(url.pathname) || url.pathname === '/') {
    event.respondWith((async () => {
      try { return await networkFirst(req, RUNTIME); }
      catch (e) {
        const shell = await caches.open(SHELL);
        return (await shell.match(req, { ignoreSearch: true })) || (await caches.match(req)) || Response.error();
      }
    })());
    return;
  }

  // Fonts, icons and images: stale-while-revalidate — they are content-hashed
  if (/\.(?:woff2?|png|svg|jpg|jpeg|webp|ico)$/.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(req, RUNTIME));
    return;
  }

  // Everything else: try network, then cache
  event.respondWith((async () => {
    try { return await fetch(req); }
    catch (e) {
      const cache = await caches.open(RUNTIME);
      return (await cache.match(req)) || Response.error();
    }
  })());
});
