import { describe,it,expect } from 'vitest';
import { generate } from '../geometry/generate';
import { detachTerritory,listRegions,updateRegion } from './regions';
import { groupAreas,regionCount,displayColor,cleanGroups } from './groups';
import { parseProject,serializeProject } from '../io/project';
import { exportSvg } from '../io/svg';
const make=()=>generate({count:12,seed:'regiones',irregularity:.7,segments:3});

describe('administrador de regiones',()=>{
  it('enumera regiones compartidas e individuales sin duplicar territorios ni incluir áreas libres',()=>{
    const p=groupAreas(make(),['t0','t1','t2'],'Norte','#123456');p.territories[3].regionId=null;p.territories[3].surface='water';
    const regions=listRegions(p);expect(regions).toHaveLength(regionCount(p));expect(regions).toHaveLength(9);
    expect(regions[0].name).toBe('Norte');expect(regions[0].color).toBe('#123456');expect(regions[0].territories.map(t=>t.id)).toEqual(['t0','t1','t2']);
    expect(regions.flatMap(r=>r.territories).some(t=>t.id==='t3')).toBe(false);
  });
  it('edita una región individual sin cambiar el nombre ni el color propio del territorio',()=>{
    const p=make(),before=serializeProject(p),result=updateRegion(p,'t0','Costa','#123456');
    expect(result.regionId).not.toBe('t0');expect(listRegions(result.project).find(r=>r.id===result.regionId)?.name).toBe('Costa');
    expect(result.project.territories[0].name).toBe(p.territories[0].name);expect(result.project.territories[0].color).toBe(p.territories[0].color);
    expect(displayColor(result.project,result.project.territories[0])).toBe('#123456');expect(regionCount(result.project)).toBe(12);
    expect(parseProject(serializeProject(result.project))).toEqual(result.project);expect(serializeProject(p)).toBe(before);
    expect(exportSvg(result.project)).toContain('Costa');
  });
  it('modifica nombre y color comunes sin alterar geometría ni nombres de territorios',()=>{
    const p=groupAreas(make(),['t0','t1'],'Norte','#123456'),before=serializeProject(p),id=p.groups[0].id;
    const result=updateRegion(p,id,'Sur & Mar','#abcdef').project;
    expect(listRegions(result)[0].name).toBe('Sur & Mar');expect(result.territories).toEqual(p.territories);expect(result.vertices).toEqual(p.vertices);
    expect(exportSvg(result)).toContain('Sur &amp; Mar');expect(exportSvg(result)).toContain('fill="#abcdef"');
    expect(serializeProject(p)).toBe(before);
  });
  it('separa un territorio hacia su propia región y conserva la identidad del último integrante',()=>{
    const p=groupAreas(make(),['t0','t1'],'Norte','#123456'),id=p.groups[0].id,before=serializeProject(p);
    const next=detachTerritory(p,id,'t0'),regions=listRegions(next),remaining=regions.find(r=>r.id===id)!,detached=regions.find(r=>r.id==='t0')!;
    expect(remaining.name).toBe('Norte');expect(remaining.color).toBe('#123456');expect(remaining.territories.map(t=>t.id)).toEqual(['t1']);
    expect(detached.name).toBe(p.territories[0].name);expect(detached.color).toBe(p.territories[0].color);expect(detached.territories).toHaveLength(1);
    expect(next.territories[0].regionId).toBe('t0');expect(regionCount(next)).toBe(regionCount(p)+1);expect(next.vertices).toEqual(p.vertices);
    expect(parseProject(serializeProject(next))).toEqual(next);expect(serializeProject(p)).toBe(before);
    const clean=cleanGroups(structuredClone(next));expect(clean.groups[0].name).toBe('Norte');
  });
  it('elimina la región vacía al separar el último territorio y conserva todos los territorios',()=>{
    const p=groupAreas(make(),['t0','t1'],'Norte','#123456'),id=p.groups[0].id;
    const result=detachTerritory(detachTerritory(p,id,'t0'),id,'t1');
    expect(result.groups).toHaveLength(0);expect(result.territories.map(t=>t.regionId)).toEqual(make().territories.map(t=>t.regionId));
    expect(result.territories).toHaveLength(12);expect(parseProject(serializeProject(result))).toEqual(result);
  });
  it('permite recuperar la identidad individual después de editar una región de un solo territorio',()=>{
    const p=make(),edited=updateRegion(p,'t0','Región costera','#123456');
    const restored=detachTerritory(edited.project,edited.regionId,'t0');expect(restored).toEqual(p);
  });
  it('rechaza operaciones inválidas sin cambiar el proyecto',()=>{
    const p=make(),before=serializeProject(p);
    expect(()=>updateRegion(p,'t0','  ','#123456')).toThrow();expect(()=>updateRegion(p,'t0','Norte','red')).toThrow();expect(()=>updateRegion(p,'missing','Norte','#123456')).toThrow();
    expect(()=>detachTerritory(p,'t0','t0')).toThrow();expect(()=>detachTerritory(p,'t1','t0')).toThrow();expect(serializeProject(p)).toBe(before);
    const edited=updateRegion(p,'t0','Norte','#123456').project;edited.groups[0].keepSingle=false as never;
    expect(()=>parseProject(serializeProject(edited))).toThrow();
    edited.groups[0].keepSingle=true;edited.territories[0].regionId='t0';expect(()=>parseProject(serializeProject(edited))).toThrow();
  });
});
