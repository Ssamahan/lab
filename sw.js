/* Ruli Lab Systems v4 - Service Worker - offline-first + live Firebase fallback */
const CACHE_NAME = 'ruli-lab-v4-2026-09-13';
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
  './assets/rwanda-coat-hd.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS).catch((err) => {
        console.warn('SW cache addAll failed', err.message);
        // Try individual
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
  // For Firebase and EmailJS and Google APIs, go network only
  if(url.hostname.includes('firebase') || url.hostname.includes('emailjs') || url.hostname.includes('googleapis') || url.hostname.includes('qrserver') || url.hostname.includes('gstatic')){
    return; // network only
  }
  // For index.html and assets, cache-first with network fallback
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if(cached) return cached;
      return fetch(e.request).then((res) => {
        // Cache successful GETs
        if(e.request.method==='GET' && res.ok){
          const clone=res.clone();
          caches.open(CACHE_NAME).then(c=>c.put(e.request, clone)).catch(()=>{});
        }
        return res;
      }).catch(()=>cached);
    })
  );
});
