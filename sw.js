/* Lab Systems v5.3.0 PREMIUM EXACT - Exact module descriptions, same font size icons color combos - Self-unregister + cache bust 2026-10-15 */
const CACHE_NAME = 'lab-systems-v5.3.0-premium-exact-2026-10-15';
self.addEventListener('install', e=>{ self.skipWaiting(); });
self.addEventListener('activate', e=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.map(k=>caches.delete(k))))
    .then(()=>self.clients.claim())
    .then(()=>self.registration.unregister())
  );
});
self.addEventListener('fetch', e=>{ return; });
