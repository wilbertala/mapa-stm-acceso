/* Mapa STM en GitHub Pages: servidor propio, sin sesiones Apps Script ni Firebase. */
'use strict';
const byId=id=>document.getElementById(id);
const $notice=byId('notice'),$status=byId('status');
const config=window.STM_PUBLIC_CONFIG||{};
const CONFIGURED=typeof config.apiBase==='string'&&/^https:\/\/[^/]+$/.test(config.apiBase)&&!config.apiBase.includes('TU-WORKER');
let idToken='',invite='',routes=[],selected=[],focusedId='',layers=[],markers=[],map=null,loadId=0;
const palette=['#df4033','#116bc3','#00956a'];
const setMsg=text=>{$notice.textContent=text;$status.textContent=text;};
const query=new URLSearchParams(location.search);
const incoming=query.get('invite');
try{
 if(incoming!==null){
  if(/^[a-f0-9]{64}$/i.test(incoming)){sessionStorage.setItem('stm_invite',incoming);invite=incoming;}
  else{setMsg('El enlace de invitación tiene un formato incorrecto.');}
  query.delete('invite');const suffix=query.toString();
  history.replaceState(null,'',location.pathname+(suffix?'?'+suffix:''));
 }else{invite=sessionStorage.getItem('stm_invite')||'';}
}catch{invite=/^[a-f0-9]{64}$/i.test(incoming||'')?incoming:'';}
if(!/^[a-f0-9]{64}$/i.test(invite))invite='';
function getUrl(path){return new URL('/api'+path,config.apiBase).href;}
async function requestJSON(path){
 if(!CONFIGURED)throw Error('FALTA_CONFIGURAR_API');
 const headers={};
 if(idToken)headers.Authorization='Bearer '+idToken;
 else if(invite)headers['X-STM-Invite']=invite;
 const res=await fetch(getUrl(path),{headers,cache:'no-store',mode:'cors',credentials:'omit'});
 if(!res.ok)throw Error('HTTP_'+res.status);
 return res.json();
}
function setupLogin(){
 if(!config.googleClientId||config.googleClientId.includes('TU_CLIENT_ID')){
  byId('googleLogin').textContent='Acceso ADMINISTRADOR sin configurar';return;
 }
 let remaining=100;
 const check=()=>{
  if(window.google?.accounts?.id){
   google.accounts.id.initialize({client_id:config.googleClientId,callback:async result=>{
    if(typeof result.credential!=='string')return;
    idToken=result.credential;invite='';
    try{sessionStorage.removeItem('stm_invite');}catch{}
    byId('logout').hidden=false;
    await loadCatalog();
   },auto_select:false,ux_mode:'popup'});
   google.accounts.id.renderButton(byId('googleLogin'),{type:'standard',theme:'outline',size:'medium',text:'signin_with',shape:'rectangular'});
   return;
  }
  if(--remaining>0){setTimeout(check,100)}else{setMsg('No se pudo cargar el inicio de sesión de Google.');}
 };
 check();
}
setupLogin();
byId('logout').addEventListener('click',()=>{
 idToken='';routes=[];selected=[];focusedId='';byId('logout').hidden=true;
 try{google.accounts.id.disableAutoSelect();}catch{}
 draw();renderResults();setMsg('Sesión de ADMINISTRADOR cerrada.');
});
byId('toggle').onclick=()=>{
 const panel=byId('filtros'),hidden=panel.classList.toggle('oculto');
 byId('toggle').setAttribute('aria-expanded',String(!hidden));
 if(map)setTimeout(()=>map.invalidateSize(),60);
};
byId('center').onclick=()=>map?.setView([-34.75,-56.08],10);
byId('clear').onclick=()=>{selected=[];focusedId='';draw();renderResults();};
for(const name of ['buscar','empresa','tipo','sentido'])byId(name).addEventListener('input',renderResults);
function initMap(){
 if(!window.L){setMsg('La biblioteca de mapas no está disponible. Revisá la conexión a Internet.');return;}
 map=L.map('map').setView([-34.75,-56.08],10);
 L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap contributors',maxZoom:19}).addTo(map);
 if(window.innerWidth<680){byId('filtros').classList.add('oculto');byId('toggle').setAttribute('aria-expanded','false');}
 setTimeout(()=>map.invalidateSize(),150);
}
window.addEventListener('load',initMap,{once:true});
async function loadCatalog(){
 const seq=++loadId;
 try{
  setMsg('Cargando líneas autorizadas…');
  const data=await requestJSON('/catalogo');if(seq!==loadId)return;
  routes=Array.isArray(data.recorridos)?data.recorridos:[];
  selected=[];focusedId='';populate();renderResults();draw();
  setMsg(`${routes.length} recorridos disponibles. Las trazas históricas no certifican operación actual.`);
 }catch(e){if(seq===loadId)setMsg('Error al consultar los datos ('+e.message+').');}
}
function populate(){
 const companies=[...new Set(routes.map(r=>r.empresa).filter(Boolean))].sort();
 const directions=[...new Set(routes.map(r=>r.sentido).filter(Boolean))].sort();
 byId('empresa').replaceChildren(new Option('Todas las empresas',''),...companies.map(x=>new Option(x,x)));
 byId('sentido').replaceChildren(new Option('Todos los sentidos',''),...directions.map(x=>new Option(x,x)));
}
function renderResults(){
 const name=byId('buscar').value.trim().toLocaleLowerCase('es'),company=byId('empresa').value,
 type=byId('tipo').value,direction=byId('sentido').value;
 const found=routes.filter(r=>(!company||r.empresa===company)&&(!type||r.tipo===type)&&
 (!direction||r.sentido===direction)&&(!name||`${r.empresa} ${r.linea} ${r.destino} ${r.variante}`.toLocaleLowerCase('es').includes(name)));
 byId('count').textContent=`${found.length} recorridos`;
 const fragment=document.createDocumentFragment();
 for(const r of found.slice(0,150)){
  const btn=document.createElement('button');btn.type='button';btn.className='ruta';
  btn.setAttribute('aria-pressed',String(selected.some(x=>x.id===r.id)));
  if(focusedId===r.id)btn.classList.add('prioritario');
  const title=document.createElement('b');title.textContent=`${r.empresa} · ${r.linea}`;
  const detail=document.createElement('small');detail.textContent=`${r.destino||r.variante} · ${r.sentido||'Sin sentido'}`;
  btn.append(title,detail);btn.addEventListener('contextmenu',e=>e.preventDefault());
  let timer=null,longPressed=false;
  btn.addEventListener('pointerdown',ev=>{if(ev.pointerType==='mouse'&&ev.button!==0)return;
   longPressed=false;timer=setTimeout(async()=>{longPressed=true;
    if(!selected.some(x=>x.id===r.id))await choose(r);
    focusedId=focusedId===r.id?'':r.id;draw();renderResults();
   },460);
  });
  const cancel=()=>{if(timer!==null){clearTimeout(timer);timer=null;}};
  btn.addEventListener('pointerup',cancel);btn.addEventListener('pointercancel',cancel);
  btn.addEventListener('pointerleave',cancel);
  btn.addEventListener('click',e=>{if(longPressed){longPressed=false;e.preventDefault();return;}choose(r);});
  fragment.append(btn);
 }
 const root=byId('resultados');root.replaceChildren(fragment);
 if(found.length>150){const note=document.createElement('p');note.textContent='Se muestran los primeros 150 recorridos. Refiná el filtro.';root.append(note);}
}
async function choose(r){
 if(selected.some(x=>x.id===r.id)){selected=selected.filter(x=>x.id!==r.id);if(focusedId===r.id)focusedId='';}
 else{if(selected.length===3){const gone=selected.shift();if(focusedId===gone.id)focusedId='';}selected.push(r);}
 renderResults();draw();
 if(!selected.some(x=>x.id===r.id))return;
 try{
  const tasks=[requestJSON('/paradas?recorrido='+encodeURIComponent(r.id))];
  if(!r.geometria?.length&&r.id.startsWith('MTOP_KML:'))tasks.push(requestJSON('/trazado?recorrido='+encodeURIComponent(r.id)));
  const data=await Promise.all(tasks);
  if(selected.some(x=>x.id===r.id)){
   r._stops=Array.isArray(data[0].paradas)?data[0].paradas:[];
   if(data[1]?.geometria)r.geometria=data[1].geometria;
   draw();
  }
 }catch{byId('paradasEstado').textContent='No fue posible cargar paradas o trazados de este recorrido.';}
}
function draw(){
 if(!map)return;
 for(const layer of [...layers,...markers])map.removeLayer(layer);
 layers=[];markers=[];let bounds=[],stops=0;
 selected.forEach((r,index)=>{
  const color=palette[index],focused=!focusedId||focusedId===r.id;
  if(Array.isArray(r.geometria)&&r.geometria.length>1){
   const line=L.polyline(r.geometria,{color,weight:focused?8:3,opacity:focused?1:.32}).addTo(map);
   const description=document.createElement('span');description.textContent=`${r.empresa} · ${r.linea} — referencia histórica o candidata`;
   line.bindPopup(description);layers.push(line);if(focused)bounds.push(...r.geometria);
  }
  for(const p of r._stops||[]){
   const marker=L.circleMarker([p.lat,p.lon],{radius:focused?5:3,weight:1.5,color,fillColor:'#fff',fillOpacity:focused?.95:.45}).addTo(map);
   const label=document.createElement('span');label.textContent=`${p.orden}. ${p.nombre}`;
   marker.bindPopup(label);markers.push(marker);stops++;
  }
 });
 if(bounds.length)map.fitBounds(bounds,{padding:[20,20],maxZoom:13});
 byId('leyenda').textContent=selected.length?selected.map((r,i)=>`${i+1}. ${r.empresa} ${r.linea}${r.id===focusedId?' ★':''}`).join(' | '):'Elegí hasta tres recorridos; mantené pulsado para destacar uno.';
 byId('paradasEstado').textContent=`${selected.length} recorridos seleccionados · ${stops} paradas con coordenadas`;
}
if(!CONFIGURED)setMsg('Versión de desarrollo: falta conectar el servidor Cloudflare Workers.');
else if(invite)loadCatalog();
else setMsg('Ingresá con cuenta autorizada o un enlace de INVITADOS.');

// La nueva versión solo limpia caches obsoletas. Nunca almacena la API ni el token.
if ('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js',{scope:'./'}).catch(()=>{}),{once:true});
