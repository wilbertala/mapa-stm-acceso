import test from 'node:test';import assert from 'node:assert/strict';
import {makeCatalog,safeGeometry,stopsByRoute} from '../src/catalog.mjs';
import mtopIndex from '../src/mtop-index.json' with {type:'json'};
const route={id:'MTOP_KML:5:2',empresa:'COPSA',linea:'1A',tipo:'suburbano_metropolitano',geometria:[]};
const indice={formato:'STM_INDICE_V09',recorridos:Array.from({length:1000},(_,i)=>({...route,id:`R${i}`}))};
const v023={recorridos:Array.from({length:84},(_,i)=>({...route,id:`V${i}`,tipo:'departamental_canelones'}))};
test('catálogo elimina urbanos y conserva departamentales',()=>{
 indice.recorridos[0]={...indice.recorridos[0],tipo:'urbano'};
 const result=makeCatalog(indice,v023);
 assert.equal(result.length,1083);
 assert.ok(!result.some(r=>r.tipo==='urbano'));
});
test('rutas: rechazo de coordenadas fuera de Uruguay',()=>{
 assert.deepEqual(safeGeometry([[-34.5,-56.1],[-91,0],['-34.6','-56.2']]),[[-34.5,-56.1],[-34.6,-56.2]]);
});
test('paradas: se ordenan y no se inventan',()=>{
 const data={paradas:{x:{nombre:'Dos',lat:-34.5,lon:-56.1,variantes:[{id:'R5',orden:2}]},y:{nombre:'Uno',lat:-34.4,lon:-56.2,variantes:[{id:'R5',orden:1}]}}};
 assert.deepEqual(stopsByRoute(data,'R5').map(x=>x.nombre),['Uno','Dos']);
 assert.deepEqual(stopsByRoute(data,'R10000'),[]);
});
test('índice de geometrías MTOP cubre las 837 entradas del manifiesto',()=>{
 assert.equal(Object.keys(mtopIndex).length,837);
 assert.equal(new Set(Object.values(mtopIndex)).size,16);
 assert.ok(Object.values(mtopIndex).every(n=>Number.isInteger(n)&&n>=0&&n<=15));
});
