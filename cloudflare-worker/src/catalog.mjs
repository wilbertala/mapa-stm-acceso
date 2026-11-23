/* Conversion conservadora de los datos historicos STM a respuestas publicables solo tras autenticacion. */
export const TYPES = new Set(['suburbano_metropolitano','departamental_canelones','regional_san_jose']);
export function validPoint(p){return Array.isArray(p)&&p.length>=2&&Number.isFinite(+p[0])&&Number.isFinite(+p[1])&&+p[0]>=-36&&+p[0]<=-29&&+p[1]>=-59&&+p[1]<=-52;}
export function safeGeometry(raw,max=5500){if(!Array.isArray(raw))return [];return raw.filter(validPoint).slice(0,max).map(p=>[+p[0],+p[1]]);}
export function safeRoute(r){
 if(!r||typeof r!=='object'||!TYPES.has(r.tipo))return null;
 const clean=(v,max=250)=>String(v??'').slice(0,max);
 const id=clean(r.id,200); if(!id)return null;
 return {id,empresa:clean(r.empresa,100),linea:clean(r.linea,100),variante:clean(r.variante),sentido:clean(r.sentido,80),destino:clean(r.destino),tipo:r.tipo,fuente:clean(r.fuente,500),vigencia:clean(r.vigencia,350),validacion:clean(r.validacion,200),cantidadParadas:Math.min(700,Math.max(0,Number(r.cantidadParadas)||0)),geometria:safeGeometry(r.geometria)};
}
export function makeCatalog(indice,v023){
 if(indice?.formato!=='STM_INDICE_V09'||!Array.isArray(indice?.recorridos)||indice.recorridos.length<1000)throw Error('INDICE_INCOMPLETO');
 if(!Array.isArray(v023?.recorridos)||v023.recorridos.length<70)throw Error('V023_INCOMPLETO');
 const out=[],keys=new Set();
 for(const raw of [...indice.recorridos,...v023.recorridos]){
  const r=safeRoute(raw);if(!r||keys.has(r.id))continue;
  keys.add(r.id);out.push(r);
 }
 return out;
}
export function stopsByRoute(index,id,limit=700){
 const raw=index?.paradas; if(!raw||typeof raw!=='object')return [];
 let out=[];
 for(const [key,p] of Object.entries(raw)){
  const variant=Array.isArray(p.variantes)?p.variantes.find(v=>String(v.id)===id):null;
  if(!variant||!Number.isFinite(Number(p.lat))||!Number.isFinite(Number(p.lon)))continue;
  const point=[Number(p.lat),Number(p.lon)];if(!validPoint(point))continue;
  out.push({codigo:String(p.codigo??key).slice(0,30),nombre:String(p.nombre??'Parada').slice(0,130),lat:point[0],lon:point[1],orden:Number(variant.orden)||0});
 }
 out.sort((a,b)=>a.orden-b.orden||a.codigo.localeCompare(b.codigo));
 return out.slice(0,limit);
}
