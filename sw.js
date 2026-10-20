/* Lab Systems v5.2.6 - Fix no changes at all - aggressive CDN cache bust - Self-unregister all + network-first 2026-10-20 */
const CACHE_NAME = 'lab-systems-v5.2.6-premium-real-2026-10-20';
self.addEventListener('install', e=>{
  self.skipWaiting();
  console.log('SW v5.2.6 install - clearing all caches');
});
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
    e.respondWith(fetch(e.request, {cache:'no-store', cacheControl:'no-cache'}).then(r=>r).catch(()=>caches.match(e.request)));
  }
});
