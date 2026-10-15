/* Lab Systems v5.1.3 PREMIUM - Exact Arena clone with real data, no hallucination - Self-unregister + cache bust 2026-10-15 */
const CACHE_NAME = 'lab-systems-v5.1.3-premium-2026-10-15';
self.addEventListener('install', e=>{ self.skipWaiting(); });
self.addEventListener('activate', e=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k))))
    .then(()=>self.clients.claim())
    .then(()=>self.registration.unregister())
  );
});
self.addEventListener('fetch', e=>{ return; });
