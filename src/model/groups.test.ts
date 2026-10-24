import { describe,it,expect } from 'vitest';
import { generate } from '../geometry/generate';
import { groupAreas,dissolveGroup,updateGroup,regionCount,toggleSelection,displayColor,cleanGroups } from './groups';
import { parseProject,serializeProject } from '../io/project';
import { divideArea,mergeAreas,neighbors } from '../geometry/areas';
import { mapBorders } from '../geometry/presentation';
import { exportSvg } from '../io/svg';
const make=()=>generate({count:12,seed:'grupos',irregularity:0,segments:1});
describe('selección múltiple y grupos',()=>{
  it('alterna áreas sin duplicarlas y permite quitar la última selección',()=>{
    const one=toggleSelection([],'t0'),two=toggleSelection(one,'t1');expect(two).toEqual(['t0','t1']);expect(toggleSelection(two,'t0')).toEqual(['t1']);expect(toggleSelection(one,'t0')).toEqual([]);
  });
  it('agrupa áreas separadas sin cambiar geometría, superficies ni colores propios',()=>{
    const p=make(),original=serializeProject(p),next=groupAreas(p,['t0','t2','t5'],'Norte','#b1cdd1');
    expect(serializeProject(p)).toBe(original);expect(next.vertices).toEqual(p.vertices);expect(next.territories.map(t=>t.vertices)).toEqual(p.territories.map(t=>t.vertices));
    expect(regionCount(next)).toBe(10);expect(next.groups).toHaveLength(1);expect(next.territories[0].color).toBe(p.territories[0].color);expect(displayColor(next,next.territories[0])).toBe('#b1cdd1');
    expect(parseProject(serializeProject(next))).toEqual(next);
  });
  it('actualiza y desarma grupos sin perder los colores originales',()=>{
    const p=make(),next=groupAreas(p,['t0','t1'],'Norte','#b1cdd1'),id=next.groups[0].id;
    const edited=updateGroup(next,id,'Sur','#e5cca1');expect(edited.groups[0].name).toBe('Sur');expect(next.groups[0].name).toBe('Norte');
    expect(dissolveGroup(edited,id)).toEqual(p);
  });
  it('reagrupa una selección parcial y disuelve grupos que quedan con un solo miembro',()=>{
    const p=groupAreas(make(),['t0','t1'],'A','#b1cdd1'),next=groupAreas(p,['t1','t2'],'B','#e5cca1');
    expect(next.groups.map(g=>g.name)).toEqual(['B']);expect(next.territories[0].regionId).toBe('t0');expect(p.territories[0].regionId).toBe(p.groups[0].id);expect(parseProject(serializeProject(next))).toEqual(next);
  });
  it('limpia una asignación sin mutar las áreas compartidas con el historial',()=>{
    const p=groupAreas(make(),['t0','t1'],'A','#b1cdd1');
    const changed=cleanGroups({...p,territories:p.territories.map(t=>t.id==='t1'?{...t,regionId:null}:t),groups:[...p.groups]});
    expect(p.territories[0].regionId).toBe(p.groups[0].id);expect(changed.territories[0].regionId).toBe('t0');expect(changed.groups).toHaveLength(0);
  });
  it('conserva grupo al dividir y valida la fusión de sus miembros',()=>{
    const p=make(),t=p.territories[0],neighbor=neighbors(p,t.id)[0];const grouped=groupAreas(p,[t.id,neighbor.id],'Unión','#b1cdd1'),id=grouped.groups[0].id;
    const cut=divideArea(grouped,t.id,p.vertices[t.vertices[0]],p.vertices[t.vertices[2]]);
    expect(cut.project.territories.find(t=>t.id===cut.newId)?.regionId).toBe(id);expect(parseProject(serializeProject(cut.project))).toEqual(cut.project);
    const merged=mergeAreas(grouped,t.id,neighbor.id);expect(merged.groups).toHaveLength(0);expect(regionCount(merged)).toBe(11);expect(parseProject(serializeProject(merged))).toEqual(merged);
  });
  it('incluye nombre, color y límites internos en SVG y omite nombres si se pide',()=>{
    const p=make(),neighbor=neighbors(p,'t0')[0],grouped=groupAreas(p,['t0',neighbor.id],'Norte < & Sur','#123456');
    expect(mapBorders(grouped).some(e=>e.internal)).toBe(true);
    const svg=exportSvg(grouped);expect(svg).toContain('Norte &lt; &amp; Sur');expect(svg).toContain('fill="#123456"');expect(svg).toContain('stroke-dasharray="4 3"');expect(exportSvg(grouped,false)).not.toContain('Norte &lt;');
  });
  it('migra archivos v2 preservando la geometría y regiones existentes',()=>{
    const p=make(),{groups,...rest}=p,legacy={...rest,version:2};expect(parseProject(JSON.stringify(legacy))).toEqual(p);
  });
  it('evita colisiones entre identificadores de grupos importados y nuevas áreas',()=>{
    const p=make(),t=p.territories[0],grouped=groupAreas(p,['t0','t1'],'A','#123456'),id=grouped.groups[0].id;
    grouped.groups[0].id='area0';grouped.territories.forEach(t=>{if(t.regionId===id)t.regionId='area0';});
    const cut=divideArea(parseProject(serializeProject(grouped)),t.id,p.vertices[t.vertices[0]],p.vertices[t.vertices[2]]);
    expect(cut.newId).not.toBe('area0');expect(parseProject(serializeProject(cut.project))).toEqual(cut.project);
  });
  it('rechaza selección insuficiente, nombres vacíos, referencias y grupos inválidos',()=>{
    const p=make();expect(()=>groupAreas(p,['t0'],'A','#123456')).toThrow();expect(()=>groupAreas(p,['t0','missing'],'A','#123456')).toThrow();expect(()=>groupAreas(p,['t0','t1'],'  ','#123456')).toThrow();
    const grouped=groupAreas(p,['t0','t1'],'A','#123456');grouped.territories[1].regionId='t1';expect(()=>parseProject(serializeProject(grouped))).toThrow('dos áreas');
  });
});
