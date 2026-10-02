/* Lab Systems v4.26 - Retained - Fast load */
const CACHE_NAME = 'lab-systems-v4.26-retained-2026-10-02';
const ASSETS = ['./','./index.html','./manifest.json'];
self.addEventListener('install', e=>{ e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(ASSETS).catch(()=>{})).then(()=>self.skipWaiting())); });
self.addEventListener('activate', e=>{ e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim())); });
self.addEventListener('fetch', e=>{
  const url=new URL(e.request.url);
  if(url.hostname.includes('firebase')||url.hostname.includes('emailjs')||url.hostname.includes('googleapis')||url.hostname.includes('qrserver')||url.hostname.includes('gstatic')) return;
  if(url.pathname.endsWith('/')||url.pathname.endsWith('/index.html')||url.pathname.includes('/lab')){
    e.respondWith(fetch(e.request).then(res=>{ if(res.ok){ const cl=res.clone(); caches.open(CACHE_NAME).then(c=>c.put(e.request,cl)).catch(()=>{}); } return res; }).catch(()=>caches.match(e.request)));
    return;
  }
  e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request).then(res=>{ if(res.ok){ const cl=res.clone(); caches.open(CACHE_NAME).then(c=>c.put(e.request,cl)).catch(()=>{}); } return res; }).catch(()=>cached)));
});
