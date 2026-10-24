import {describe,it,expect} from 'vitest';
import {generate} from './generate';
import {mergeSelection,neighbors} from './areas';
import {area,edges,edgeKey} from './topology';
import {parseProject,serializeProject} from '../io/project';
import {groupAreas} from '../model/groups';
import type {MapProject} from '../model/types';
const make=()=>generate({count:12,seed:'union',irregularity:1,segments:3});
describe('unir selección en una única área',()=>{
  it('elimina las aristas internas y mantiene a los vecinos externos',()=>{
    const p=make(),ids=['t0',...neighbors(p,'t0').slice(0,2).map(t=>t.id)],original=serializeProject(p);
    const beforeInternal=edges(p).filter(([a,b])=>p.territories.filter(t=>ids.includes(t.id)&&t.vertices.some((v,i)=>edgeKey(v,t.vertices[(i+1)%t.vertices.length])===edgeKey(a,b))).length===2);
    const next=mergeSelection(p,ids),after=new Set(edges(next).map(([a,b])=>edgeKey(a,b)));
    expect(next.territories).toHaveLength(10);expect(beforeInternal.length).toBeGreaterThan(0);expect(beforeInternal.every(([a,b])=>!after.has(edgeKey(a,b)))).toBe(true);
    p.territories.filter(t=>!ids.includes(t.id)).forEach(t=>expect(next.territories.find(v=>v.id===t.id)).toEqual(t));
    expect(parseProject(serializeProject(next))).toEqual(next);expect(serializeProject(p)).toBe(original);
  });
  it('une todas las áreas del mapa sin dejar grupos ni nodos internos huérfanos',()=>{
    const p=groupAreas(make(),['t0','t1','t2'],'Grupo','#123456'),next=mergeSelection(p,p.territories.map(t=>t.id));
    expect(next.territories).toHaveLength(1);expect(next.groups).toHaveLength(0);expect(area(next.territories[0].vertices.map(id=>next.vertices[id]))).toBeCloseTo(700000,2);
    expect(Object.keys(next.vertices).every(id=>next.territories[0].vertices.includes(id))).toBe(true);expect(parseProject(serializeProject(next))).toEqual(next);
  });
  it('conserva el identificador y atributos de la primera seleccionada',()=>{
    const p=make(),ids=['t0',...neighbors(p,'t0').slice(0,2).map(t=>t.id)].reverse(),first=p.territories.find(t=>t.id===ids[0])!;
    const t=mergeSelection(p,ids).territories.find(t=>t.id===first.id)!;
    expect(t).toMatchObject({id:first.id,name:first.name,color:first.color,surface:first.surface,regionId:first.regionId});
  });
  it('rechaza piezas separadas o selecciones inválidas sin modificar el proyecto',()=>{
    const p=make(),other=p.territories.find(t=>t.id!=='t0'&&!neighbors(p,'t0').some(n=>n.id===t.id))!,before=serializeProject(p);
    expect(()=>mergeSelection(p,['t0',other.id])).toThrow('conectadas');expect(()=>mergeSelection(p,['t0'])).toThrow('dos áreas');expect(()=>mergeSelection(p,['t0','missing'])).toThrow('existen');expect(serializeProject(p)).toBe(before);
  });
  it('resuelve toda la unión a la vez aunque una unión parcial formaría un hueco',()=>{
    const base=make().territories[0];const p:MapProject={version:3,groups:[],title:'Marco',width:100,height:100,generation:{count:4,seed:'x',irregularity:0,segments:1},vertices:{a:{x:0,y:0},b:{x:50,y:0},c:{x:100,y:0},d:{x:100,y:100},e:{x:50,y:100},f:{x:0,y:100},g:{x:30,y:30},h:{x:50,y:30},i:{x:70,y:30},j:{x:70,y:70},k:{x:50,y:70},l:{x:30,y:70}},territories:[{...base,id:'t0',regionId:'t0',vertices:['a','b','h','g','l','k','e','f']},{...base,id:'t1',regionId:'t1',vertices:['b','c','d','e','k','j','i','h']},{...base,id:'t2',regionId:'t2',vertices:['g','h','i','j','k','l']}]};
    expect(()=>mergeSelection(p,['t0','t1'])).toThrow('hueco');
    const next=mergeSelection(p,['t0','t1','t2']);expect(next.territories).toHaveLength(1);expect(parseProject(serializeProject(next))).toEqual(next);
  });
});
