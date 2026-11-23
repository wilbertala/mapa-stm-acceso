import {authorize,corsHeaders} from './auth.mjs';
import {loadDriveJson} from './drive.mjs';
import {makeCatalog,stopsByRoute,safeGeometry} from './catalog.mjs';
import mtopIndex from './mtop-index.json' with {type:'json'};
const INDEX='recorridos_indice_v09.json';
const V023='RECONSTRUCCION_CANELONES_V023_R11.json';
const STOP='paradas_stm_indice.json.gz';
const security={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',
 'Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'"};
function reply(request,env,body,status=200){const origin=corsHeaders(request,env)||{};return new Response(JSON.stringify(body),{status,headers:{...security,...origin,'Content-Type':'application/json; charset=utf-8'}});}
function allowedId(s){return typeof s==='string'&&/^[A-Za-z0-9_:.-]{1,200}$/.test(s);}
async function isKnown(env,id,loader){
 const [a,b]=await Promise.all([loader(env,INDEX),loader(env,V023)]);
 const list=makeCatalog(a,b);
 return list.some(r=>r.id===id);
}
export async function handle(request,env,{load=loadDriveJson,auth=authorize}={}){
 const url=new URL(request.url),pathname=url.pathname;
 if(!pathname.startsWith('/api/'))return reply(request,env,{error:'NO_ENCONTRADO'},404);
 const hasOrigin=request.headers.has('origin');
 if(hasOrigin&&!corsHeaders(request,env))return reply(request,env,{error:'ORIGEN_NO_AUTORIZADO'},403);
 if(request.method==='OPTIONS'){
  const headers=corsHeaders(request,env);
  if(!headers)return reply(request,env,{error:'ORIGEN_NO_AUTORIZADO'},403);
  return new Response(null,{status:204,headers:{...headers,...security}});
 }
 if(request.method!=='GET')return reply(request,env,{error:'SOLO_LECTURA'},405);
 if(pathname==='/api/health')return reply(request,env,{estado:'activo',version:'stm-cf-candidato-r1',datos:'protegidos'});
 if(!env.STM_INVITE_SHA256||!env.GOOGLE_SERVICE_ACCOUNT_JSON||!env.DRIVE_FOLDER_ID) return reply(request,env,{error:'SERVICIO_NO_CONFIGURADO'},503);
 const role=await auth(request,env);if(!role)return reply(request,env,{error:'ACCESO_RESTRINGIDO'},401);
 try{
  if(pathname==='/api/catalogo'){
   const [a,b]=await Promise.all([load(env,INDEX),load(env,V023)]);
   const routes=makeCatalog(a,b);
   return reply(request,env,{modo:role,recorridos:routes,advertencia:'Rutas históricas y candidatas; operación actual no certificada'});
  }
  if(pathname==='/api/paradas'){
   const id=url.searchParams.get('recorrido');
   if(!allowedId(id))return reply(request,env,{error:'RECORRIDO_INVALIDO'},400);
   if(!await isKnown(env,id,load))return reply(request,env,{error:'RECORRIDO_DESCONOCIDO'},404);
   const p=await load(env,STOP);
   return reply(request,env,{paradas:stopsByRoute(p,id)});
  }
  if(pathname==='/api/trazado'){
   const id=url.searchParams.get('recorrido');
   if(!allowedId(id))return reply(request,env,{error:'RECORRIDO_INVALIDO'},400);
   if(!await isKnown(env,id,load))return reply(request,env,{error:'RECORRIDO_DESCONOCIDO'},404);
   const shard=mtopIndex[id];
   if(!Number.isInteger(shard))return reply(request,env,{geometria:[],estado:'SIN_TRAZA_MTOP'});
   const file=`geometrias_mtop_v017_${String(shard).padStart(2,'0')}.json.gz`;
   const data=await load(env,file);
   if(data.formato!=='STM_MTOP_SHARD_V017'||Number(data.particion)!==shard)throw Error('PARTICION_INCORRECTA');
   const r=data.recorridos?.find(x=>x.id===id);
   if(!r)throw Error('RECORRIDO_NO_COINCIDE_CON_INDICE');
   return reply(request,env,{geometria:safeGeometry(r.geometria),origen:'MTOP KML histórico',validacion:'No acredita vigencia operativa'});
  }
  return reply(request,env,{error:'NO_ENCONTRADO'},404);
 }catch(e){console.error('STM_API_ERROR',e.message);return reply(request,env,{error:'DATOS_NO_DISPONIBLES'},503);}
}
export default {fetch:handle};
