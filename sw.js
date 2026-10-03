/* Lab Systems v4.29.6 - Minimal - Self-unregister to fix endless loading + cache bust */
const CACHE_NAME = 'lab-systems-v4.29.6-2026-10-03';
self.addEventListener('install', e=>{ self.skipWaiting(); });
self.addEventListener('activate', e=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k))))
    .then(()=>self.clients.claim())
    .then(()=>self.registration.unregister())
  );
});
self.addEventListener('fetch', e=>{ return; });
