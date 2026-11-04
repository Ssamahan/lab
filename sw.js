/* ============================================================================
   LAB SYSTEMS · SERVICE WORKER — offline-first shell & asset cache
   Strategy: precache the shell + core, stale-while-revalidate for modules,
   navigation fallback to index.html so deep links work with no network.
   ========================================================================== */
const VERSION = 'v6.9.98';
const SHELL = 'lab-shell-' + VERSION;
const RUNTIME = 'lab-runtime-' + VERSION;

const CORE = [
  './',
  './index.html',
  './manifest.json',
  './assets/css/tokens.css?v=6.9.98',
  './assets/css/app.css?v=6.9.98',
  './assets/css/modules.css?v=6.9.98',
  './assets/css/landing.css?v=6.9.98',
  './assets/data/plan-archive.js?v=6.9.98',
  './assets/js/core/icons.js?v=6.9.98',
  './assets/js/core/seed.js?v=6.9.98',
  './assets/js/core/utils.js?v=6.9.98',
  './assets/js/core/store.js?v=6.9.98',
  './assets/js/core/ui.js?v=6.9.98',
  './assets/js/core/charts.js?v=6.9.98',
  './assets/js/core/sheets.js?v=6.9.98',
  './assets/js/core/xlsxread.js?v=6.9.98',
  './assets/js/core/i18n.js?v=6.9.98',
  './assets/js/core/auth.js?v=6.9.98',
  './assets/js/core/landing.js?v=6.9.98',
  './assets/js/core/shared.js?v=6.9.98',
  './assets/js/core/shell.js?v=6.9.98',
  './assets/js/core/sync.js?v=6.9.98',
  './assets/js/core/boot.js?v=6.9.98',
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
  'dash', 'samples', 'stock', 'reports', 'training', 'revenue', 'roster',
  'leave', 'eqa', 'pbf', 'quality', 'equipment', 'staff',
  'security', 'design', 'roadmap'
].map(m => './assets/js/modules/' + m + '.js?v=' + VERSION.replace(/^v/, ''));

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    /* Only the shell is cached here, and it is taken from the browser's own copy: the
       page has just downloaded every one of these files, so `cache: 'default'` stores
       what is already there. The old `cache: 'reload'` ignored that copy and pulled the
       whole bundle down a second time — on a phone that is the difference between one
       download and two, and it happens on every release. Six at a time, still, so the
       cache never competes with the page for the connection. (The old install mode was
       `reload`, which is what ignored the browser's copy.) */
    for (let i = 0; i < CORE.length; i += 6) {
      await Promise.all(CORE.slice(i, i + 6).map(url =>
        cache.add(new Request(url, { cache: 'default' })).catch(() => null)
      ));
    }
    self.skipWaiting();
  })());
});

/* The sixteen screens are warmed once the page is up, not before it can be drawn. A
   module is only ever fetched when someone opens that screen, so nothing is lost by
   filling the cache a few seconds later — and a phone that is being typed into is not
   made to wait for twelve screens nobody has asked for yet. */
async function warmModules() {
  const cache = await caches.open(SHELL);
  for (let i = 0; i < MODULES.length; i += 4) {
    await Promise.all(MODULES.slice(i, i + 4).map(url =>
      cache.add(new Request(url, { cache: 'default' })).catch(() => null)
    ));
  }
}

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== SHELL && k !== RUNTIME).map(k => caches.delete(k)));
    if (self.registration.navigationPreload) {
      try { await self.registration.navigationPreload.enable(); } catch (e) {}
    }
    await self.clients.claim();
    setTimeout(() => { warmModules().catch(() => {}); }, 12000);
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
  const hit = await cache.match(request);
  /* A hit is final: the address carries the build version, so the file behind it cannot
     have changed. The old code fired a background request for every asset on every
     visit — forty requests of JavaScript and CSS that only ever came back identical,
     saturating the connection while the person waited for a page to appear. */
  if (hit) return hit;
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  } catch (e) {
    return (await caches.match(request)) || Response.error();
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
