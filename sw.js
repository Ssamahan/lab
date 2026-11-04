/* ============================================================================
   LAB SYSTEMS · SERVICE WORKER — offline-first shell & asset cache
   Strategy: precache the shell + core, stale-while-revalidate for modules,
   navigation fallback to index.html so deep links work with no network.
   ========================================================================== */
const VERSION = 'v6.9.101';

/* Served only when a navigation cannot reach the network AND the shell is not in any cache.
   It must not depend on a single file from the build — it is the last thing that can still
   be said when nothing else arrives. */
const OFFLINE_PAGE = '<!DOCTYPE html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
  + '<title>Lab Systems — not reached</title>'
  + '<body style="margin:0;background:#14120E;color:#EFE7D6;font:15px/1.65 system-ui,sans-serif;padding:28px">'
  + '<div style="max-width:520px;margin:8vh auto">'
  + '<h1 style="font-family:Georgia,serif;font-weight:400;font-size:1.6rem;margin:0 0 10px">The console did not arrive</h1>'
  + '<p style="color:#B9AE99;margin:0 0 18px">The network did not answer and this browser holds no stored copy of the '
  + 'console. The register on this device has not been touched.</p>'
  + '<p style="margin:0 0 8px"><a href="./reset.html" style="display:inline-block;padding:10px 16px;border-radius:9px;'
  + 'background:#C9A84C;color:#241A06;text-decoration:none;font-weight:600">Repair this device</a></p>'
  + '<p style="margin:0"><a href="./" style="color:#C9A84C">Try again</a></p></div></body>';
const SHELL = 'lab-shell-' + VERSION;
const RUNTIME = 'lab-runtime-' + VERSION;

const CORE = [
  './',
  './index.html',
  './manifest.json',
  './reset.html',
  './assets/css/tokens.css?v=6.9.101',
  './assets/css/app.css?v=6.9.101',
  './assets/css/modules.css?v=6.9.101',
  './assets/css/landing.css?v=6.9.101',
  './assets/data/plan-archive.js?v=6.9.101',
  './assets/js/core/icons.js?v=6.9.101',
  './assets/js/core/seed.js?v=6.9.101',
  './assets/js/core/utils.js?v=6.9.101',
  './assets/js/core/store.js?v=6.9.101',
  './assets/js/core/ui.js?v=6.9.101',
  './assets/js/core/charts.js?v=6.9.101',
  './assets/js/core/sheets.js?v=6.9.101',
  './assets/js/core/xlsxread.js?v=6.9.101',
  './assets/js/core/i18n.js?v=6.9.101',
  './assets/js/core/auth.js?v=6.9.101',
  './assets/js/core/landing.js?v=6.9.101',
  './assets/js/core/shared.js?v=6.9.101',
  './assets/js/core/shell.js?v=6.9.101',
  './assets/js/core/sync.js?v=6.9.101',
  './assets/js/core/boot.js?v=6.9.101',
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

  // Navigations: network first, fall back to the cached shell (deep links included).
  // A navigation must NEVER be answered with Response.error(): that is the browser's own
  // "this site can't be reached" page, which looks exactly like a site that has gone away
  // and tells the person nothing they can act on. If the shell is not in the cache either,
  // a small self-contained page is written out instead — it carries the repair link.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const preload = await event.preloadResponse;
        if (preload) return preload;
        const fresh = await fetch(req).catch(() => null);
        if (fresh && fresh.ok) {
          const cache = await caches.open(SHELL);
          cache.put(req, fresh.clone()).catch(() => {});
          return fresh;
        }
      } catch (e) {}
      const shell = await caches.open(SHELL);
      const hit = (await shell.match('./index.html')) || (await shell.match(req, { ignoreSearch: true }))
        || (await caches.match('./index.html')) || (await caches.match(req, { ignoreSearch: true }));
      if (hit) return hit;
      return new Response(OFFLINE_PAGE, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
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
