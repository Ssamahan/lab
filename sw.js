/* Lab Systems v5.3.1 PREMIUM EXACT - Fix v4.34.0 cache, time-based greeting, dark mode premium - Self-unregister + cache bust 2026-10-20 */
const CACHE_NAME = 'lab-systems-v5.3.1-premium-exact-2026-10-20';
self.addEventListener('install', e=>{
  self.skipWaiting();
  console.log('SW v5.3.1 install - clearing all caches for lab/ path fix v4.34.0');
});
self.addEventListener('activate', e=>{
  e.waitUntil(
    caches.keys().then(keys=>{
      console.log('SW v5.1.7 deleting', keys);
      return Promise.all(keys.map(k=>caches.delete(k)));
    })
    .then(()=>self.clients.claim())
    .then(()=>self.registration.unregister())
    .then(()=>console.log('SW v5.1.7 unregistered - lab/ path now network-first, version v5.3.1'))
  );
});
self.addEventListener('fetch', e=>{
  const url=new URL(e.request.url);
  if(url.pathname.includes('/lab') || e.request.mode==='navigate'){
    e.respondWith(fetch(e.request, {cache:'no-store', cacheControl:'no-cache'}).then(r=>r).catch(()=>caches.match(e.request)));
  }
});
