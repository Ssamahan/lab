/* Lab Systems v5.2.0 AURORA PREMIUM - Fix flask bug, premium charts curved, dark mode perfect match - Self-unregister + cache bust 2026-10-15 */
const CACHE_NAME = 'lab-systems-v5.2.0-aurora-premium-2026-10-15';
self.addEventListener('install', e=>{ self.skipWaiting(); });
self.addEventListener('activate', e=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k))))
    .then(()=>self.clients.claim())
    .then(()=>self.registration.unregister())
  );
});
self.addEventListener('fetch', e=>{ return; });
