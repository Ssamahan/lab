/* Lab Systems v4.31.3 - Minimal - Self-unregister + cache bust 2026-10-13 */
const CACHE_NAME = 'lab-systems-v4.31.3-2026-10-13';
self.addEventListener('install', e=>{ self.skipWaiting(); });
self.addEventListener('activate', e=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k))))
    .then(()=>self.clients.claim())
    .then(()=>self.registration.unregister())
  );
});
self.addEventListener('fetch', e=>{ return; });
