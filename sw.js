/* ============================================================================
   LAB SYSTEMS · SERVICE WORKER — offline-first shell & asset cache
   Strategy: precache the shell + core, stale-while-revalidate for modules,
   navigation fallback to index.html so deep links work with no network.
   ========================================================================== */
const VERSION = 'v6.9.155';
const SHELL = 'lab-shell-' + VERSION;
const RUNTIME = 'lab-runtime-' + VERSION;

/* What the console needs to *open*: the shell, the four stylesheets, the twelve core
   modules, the two icons and the two fonts the first screen actually draws.
   Everything else — the sixteen screens (847 KB), the export engine (91 KB), the
   register sheets and the nine remaining font files — is fetched the first time it is
   used, and kept by the runtime cache from then on. Precache used to include all of it,
   which meant a first visit downloaded about 2.5 MB in the background while the page
   itself was still arriving: on a slow link that is what "the site takes very long"
   looks like. The warm-up below brings the rest in *after* the first screen, when the
   connection is no longer being competed for, and only if the device is not on a
   metered or save-data connection. */
const CORE = [
  './',
  './index.html',
  './manifest.json',
  './assets/css/tokens.css?v=6.9.155',
  './assets/css/app.css?v=6.9.155',
  './assets/css/modules.css?v=6.9.155',
  './assets/css/landing.css?v=6.9.155',
  './assets/data/plan-archive.js?v=6.9.155',
  './assets/js/core/icons.js?v=6.9.155',
  './assets/js/core/seed.js?v=6.9.155',
  './assets/js/core/utils.js?v=6.9.155',
  './assets/js/core/store.js?v=6.9.155',
  './assets/js/core/ui.js?v=6.9.155',
  './assets/js/core/charts.js?v=6.9.155',
  './assets/js/core/sheets.js?v=6.9.155',
  './assets/js/core/i18n.js?v=6.9.155',
  './assets/js/core/auth.js?v=6.9.155',
  './assets/js/core/landing.js?v=6.9.155',
  './assets/js/core/shared.js?v=6.9.155',
  './assets/js/core/shell.js?v=6.9.155',
  './assets/js/core/sync.js?v=6.9.155',
  './assets/js/core/private-names.js?v=6.9.155',
  './assets/js/core/boot.js?v=6.9.155',
  './assets/favicon-32.png',
  './assets/favicon-192.png',
  './assets/favicon-512.png',
  './assets/favicon.svg',
  './assets/fonts/fraunces-latin-400-normal.woff2',
  './assets/fonts/inter-latin-400-normal.woff2'
];

/* The rest, brought in after the first screen is open (see the WARM message). */
const LATER = [
  './assets/js/core/xlsxread.js?v=6.9.155',
  './assets/js/core/training-maps.js?v=6.9.155',
  './assets/data/rwanda-districts.geojson?v=6.9.155',
  './assets/fonts/fraunces-latin-300-normal.woff2',
  './assets/fonts/fraunces-latin-400-italic.woff2',
  './assets/fonts/fraunces-latin-500-normal.woff2',
  './assets/fonts/fraunces-latin-600-normal.woff2',
  './assets/fonts/inter-latin-500-normal.woff2',
  './assets/fonts/inter-latin-600-normal.woff2',
  './assets/fonts/inter-latin-700-normal.woff2',
  './assets/fonts/ibm-plex-mono-latin-400-normal.woff2',
  './assets/fonts/ibm-plex-mono-latin-500-normal.woff2',
  './assets/fonts/ibm-plex-mono-latin-600-normal.woff2'
];

/* The sixteen console screens, by name. Their URLs carry the version, so they are the
   same strings the shell asks for and a cached copy can never answer with the wrong one. */
const MODULES = [
  'dash', 'samples', 'stock', 'report', 'training', 'revenue', 'roster',
  'leave', 'eqa', 'pbf', 'quality', 'equipment', 'staff',
  'security', 'design', 'roadmap'
];
const moduleUrl = m => './assets/js/modules/' + m + '.js?v=' + VERSION.replace(/^v/, '');

/* One downloader for both passes: four at a time, never the whole list at once, and a
   failed file is skipped rather than failing the install. */
async function precache(list, cacheName, size, timeoutMs){
  const cache = await caches.open(cacheName);
  const step = size || 4;
  for (let i = 0; i < list.length; i += step) {
    await Promise.all(list.slice(i, i + step).map(async url => {
      // Warm-up must move on even if one request never finishes.
      const controller = timeoutMs ? new AbortController() : null;
      const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
      try { await cache.add(new Request(url, { cache: 'reload', ...(controller ? {signal: controller.signal} : {}) })); }
      catch (e) { /* A missing file can still be fetched when it is opened. */ }
      finally { if (timer) clearTimeout(timer); }
    }));
  }
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    await precache(CORE, SHELL, 4);
    self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // Preserve previously cached versions and other applications' caches. An
    // open tab may still need them, particularly while this device is offline.
    if (self.registration.navigationPreload) {
      try { await self.registration.navigationPreload.enable(); } catch (e) {}
    }
    await self.clients.claim();
  })());
});

/* Screens are brought in when the page says the first screen is open and the device is
   idle — not during install. Until then the runtime cache picks up whatever is visited,
   so the app is complete offline for everything that has been used. */
self.addEventListener('message', event => {
  const data = event.data || {};
  if (data.type === 'WARM') {
    event.waitUntil((async () => {
      const targets = MODULES.map(moduleUrl).concat(LATER);
      await precache(targets, SHELL, 3, 12000);
    })());
  }
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

/* Code asked for at the current build's version can never be the wrong file: the version
   is in the address. So it is served from the cache at once, and the fetch behind it only
   keeps the cache warm. This is what makes a second visit open instantly on a phone —
   the first visit still pays for the download, nothing after it does. An unversioned URL
   stays network-first, which is what tells an older page that a new build exists. */
function isCurrentVersion(url){
  const want = VERSION.replace(/^v/,'');
  return url.searchParams.get('v') === want;
}
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = (await cache.match(request)) || (await (await caches.open(SHELL)).match(request));
  const refresh = fetch(request).then(res => {
    if (res && res.ok) cache.put(request, res.clone());
    return res;
  }).catch(() => null);
  if (hit) { refresh; return hit; }
  const fresh = await refresh;
  if (fresh) return fresh;
  return (await caches.match(request)) || Response.error();
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

  // Code pinned to this build's version: from the cache, instantly, refreshed behind it.
  if (/\.(?:css|js|json|webmanifest)$/.test(url.pathname) && isCurrentVersion(url)) {
    event.respondWith(cacheFirst(req, RUNTIME));
    return;
  }

  // Anything else that is code is network-first: an update is visible on the next load,
  // and the cache is only the offline fallback.
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
