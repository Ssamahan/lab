/* Lab Systems v5.2.3 - Fix giant buggy icons, dashboard all time FY toggle real hospital distribution, premium charts exact Arena clone - Self-unregister + cache bust 2026-10-15 */
const CACHE_NAME = 'lab-systems-v5.2.3-premium-2026-10-15';
self.addEventListener('install', e=>{ self.skipWaiting(); });
self.addEventListener('activate', e=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.map(k=>caches.delete(k))))
    .then(()=>self.clients.claim())
    .then(()=>self.registration.unregister())
  );
});
self.addEventListener('fetch', e=>{ return; });
