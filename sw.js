/* Lab Systems v5.0.2 - Fix lab/ path still buggy CDN cache - network-first for /lab/ + aggressive clear 2026-10-15 */
const CACHE_NAME = 'lab-systems-v5.0.2-premium-2026-10-15';
self.addEventListener('install', e=>{
  self.skipWaiting();
  console.log('SW v5.0.2 install - clearing all old caches');
});
self.addEventListener('activate', e=>{
  e.waitUntil(
    caches.keys().then(keys=>{
      console.log('Deleting all caches for v5.0.2', keys);
      return Promise.all(keys.map(k=>caches.delete(k)));
    })
    .then(()=>self.clients.claim())
    .then(()=>self.registration.unregister())
    .then(()=>console.log('SW v5.0.2 unregistered, all caches cleared - lab/ path will now be network-first'))
  );
});
self.addEventListener('fetch', e=>{
  const url = new URL(e.request.url);
  // Network-first for /lab/ and /lab/index.html to fix "those ending with lab are still buggy"
  if(url.pathname.includes('/lab') || url.pathname.endsWith('/') || e.request.mode==='navigate'){
    e.respondWith(
      fetch(e.request, {cache:'no-store'}).then(res=>{
        return res;
      }).catch(()=>{
        return caches.match(e.request).then(r=>r||fetch(e.request));
      })
    );
    return;
  }
  return;
});
