/* Mapa STM R1: reemplaza SW del lanzador sin cachear datos ni invitaciones. */
'use strict';
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{
  const names=await caches.keys();
  await Promise.all(names.filter(n=>n.startsWith('stm-acceso-shell-')||n.startsWith('stm-mapa-')).map(n=>caches.delete(n)));
  await self.clients.claim();
 })());
});
// Sin listener fetch: no interceptar respuestas privadas ni servir HTML antiguo.
