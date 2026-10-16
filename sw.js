/* Lab Systems v5.1.7 PREMIUM - Fix footer unreadable, theme-aware, version only when unfolded - Self-unregister + cache bust 2026-10-15 */
const CACHE_NAME = 'lab-systems-v5.1.7-premium-footer-2026-10-15';
self.addEventListener('install', e=>{ self.skipWaiting(); });
self.addEventListener('activate', e=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.map(k=>caches.delete(k))))
    .then(()=>self.clients.claim())
    .then(()=>self.registration.unregister())
  );
});
self.addEventListener('fetch', e=>{ return; });
