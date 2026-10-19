/* Lab Systems v5.2.4 PREMIUM REAL - Real data only no hallucination, revenue admin-only - Self-unregister + cache bust 2026-10-15 */
const CACHE_NAME = 'lab-systems-v5.2.4-premium-real-2026-10-15';
self.addEventListener('install', e=>{ self.skipWaiting(); });
self.addEventListener('activate', e=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.map(k=>caches.delete(k))))
    .then(()=>self.clients.claim())
    .then(()=>self.registration.unregister())
  );
});
self.addEventListener('fetch', e=>{ return; });
