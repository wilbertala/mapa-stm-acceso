/* Solo recursos propios públicos de esta PWA. No interceptar Apps Script ni guardar tokens. */
'use strict';
const CACHE = 'stm-acceso-shell-v2';
const FILES = ['./','./index.html','./estilos.css','./aplicacion.js','./manifest.json','./icon-192.png','./icon-512.png','./icon-maskable-512.png','./apple-touch-icon.png'];
self.addEventListener('install', evento => {
 evento.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', evento => {
 evento.waitUntil(caches.keys().then(llaves => Promise.all(llaves.filter(k => k.startsWith('stm-acceso-shell-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', evento => {
 const req = evento.request;
 if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
 evento.respondWith(fetch(req).then(res => {
   if (res.ok && res.type === 'basic') {
    const copia = res.clone();
    evento.waitUntil(caches.open(CACHE).then(cache => cache.put(req, copia)));
   }
   return res;
 }).catch(() => caches.match(req).then(r => r || caches.match('./index.html'))));
});
