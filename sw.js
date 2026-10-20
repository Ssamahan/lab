/* Lab Systems v5.3.2 - Fix v4.34.0 cache, Kigali time greeting, real data - Self-unregister + cache bust 2026-10-20 */
const CACHE_NAME = 'lab-systems-v5.3.2-premium-real-2026-10-20';
self.addEventListener('install', e=>{ self.skipWaiting(); });
self.addEventListener('activate', e=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.map(k=>caches.delete(k))))
    .then(()=>self.clients.claim())
    .then(()=>self.registration.unregister())
  );
});
self.addEventListener('fetch', e=>{
  const url=new URL(e.request.url);
  if(url.pathname.includes('/lab') || e.request.mode==='navigate'){
    e.respondWith(fetch(e.request, {cache:'no-store'}).then(r=>r).catch(()=>caches.match(e.request)));
  }
});
