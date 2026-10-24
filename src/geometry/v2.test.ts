import { describe,it,expect } from 'vitest';
import { generate } from './generate';
import { edges, validGeometry } from './topology';
import { splitEdge, removeVertex } from './edit';
import { parseProject, serializeProject } from '../io/project';
import { exportSvg } from '../io/svg';
const make=()=>generate({count:12,seed:'v2',irregularity:1,segments:2});
describe('áreas libres y detalle de fronteras',()=>{
  for(const segments of [1,3,6])for(const count of [4,32,120])it(`conserva cobertura y fronteras con ${segments} tramos / ${count} áreas`,()=>{
    const p=generate({count,seed:'detalle',irregularity:1,segments});
    expect(validGeometry(p)).toBe(true);
    expect(parseProject(serializeProject(p))).toEqual(p);
    const simple=generate({...p.generation,segments:1});
    const internal=edges(simple).filter(([a,b])=>simple.territories.filter(t=>t.vertices.includes(a)&&t.vertices.includes(b)).length===2).length;
    expect(Object.keys(p.vertices).length).toBe(Object.keys(simple.vertices).length+internal*(segments-1));
  });
  it('subdivide ambas caras en sentidos opuestos y permite volver al estado anterior',()=>{
    const p=make();const [a,b]=edges(p).find(([a,b])=>p.territories.filter(t=>t.vertices.includes(a)&&t.vertices.includes(b)).length===2)!;
    const {project:next,vertexId}=splitEdge(p,a,b);
    expect(next.territories.filter(t=>t.vertices.includes(vertexId))).toHaveLength(2);
    expect(Object.keys(p.vertices)).not.toContain(vertexId);
    const sides=next.territories.filter(t=>t.vertices.includes(vertexId)).map(t=>{const i=t.vertices.indexOf(vertexId);return [t.vertices[(i+t.vertices.length-1)%t.vertices.length],t.vertices[(i+1)%t.vertices.length]];});
    expect(sides[0]).toEqual([...sides[1]].reverse());
    expect(parseProject(serializeProject(next))).toEqual(next);
    expect(removeVertex(next,vertexId)).toEqual(p);
  });
  it('protege uniones y esquinas de la hoja',()=>{
    const p=make(), es=edges(p);
    const junction=Object.keys(p.vertices).find(id=>es.filter(([a,b])=>a===id||b===id).length>2)!;
    expect(()=>removeVertex(p,junction)).toThrow('unión');
    const corner=Object.keys(p.vertices).find(id=>{const v=p.vertices[id];return (v.x===0||v.x===p.width)&&(v.y===0||v.y===p.height);})!;
    expect(()=>removeVertex(p,corner)).toThrow('esquinas');
  });
  it('mantiene agua y tierra sin región al guardar y exportar',()=>{
    const p=make();p.territories[0].surface='water';p.territories[0].regionId=null;p.territories[0].color='#b1cdd1';p.territories[1].regionId=null;
    const restored=parseProject(serializeProject(p));expect(restored).toEqual(p);
    expect(restored.territories.filter(t=>t.regionId!==null)).toHaveLength(10);
    const svg=exportSvg(restored);expect(svg).toContain('data-surface="water" data-region=""');expect(svg).toContain('data-surface="land" data-region=""');
  });
  it('migra v1 sin cambiar nombres, colores ni geometría',()=>{
    const p=make();const legacy={...p,version:1,generation:{count:12,seed:'v2',irregularity:1},territories:p.territories.map(({surface,regionId,...t})=>t)};
    const migrated=parseProject(JSON.stringify(legacy));expect(migrated).toEqual(p);
  });
  it('rechaza detalle o asignaciones inválidas',()=>{
    const p=make();expect(()=>parseProject(JSON.stringify({...p,generation:{...p.generation,segments:100}}))).toThrow('Detalle');
    p.territories[0].regionId='inexistente';expect(()=>parseProject(serializeProject(p))).toThrow('asignación');
  });
});
