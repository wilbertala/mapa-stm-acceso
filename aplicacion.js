/* Solo acceso instalable. No trae datos ni secretos del mapa. */
'use strict';
(() => {
 const clave = 'mapa_stm_url_dispositivo_v2';
 const campo = document.getElementById('url');
 const estado = document.getElementById('estado');
 const btnInstalar = document.getElementById('instalar');
 let instalacion = null;
 function urlValida(valor) {
  try {
   const url = new URL(String(valor).trim());
   if (url.protocol !== 'https:' || url.hostname !== 'script.google.com') return null;
   if (!/^\/macros\/s\/AKfy[A-Za-z0-9_-]+\/exec$/.test(url.pathname)) return null;
   if (url.username || url.password || url.hash) return null;
   const llaves = Array.from(url.searchParams.keys());
   if (llaves.some(llave => llave !== 'invite') || llaves.filter(llave => llave === 'invite').length > 1) return null;
   const invite = url.searchParams.get('invite');
   if (invite !== null && !/^[a-f0-9]{64}$/.test(invite)) return null;
   return url.href;
  } catch { return null; }
 }
 function leer() {
  try { return localStorage.getItem(clave) || ''; } catch { return ''; }
 }
 function guardar(valor) {
  try { localStorage.setItem(clave, valor); return true; } catch { return false; }
 }
 function mensaje(texto, correcto = false) {
  estado.textContent = texto; estado.classList.toggle('ok', correcto);
 }
 function abrir(url) {
  const valido = urlValida(url);
  if (!valido) { mensaje('El enlace debe ser la dirección /exec de Mapa STM, con una invitación válida si corresponde.'); return; }
  // Sale del origen de la PWA para abrir el mapa real; no usa iframe ni comunica tokens a este servidor.
  window.location.assign(valido);
 }
 const guardado = leer();
 campo.value = guardado;
 if (guardado) mensaje('Enlace guardado en este dispositivo.', true);
 document.getElementById('guardar').addEventListener('click', () => {
  const url = urlValida(campo.value);
  if (!url) { mensaje('Revisá el enlace de Mapa STM; no es una dirección admitida.'); return; }
  if (!guardar(url)) { mensaje('No se pudo guardar. Revisá el almacenamiento del navegador.'); return; }
  abrir(url);
 });
 document.getElementById('abrir').addEventListener('click', () => abrir(leer()));
 document.getElementById('borrar').addEventListener('click', () => {
  try { localStorage.removeItem(clave); } catch {}
  campo.value = ''; mensaje('Se olvidó el enlace de este dispositivo.', true);
 });
 window.addEventListener('beforeinstallprompt', evento => {
  evento.preventDefault(); instalacion = evento; btnInstalar.hidden = false;
 });
 btnInstalar.addEventListener('click', async () => {
  if (!instalacion) return;
  const evento = instalacion; instalacion = null; btnInstalar.hidden = true;
  try { await evento.prompt(); await evento.userChoice; } catch { mensaje('Abrí el menú de Chrome y elegí Instalar aplicación.'); }
 });
 window.addEventListener('appinstalled', () => {
  btnInstalar.hidden = true; mensaje('Acceso instalado. Abrilo desde el ícono de Mapa STM.', true);
 });
 if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js', {scope: './'}).catch(() => {}); });
 }
 const params = new URLSearchParams(location.search);
 const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
 // En lanzamientos posteriores desde el ícono del escritorio, abrir directamente el mapa.
 // ?config=1 mantiene accesible esta pantalla para modificar el vínculo.
 if (standalone && guardado && !params.has('config')) {
  const url = urlValida(guardado);
  if (url) {
   mensaje('Abriendo Mapa STM…', true);
   window.location.replace(url);
  }
 }
})();
