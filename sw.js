/* Lab Systems v5.3.1 PREMIUM EXACT - Fix lab/ path still buggy CDN cache, no giant icons - Self-unregister all + network-first + clear all 2026-10-20 */
const CACHE_NAME = 'lab-systems-v5.3.1-premium-exact-2026-10-20';
self.addEventListener('install', e=>{
  self.skipWaiting();
  console.log('SW v5.3.1 install - clearing all caches for lab/ path fix');
});
self.addEventListener('activate', e=>{
  e.waitUntil(
    caches.keys().then(keys=>{
      console.log('SW v5.3.1 deleting all caches', keys);
      return Promise.all(keys.map(k=>caches.delete(k)));
    })
    .then(()=>self.clients.claim())
    .then(()=>self.registration.unregister())
    .then(()=>console.log('SW v5.3.1 unregistered - lab/ path now network-first'))
  );
});
self.addEventListener('fetch', e=>{
  const url=new URL(e.request.url);
  if(url.pathname.includes('/lab') || e.request.mode==='navigate'){
    e.respondWith(fetch(e.request, {cache:'no-store'}).then(r=>r).catch(()=>caches.match(e.request)));
  }
});
