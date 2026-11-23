import test from 'node:test';import assert from 'node:assert/strict';
import {handle} from '../src/index.mjs';
import mtopIndex from '../src/mtop-index.json' with {type:'json'};
const env={FRONTEND_ORIGIN:'https://wilbertala.github.io',STM_INVITE_SHA256:'a'.repeat(64),GOOGLE_SERVICE_ACCOUNT_JSON:'{}',DRIVE_FOLDER_ID:'1-1P1txzOJcYEC1qnSUzISti7ADmElo44'};
function request(path,origin='https://wilbertala.github.io',method='GET'){
 return new Request('https://api.workers.dev/api/'+path,{method,headers:{Origin:origin}});
}
const sample={id:'MTOP_KML:5:2',empresa:'COPSA',linea:'1A',tipo:'suburbano_metropolitano',geometria:[]};
const index={formato:'STM_INDICE_V09',recorridos:Array.from({length:1000},(_,i)=>({...sample,id:`R${i}`}))};
const dept={recorridos:Array.from({length:84},(_,i)=>({...sample,id:`V${i}`,tipo:'departamental_canelones'}))};
const load=async (env,name)=> name==='recorridos_indice_v09.json'?index:name==='RECONSTRUCCION_CANELONES_V023_R11.json'?dept:{paradas:{}};
test('sin autorización no entrega rutas',async()=>{
 const r=await handle(request('catalogo'),env,{auth:async()=>null,load});
 assert.equal(r.status,401);assert.ok(!(await r.text()).includes('recorridos'));
});
test('origen externo bloqueado incluso con credencial',async()=>{
 const r=await handle(request('catalogo','https://fuera.example'),env,{auth:async()=> 'admin',load});assert.equal(r.status,403);
});
test('POST no puede escribir',async()=>{
 const r=await handle(request('catalogo','https://wilbertala.github.io','POST'),env,{auth:async()=> 'admin',load});assert.equal(r.status,405);
});
test('INVITADOS solo recibe catálogo permitido',async()=>{
 const r=await handle(request('catalogo'),env,{auth:async()=> 'guest',load});assert.equal(r.status,200);
 const b=await r.json();assert.equal(b.modo,'guest');assert.equal(b.recorridos.length,1084);
});
test('recorrido desconocido no dispara lectura de paradas',async()=>{
 let calls=0;
 const loader=async (env,name)=>{calls++;return load(env,name);};
 const r=await handle(request('paradas?recorrido=NO_EXISTE'),env,{auth:async()=> 'admin',load:loader});assert.equal(r.status,404);assert.equal(calls,2);
});
test('salud libre de datos operativos',async()=>{
 const r=await handle(request('health'),env,{auth:async()=>null,load});assert.equal(r.status,200);
 const j=await r.json();assert.equal(j.datos,'protegidos');assert.equal('recorridos' in j,false);
});
