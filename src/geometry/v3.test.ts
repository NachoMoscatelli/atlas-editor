import { describe,it,expect } from 'vitest';
import type { MapProject } from '../model/types';
import { divideArea,mergeAreas,neighbors,nearestBoundary } from './areas';
import { area,validGeometry } from './topology';
import { parseProject,serializeProject } from '../io/project';
import { generate } from './generate';
function square():MapProject{return {version:3,groups:[],title:'Prueba',width:100,height:100,generation:{count:4,seed:'test',irregularity:0,segments:1},vertices:{a:{x:0,y:0},b:{x:100,y:0},c:{x:100,y:100},d:{x:0,y:100}},territories:[{id:'t0',name:'Origen',surface:'land',regionId:'t0',color:'#b5cbb0',vertices:['a','b','c','d'],label:{x:50,y:50}}]};}
const total=(p:MapProject)=>p.territories.reduce((n,t)=>n+area(t.vertices.map(id=>p.vertices[id])),0);
describe('dividir y fusionar',()=>{
  it('divide una línea de borde a borde y conserva cobertura, propiedades y entrada inmutable',()=>{
    const p=square(),before=serializeProject(p),{project:next,newId}=divideArea(p,'t0',{x:50,y:0},{x:50,y:100});
    expect(serializeProject(p)).toBe(before);expect(next.territories).toHaveLength(2);expect(total(next)).toBe(10000);expect(validGeometry(next)).toBe(true);
    expect(next.territories.find(t=>t.id===newId)?.regionId).toBe(next.territories[0].regionId);
    expect(next.groups[0]).toMatchObject({name:p.territories[0].name,color:p.territories[0].color});
    expect(neighbors(next,'t0').map(t=>t.id)).toEqual([newId]);expect(parseProject(serializeProject(next))).toEqual(next);
  });
  it('inserta los extremos nuevos también en el vecino de una frontera compartida',()=>{
    const initial=divideArea(square(),'t0',{x:50,y:0},{x:50,y:100});
    const next=divideArea(initial.project,'t0',{x:50,y:50},{x:100,y:50}).project;
    const shared=Object.entries(next.vertices).find(([,v])=>v.x===50&&v.y===50)![0];
    expect(next.territories.filter(t=>t.vertices.includes(shared))).toHaveLength(3);
    expect(total(next)).toBe(10000);expect(parseProject(serializeProject(next))).toEqual(next);
  });
  it('corta entre vértices existentes sin duplicarlos',()=>{
    const next=divideArea(square(),'t0',{x:0,y:0},{x:100,y:100}).project;
    expect(Object.keys(next.vertices)).toHaveLength(4);expect(parseProject(serializeProject(next))).toEqual(next);
  });
  it('rechaza puntos internos, coincidentes y cortes que solo siguen el borde',()=>{
    expect(()=>divideArea(square(),'t0',{x:50,y:50},{x:50,y:100})).toThrow('borde');
    expect(()=>divideArea(square(),'t0',{x:0,y:0},{x:0,y:0})).toThrow('distintos');
    expect(()=>divideArea(square(),'t0',{x:10,y:0},{x:90,y:0})).toThrow('interior');
  });
  it('rechaza líneas que salen de un área cóncava',()=>{
    const p=square();p.vertices={a:{x:0,y:0},b:{x:100,y:0},c:{x:100,y:30},d:{x:30,y:30},e:{x:30,y:100},f:{x:0,y:100}};p.territories[0].vertices=['a','b','c','d','e','f'];
    expect(()=>divideArea(p,'t0',{x:80,y:30},{x:30,y:80})).toThrow();
  });
  it('mantiene libres ambas partes de un área de agua sin región',()=>{
    const p=square();p.territories[0].surface='water';p.territories[0].regionId=null;
    const next=divideArea(p,'t0',{x:50,y:0},{x:50,y:100}).project;
    expect(next.territories.every(t=>t.surface==='water'&&t.regionId===null)).toBe(true);
  });
  it('fusiona las partes, elimina nodos sin uso y conserva propiedades del área principal',()=>{
    const split=divideArea(square(),'t0',{x:50,y:0},{x:50,y:100});
    const next=mergeAreas(split.project,'t0',split.newId);
    expect(next.territories).toHaveLength(1);expect(next.territories[0]).toMatchObject({id:'t0',name:'Origen',color:'#b5cbb0',surface:'land',regionId:split.project.territories[0].regionId});
    expect(total(next)).toBe(10000);expect(parseProject(serializeProject(next))).toEqual(next);
    expect(Object.keys(next.vertices).every(id=>next.territories.some(t=>t.vertices.includes(id)))).toBe(true);
  });
  it('requiere aristas compartidas: tocarse en un punto no basta',()=>{
    const first=divideArea(square(),'t0',{x:50,y:0},{x:50,y:100});
    const second=divideArea(first.project,'t0',{x:50,y:50},{x:100,y:50});
    const third=divideArea(second.project,first.newId,{x:0,y:50},{x:50,y:50});
    const diagonal=third.project.territories.find(t=>t.label.x<50&&t.label.y>50)!;
    const opposite=third.project.territories.find(t=>t.label.x>50&&t.label.y<50)!;
    expect(()=>mergeAreas(third.project,diagonal.id,opposite.id)).toThrow('arista');
  });
  it('rechaza una unión que encerraría otra área en un hueco',()=>{
    const p=square();p.vertices={a:{x:0,y:0},b:{x:50,y:0},c:{x:100,y:0},d:{x:100,y:100},e:{x:50,y:100},f:{x:0,y:100},g:{x:30,y:30},h:{x:50,y:30},i:{x:70,y:30},j:{x:70,y:70},k:{x:50,y:70},l:{x:30,y:70}};
    const original=p.territories[0];p.territories=[{...original,vertices:['a','b','h','g','l','k','e','f']},{...original,id:'t1',regionId:'t1',vertices:['b','c','d','e','k','j','i','h']},{...original,id:'t2',regionId:'t2',vertices:['g','h','i','j','k','l']}];
    expect(parseProject(serializeProject(p))).toEqual(p);
    expect(()=>mergeAreas(p,'t0','t1')).toThrow('hueco');
  });
  it('mantiene las propiedades del área principal aunque el vecino sea agua libre',()=>{
    const split=divideArea(square(),'t0',{x:50,y:0},{x:50,y:100});
    const water=split.project.territories.find(t=>t.id===split.newId)!;water.surface='water';water.regionId=null;water.color='#b1cdd1';
    expect(mergeAreas(split.project,'t0',split.newId).territories[0]).toMatchObject({surface:'land',regionId:split.project.territories[0].regionId,color:'#b5cbb0'});
    expect(mergeAreas(split.project,split.newId,'t0').territories[0]).toMatchObject({surface:'water',regionId:null,color:'#b1cdd1'});
  });
  for(const seed of ['atlas','otra','v3'])it(`fusiona vecinos procedurales sin huecos: ${seed}`,()=>{
    let p=generate({count:12,seed,irregularity:1,segments:4});
    for(let i=0;i<4;i++){const main=p.territories[0],other=neighbors(p,main.id)[0];p=mergeAreas(p,main.id,other.id);expect(parseProject(serializeProject(p))).toEqual(p);}
    expect(p.territories).toHaveLength(8);expect(total(p)).toBeCloseTo(700000,3);
  });
  it('respeta el límite de áreas y calcula un ajuste al borde',()=>{
    const p=generate({count:120,seed:'limit',irregularity:0,segments:1}),t=p.territories[0];
    const a=p.vertices[t.vertices[0]],b=p.vertices[t.vertices[2]];
    expect(()=>divideArea(p,t.id,a,b)).toThrow('límite');
    expect(nearestBoundary(square(),square().territories[0],{x:40,y:3})).toMatchObject({point:{x:40,y:0},distance:3});
  });
});
