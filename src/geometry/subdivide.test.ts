import {describe,it,expect} from 'vitest';
import {subdivideArea} from './subdivide';
import {generate} from './generate';
import {area,distanceToSegment,edges} from './topology';
import {parseProject,serializeProject} from '../io/project';
import {groupAreas} from '../model/groups';
import {mergeSelection} from './areas';
import type {MapProject} from '../model/types';
const make=()=>generate({count:12,seed:'subdivision',irregularity:1,segments:3});
describe('dividir un área en N partes',()=>{
  for(const count of [2,3,5,10])it(`crea exactamente ${count} partes y conserva el área original y sus vecinos`,()=>{
    const p=make(),before=serializeProject(p),t=p.territories[0],size=area(t.vertices.map(v=>p.vertices[v]));
    const {project:next,ids}=subdivideArea(p,t.id,count);
    expect(ids).toHaveLength(count);expect(new Set(ids).size).toBe(count);expect(next.territories).toHaveLength(12+count-1);
    expect(ids.reduce((sum,id)=>sum+area(next.territories.find(t=>t.id===id)!.vertices.map(v=>next.vertices[v])),0)).toBeCloseTo(size,4);
    p.territories.filter(v=>v.id!==t.id).forEach(other=>{const updated=next.territories.find(v=>v.id===other.id)!;expect(updated.name).toBe(other.name);expect(area(updated.vertices.map(v=>next.vertices[v]))).toBeCloseTo(area(other.vertices.map(v=>p.vertices[v])),4);});
    expect(parseProject(serializeProject(next))).toEqual(next);expect(serializeProject(p)).toBe(before);
  });
  it('es determinista y conserva propiedades y pertenencia al grupo',()=>{
    const p=groupAreas(make(),['t0','t1'],'Grupo','#123456'),a=subdivideArea(p,'t0',4),b=subdivideArea(p,'t0',4);
    expect(a).toEqual(b);expect(a.ids.every(id=>{const t=a.project.territories.find(t=>t.id===id)!;return t.regionId===p.groups[0].id&&t.surface==='land'&&t.color===p.territories[0].color;})).toBe(true);
    expect(parseProject(serializeProject(a.project))).toEqual(a.project);
  });
  it('mantiene libres todas las partes de agua sin región',()=>{
    const p=make();p.territories[0].surface='water';p.territories[0].regionId=null;
    const {project:next,ids}=subdivideArea(p,'t0',3);expect(next.territories.filter(t=>ids.includes(t.id)).every(t=>t.surface==='water'&&t.regionId===null)).toBe(true);
  });
  it('divide una forma cóncava manteniendo cobertura rectangular y fronteras compartidas',()=>{
    const base=make(),t=base.territories[0];
    const p:MapProject={...base,width:200,height:200,groups:[],vertices:{a:{x:0,y:0},b:{x:200,y:0},c:{x:200,y:20},d:{x:20,y:20},e:{x:20,y:200},f:{x:0,y:200},g:{x:200,y:200}},territories:[{...t,id:'t0',regionId:'t0',vertices:['a','b','c','d','e','f']},{...t,id:'t1',regionId:'t1',vertices:['d','c','g','e']}]};
    const {project:next,ids}=subdivideArea(p,'t0',7);expect(ids).toHaveLength(7);expect(parseProject(serializeProject(next))).toEqual(next);
  });
  it('rechaza cantidades inválidas o superiores al límite sin modificar el proyecto',()=>{
    const p=make(),before=serializeProject(p);for(const n of [0,1,2.5,NaN,Infinity,110])expect(()=>subdivideArea(p,'t0',n)).toThrow();
    expect(()=>subdivideArea(p,'missing',3)).toThrow();expect(serializeProject(p)).toBe(before);
  });
  it('permite llegar exactamente al límite de 120 áreas',()=>{
    const initial=make(),single=mergeSelection(initial,initial.territories.map(t=>t.id));
    const result=subdivideArea(single,single.territories[0].id,120);
    expect(result.ids).toHaveLength(120);expect(parseProject(serializeProject(result.project))).toEqual(result.project);
  });
  it('prefiere partes compactas en una superficie rectangular',()=>{
    const initial=make(),single=mergeSelection(initial,initial.territories.map(t=>t.id));
    const result=subdivideArea(single,single.territories[0].id,4,{segments:1});
    result.project.territories.forEach(t=>{
      const points=t.vertices.map(id=>result.project.vertices[id]),w=Math.max(...points.map(p=>p.x))-Math.min(...points.map(p=>p.x)),h=Math.max(...points.map(p=>p.y))-Math.min(...points.map(p=>p.y));
      expect(Math.max(w/h,h/w)).toBeLessThan(1.8);
      expect(area(points)/(w*h)).toBeGreaterThan(.9);
    });
  });
  it('agrega curvas y aristas compartidas sin mover ningún vértice anterior',()=>{
    const p=make(),straight=subdivideArea(p,'t0',5,{segments:1}),curved=subdivideArea(p,'t0',5,{segments:8,irregularity:1});
    const curveIds=Object.keys(curved.project.vertices).filter(id=>id.startsWith('curve'));
    expect(curveIds.length).toBeGreaterThan(20);
    for(const id of curveIds)expect(curved.project.territories.filter(t=>t.vertices.includes(id))).toHaveLength(2);
    Object.entries(straight.project.vertices).forEach(([id,point])=>expect(curved.project.vertices[id]).toEqual(point));
    const straightEdges=edges(straight.project);
    expect(curveIds.some(id=>Math.min(...straightEdges.map(([a,b])=>distanceToSegment(curved.project.vertices[id],straight.project.vertices[a],straight.project.vertices[b])))>.1)).toBe(true);
    expect(parseProject(serializeProject(curved.project))).toEqual(curved.project);
  });
  it('permite reducir el detalle y desactivar la irregularidad',()=>{
    const p=make(),straight=subdivideArea(p,'t0',3,{segments:1}),detailed=subdivideArea(p,'t0',3,{segments:12,irregularity:0});
    const straightEdges=edges(straight.project);
    const curveIds=Object.keys(detailed.project.vertices).filter(id=>id.startsWith('curve'));
    expect(curveIds.length).toBeGreaterThan(0);
    curveIds.forEach(id=>expect(Math.min(...straightEdges.map(([a,b])=>distanceToSegment(detailed.project.vertices[id],straight.project.vertices[a],straight.project.vertices[b])))).toBeLessThan(1e-6));
    expect(parseProject(serializeProject(detailed.project))).toEqual(detailed.project);
  });
  it('respeta el máximo detalle en zonas cóncavas y rechaza controles no numéricos',()=>{
    const p=make();expect(parseProject(serializeProject(subdivideArea(p,'t0',8,{segments:12,irregularity:1}).project))).toBeTruthy();
    expect(()=>subdivideArea(p,'t0',2,{segments:NaN})).toThrow();expect(()=>subdivideArea(p,'t0',2,{irregularity:NaN})).toThrow();
  });
  it('conecta solo vértices existentes y conserva exactamente los anillos vecinos',()=>{
    const p=make(),before=serializeProject(p),result=subdivideArea(p,'t0',4,{endpoints:'vertices',segments:1});
    expect(result.ids).toHaveLength(4);expect(result.project.vertices).toEqual(p.vertices);
    p.territories.filter(t=>t.id!=='t0').forEach(t=>expect(result.project.territories.find(v=>v.id===t.id)).toEqual(t));
    expect(parseProject(serializeProject(result.project))).toEqual(result.project);expect(serializeProject(p)).toBe(before);
    expect(subdivideArea(p,'t0',4,{endpoints:'vertices',segments:1})).toEqual(result);
  });
  it('combina extremos existentes con curvas compartidas y agua libre',()=>{
    const p=make();p.territories[0].surface='water';p.territories[0].regionId=null;
    const result=subdivideArea(p,'t0',4,{endpoints:'vertices',segments:12,irregularity:1});
    const added=Object.keys(result.project.vertices).filter(id=>!p.vertices[id]);
    expect(added.length).toBeGreaterThan(0);
    added.forEach(id=>expect(result.project.territories.filter(t=>t.vertices.includes(id))).toHaveLength(2));
    result.project.territories.filter(t=>result.ids.includes(t.id)).forEach(t=>{expect(t.surface).toBe('water');expect(t.regionId).toBeNull();});
    p.territories.filter(t=>t.id!=='t0').forEach(t=>expect(result.project.territories.find(v=>v.id===t.id)).toEqual(t));
    expect(parseProject(serializeProject(result.project))).toEqual(result.project);
  });
  it('respeta el máximo de n−2 partes sin crear extremos adicionales',()=>{
    const base=make(),p:MapProject={...base,width:200,height:200,groups:[],vertices:{a:{x:0,y:0},b:{x:200,y:0},c:{x:200,y:200},d:{x:0,y:200}},territories:[{...base.territories[0],id:'t0',regionId:'t0',vertices:['a','b','c','d']}]};
    const result=subdivideArea(p,'t0',2,{endpoints:'vertices',segments:1});
    expect(result.project.vertices).toEqual(p.vertices);expect(result.project.territories.every(t=>t.vertices.length===3)).toBe(true);
    expect(()=>subdivideArea(p,'t0',3,{endpoints:'vertices'})).toThrow(/máximo 2 partes/);
    expect(subdivideArea(p,'t0',3,{endpoints:'free'}).ids).toHaveLength(3);
    const triangle=result.project,first=triangle.territories[0];
    expect(()=>subdivideArea(triangle,first.id,2,{endpoints:'vertices'})).toThrow(/máximo 1 partes/);
  });
  it('divide una L mediante vértices existentes sin cruzar la concavidad',()=>{
    const base=make(),t=base.territories[0];
    const p:MapProject={...base,width:200,height:200,groups:[],vertices:{a:{x:0,y:0},b:{x:200,y:0},c:{x:200,y:20},d:{x:20,y:20},e:{x:20,y:200},f:{x:0,y:200},g:{x:200,y:200}},territories:[{...t,id:'t0',regionId:'t0',vertices:['a','b','c','d','e','f']},{...t,id:'t1',regionId:'t1',vertices:['d','c','g','e']}]};
    const result=subdivideArea(p,'t0',4,{endpoints:'vertices',segments:8});
    expect(result.ids).toHaveLength(4);expect(result.project.territories.find(t=>t.id==='t1')).toEqual(p.territories[1]);
    expect(parseProject(serializeProject(result.project))).toEqual(result.project);
  });
});
