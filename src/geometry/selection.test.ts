import { describe,it,expect } from 'vitest';
import type { MapProject } from '../model/types';
import { selectionBoundary,selectionPath,pointInPolygon,areasInLasso,addSelection,lassoHasArea } from './selection';
import { edgeKey } from './topology';
function grid(n=2):MapProject {
  const p:MapProject={version:3,groups:[],title:'Grilla',width:n*100,height:n*100,generation:{count:4,seed:'x',irregularity:0,segments:1},vertices:{},territories:[]};
  for(let y=0;y<=n;y++)for(let x=0;x<=n;x++)p.vertices[`v${x}_${y}`]={x:x*100,y:y*100};
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){const id=`t${y*n+x}`;p.territories.push({id,name:id,color:'#b5cbb0',surface:'land',regionId:id,vertices:[`v${x}_${y}`,`v${x+1}_${y}`,`v${x+1}_${y+1}`,`v${x}_${y+1}`],label:{x:9999,y:9999}});}
  return p;
}
describe('contorno combinado y lazo',()=>{
  it('excluye la frontera interna de dos áreas contiguas',()=>{
    const p=grid(),boundary=selectionBoundary(p,['t0','t1']);expect(boundary).toHaveLength(6);
    expect(boundary.map(([a,b])=>edgeKey(a,b))).not.toContain(edgeKey('v1_0','v1_1'));
    expect(selectionPath(p,['t0','t1'])).not.toBe('');
  });
  it('soporta componentes separadas, huecos y una selección vacía sin fusionar',()=>{
    const p=grid(3),before=JSON.stringify(p);
    expect(selectionBoundary(p,['t0','t8'])).toHaveLength(8);
    expect(selectionBoundary(p,p.territories.filter(t=>t.id!=='t4').map(t=>t.id))).toHaveLength(16);
    expect(selectionPath(p,[])).toBe('');expect(JSON.stringify(p)).toBe(before);
  });
  it('al seleccionar todo solo resalta el borde exterior de la hoja',()=>{
    const p=grid();expect(selectionBoundary(p,p.territories.map(t=>t.id))).toHaveLength(8);
    expect(selectionBoundary(p,p.territories.map(t=>t.id)).every(([a,b])=>{const A=p.vertices[a],B=p.vertices[b];return (A.x===B.x&&(A.x===0||A.x===200))||(A.y===B.y&&(A.y===0||A.y===200));})).toBe(true);
  });
  it('cierra el recorrido y selecciona por geometría, aunque las etiquetas estén fuera',()=>{
    const p=grid(),lasso=[{x:-1,y:-1},{x:201,y:-1},{x:201,y:99},{x:-1,y:99}];
    expect(areasInLasso(p,lasso)).toEqual(['t0','t1']);
  });
  it('respeta un lazo cóncavo y agrega a la selección previa sin duplicados',()=>{
    const ids=areasInLasso(grid(),[{x:0,y:0},{x:200,y:0},{x:200,y:80},{x:80,y:80},{x:80,y:200},{x:0,y:200}]);
    expect(ids).toEqual(['t0','t1','t2']);expect(addSelection(['t3','t0'],ids)).toEqual(['t3','t0','t1','t2']);
  });
  it('ignora clics, puntos repetidos y trazos fuera del mapa sin quitar la selección',()=>{
    const p=grid();for(const points of [[],[{x:10,y:10}],[{x:10,y:10},{x:10,y:10}],[{x:-100,y:-100},{x:-90,y:-100},{x:-90,y:-90}]])expect(areasInLasso(p,points)).toEqual([]);
    expect(addSelection(['t0'],[])).toEqual(['t0']);
  });
  it('incluye centros sobre el borde y permite trazos que se cruzan con regla par-impar',()=>{
    const polygon=[{x:0,y:0},{x:200,y:200},{x:0,y:200},{x:200,y:0}];
    expect(lassoHasArea(polygon)).toBe(true);expect(pointInPolygon({x:100,y:50},polygon)).toBe(true);expect(pointInPolygon({x:20,y:100},polygon)).toBe(false);
    expect(pointInPolygon({x:100,y:100},polygon)).toBe(true);
  });
  it('respeta la forma real de un área cóncava sin usar su centro',()=>{
    const p=grid();p.vertices={a:{x:0,y:0},b:{x:200,y:0},c:{x:200,y:20},d:{x:20,y:20},e:{x:20,y:200},f:{x:0,y:200}};
    p.territories=[{...p.territories[0],vertices:['a','b','c','d','e','f']}];
    expect(areasInLasso(p,[{x:80,y:80},{x:90,y:80},{x:90,y:90}])).toEqual([]);
    expect(areasInLasso(p,[{x:180,y:5},{x:190,y:5},{x:190,y:10}])).toEqual(['t0']);
  });
  it('selecciona al rozar una franja que no contiene el centro del área',()=>{
    expect(areasInLasso(grid(),[{x:98,y:10},{x:99,y:10},{x:99,y:20},{x:98,y:20}])).toEqual(['t0']);
  });
  it('selecciona todas las áreas atravesadas por un trazo recto entre muestras lejanas',()=>{
    expect(areasInLasso(grid(),[{x:-10,y:5},{x:210,y:5}])).toEqual(['t0','t1']);
  });
  it('incluye áreas por contacto con el borde o una esquina',()=>{
    expect(areasInLasso(grid(),[{x:100,y:10},{x:100,y:90}])).toEqual(['t0','t1']);
    expect(areasInLasso(grid(),[{x:-10,y:-10},{x:0,y:0}])).toEqual(['t0']);
  });
  it('incluye áreas enteramente encerradas aunque el trazo no las atraviese',()=>{
    expect(areasInLasso(grid(),[{x:-10,y:-10},{x:210,y:-10},{x:210,y:210},{x:-10,y:210}])).toEqual(['t0','t1','t2','t3']);
  });
  it('incluye el área que contiene completamente un lazo pequeño',()=>{
    expect(areasInLasso(grid(),[{x:5,y:5},{x:10,y:5},{x:10,y:10}])).toEqual(['t0']);
  });
  it('no selecciona por cercanía si no existe contacto ni modifica la geometría',()=>{
    const p=grid(),before=JSON.stringify(p);
    expect(areasInLasso(p,[{x:-10,y:-1},{x:210,y:-1}])).toEqual([]);expect(JSON.stringify(p)).toBe(before);
  });
});
