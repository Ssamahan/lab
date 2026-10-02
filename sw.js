/* Lab Systems v4.17 - Fix manifest headings alignment middle with logos, Republic of Rwanda centered below logos, ID barcode Generated same line centered, remove extra lines, footer margin */
const CACHE_NAME = 'lab-systems-v4.26-retained-2026-10-02';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './assets/favicon.ico',
  './assets/favicon-16.png',
  './assets/favicon-32.png',
  './assets/favicon-192.png',
  './assets/favicon-512.png',
  './assets/logo-square.png',
  './assets/logo-transparent.png',
  './assets/rwanda-coat-hd.png',
  './assets/rwanda-coat-128.png',
  './assets/rwanda-coat-192.png',
  './assets/rwanda-coat-512.png',
  './assets/ruli-hospital-128.png',
  './assets/ruli-hospital-192.png',
  './assets/ruli-hospital-512.png',
  './assets/rwanda-coat-128.jpg',
  './assets/ruli-hospital-128.jpg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS).catch((err) => {
        console.warn('SW cache addAll failed', err.message);
        return Promise.allSettled(ASSETS.map(u => cache.add(u).catch(()=>{})));
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.filter(k => k!==CACHE_NAME).map(k => caches.delete(k)));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if(url.hostname.includes('firebase') || url.hostname.includes('emailjs') || url.hostname.includes('googleapis') || url.hostname.includes('qrserver') || url.hostname.includes('gstatic')){
    return;
  }
  // Network-first for index.html to ensure user always sees latest version (fix no changes)
  if(url.pathname.endsWith('/') || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/lab/') || url.pathname.endsWith('/lab')){
    e.respondWith(
      fetch(e.request).then(res=>{
        if(res.ok){
          const clone=res.clone();
          caches.open(CACHE_NAME).then(c=>c.put(e.request, clone)).catch(()=>{});
        }
        return res;
      }).catch(()=>caches.match(e.request))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if(cached) return cached;
      return fetch(e.request).then((res) => {
        if(e.request.method==='GET' && res.ok){
          const clone=res.clone();
          caches.open(CACHE_NAME).then(c=>c.put(e.request, clone)).catch(()=>{});
        }
        return res;
      }).catch(()=>cached);
    })
  );
});
