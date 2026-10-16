/* Lab Systems v5.1.7 PREMIUM FIXED - Aggressive cache bust - Self-unregister all + clear everything 2026-10-15 */
const CACHE_NAME = 'lab-systems-v5.1.7-premium-fixed-2026-10-15';
self.addEventListener('install', e=>{ self.skipWaiting(); });
self.addEventListener('activate', e=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.map(k=>caches.delete(k))))
    .then(()=>self.clients.claim())
    .then(()=>self.registration.unregister())
    .then(()=>{ console.log('SW unregistered and all caches cleared for v5.1.7'); })
  );
});
self.addEventListener('fetch', e=>{ return; });
