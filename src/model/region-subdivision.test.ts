import {describe,it,expect} from 'vitest';
import { generate } from '../geometry/generate';
import { divideArea } from '../geometry/areas';
import { subdivideArea } from '../geometry/subdivide';
import { displayColor,groupAreas,regionCount } from './groups';
import { listRegions,updateRegion } from './regions';
import { parseProject,serializeProject } from '../io/project';
import { exportSvg } from '../io/svg';
const make=()=>generate({count:12,seed:'misma-region',irregularity:.6,segments:3});

describe('colores y subdivisión por región',()=>{
  for(const endpoints of ['free','vertices'] as const)it(`conserva la región individual al subdividir desde ${endpoints}`,()=>{
    const p=make(),original=p.territories[0],before=serializeProject(p);
    const next=subdivideArea(p,original.id,4,{endpoints}),regionId=next.project.territories.find(t=>t.id===original.id)!.regionId;
    expect(regionId).not.toBeNull();expect(next.ids.every(id=>next.project.territories.find(t=>t.id===id)!.regionId===regionId)).toBe(true);
    expect(regionCount(next.project)).toBe(regionCount(p));
    const region=listRegions(next.project).find(r=>r.id===regionId)!;
    expect(region.name).toBe(original.name);expect(region.color).toBe(original.color);expect(region.territories).toHaveLength(4);
    const recolored=updateRegion(next.project,region.id,'Región común','#276598').project;
    expect(next.ids.every(id=>displayColor(recolored,recolored.territories.find(t=>t.id===id)!)==='#276598')).toBe(true);
    expect(parseProject(serializeProject(recolored))).toEqual(recolored);expect(exportSvg(recolored)).toContain('fill="#276598"');
    expect(serializeProject(p)).toBe(before);
  });
  it('el corte manual conserva nombre, color y cantidad de regiones de un proyecto anterior',()=>{
    const p=make(),t=p.territories[0],next=divideArea(p,t.id,p.vertices[t.vertices[0]],p.vertices[t.vertices[2]]);
    const regionId=next.project.territories.find(t=>t.id===next.newId)!.regionId;
    expect(next.project.territories.find(v=>v.id===t.id)!.regionId).toBe(regionId);expect(regionCount(next.project)).toBe(regionCount(p));
    expect(listRegions(next.project).find(r=>r.id===regionId)).toMatchObject({name:t.name,color:t.color});
    expect(parseProject(serializeProject(next.project))).toEqual(next.project);
  });
  it('conserva la identidad de una región compartida al volver a dividir uno de sus territorios',()=>{
    const p=groupAreas(make(),['t0','t1'],'Norte','#123456'),id=p.groups[0].id,next=subdivideArea(p,'t0',4);
    expect(regionCount(next.project)).toBe(regionCount(p));expect(listRegions(next.project).find(r=>r.id===id)?.territories).toHaveLength(5);
    next.ids.forEach(id=>expect(displayColor(next.project,next.project.territories.find(t=>t.id===id)!)).toBe('#123456'));
  });
  it('el color de la región prevalece sobre colores históricos de sus territorios',()=>{
    const p=groupAreas(make(),['t0','t1'],'Norte','#123456');p.territories[0].color='#ff0000';p.territories[1].color='#0000ff';
    expect(displayColor(p,p.territories[0])).toBe('#123456');expect(displayColor(p,p.territories[1])).toBe('#123456');
    p.territories[2].regionId=null;p.territories[2].surface='water';p.territories[2].color='#ff0000';
    expect(displayColor(p,p.territories[2])).toBe('#b1cdd1');p.territories[2].surface='land';expect(displayColor(p,p.territories[2])).toBe('#cfdbb1');
  });
});
