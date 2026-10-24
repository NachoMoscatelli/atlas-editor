import {describe,it,expect} from 'vitest';
import {allocateTerritories,coastDefaults,coastDraftFromProject,coastProject,populateGeography,proposeCoasts,validCoastDraft} from './geography';
import {area,validGeometry,edges} from './topology';
import {parseProject,serializeProject} from '../io/project';
import {exportSvg} from '../io/svg';
import {splitEdge,removeVertex} from './edit';
import {mergeSelection,divideArea} from './areas';
import {generate} from './generate';
import {groupAreas,regionCount} from '../model/groups';
const options={count:16,seed:'costas',irregularity:.65,segments:3,widthMm:700,heightMm:500};
describe('geografía separada de territorios',()=>{
  for(const islands of [0,1,3,8])it(`propone tierra y ${islands} islas dentro de un margen de mar`,()=>{
    const draft=proposeCoasts(options,{...coastDefaults,islands}),p=coastProject(draft,options);
    expect(draft.landforms).toHaveLength(islands+1);expect(validCoastDraft(draft,options)).toBe(true);
    expect(parseProject(serializeProject(p))).toEqual(p);
    for(const point of Object.values(p.vertices)){expect(point.x).toBeGreaterThan(p.geography!.margin);expect(point.y).toBeGreaterThan(p.geography!.margin);expect(point.x).toBeLessThan(p.width-p.geography!.margin);expect(point.y).toBeLessThan(p.height-p.geography!.margin);}
  });
  it('es determinista y permite propuestas distintas con la misma semilla',()=>{
    expect(proposeCoasts(options)).toEqual(proposeCoasts(options));expect(proposeCoasts(options,{...coastDefaults,variant:1})).not.toEqual(proposeCoasts(options));
  });
  for(const islands of [0,3,8])it(`distribuye exactamente 16 territorios respetando ${islands+1} costas`,()=>{
    const draft=proposeCoasts(options,{...coastDefaults,islands}),before=JSON.stringify(draft),counts=allocateTerritories(draft,16),p=populateGeography(draft,counts,options,'Costas');
    expect(p.territories).toHaveLength(16);expect(p.territories.every(t=>t.surface==='land')).toBe(true);expect(regionCount(p)).toBe(islands+1);
    const land=draft.landforms.reduce((s,l)=>s+area(l.points),0),territories=p.territories.reduce((s,t)=>s+area(t.vertices.map(id=>p.vertices[id])),0);
    expect(territories).toBeCloseTo(land,4);expect(land).toBeLessThan(p.width*p.height);
    expect(validGeometry(p)).toBe(true);expect(parseProject(serializeProject(p))).toEqual(p);expect(JSON.stringify(draft)).toBe(before);
    const svg=exportSvg(p,true,true);expect(svg).toContain('data-ocean="true"');expect(svg.match(/data-surface=/g)).toHaveLength(16);
  });
  it('sincroniza nuevos puntos de costa con división, agregar y quitar nodos',()=>{
    const draft=proposeCoasts(options,{...coastDefaults,islands:0});const p=coastProject(draft,options),t=p.territories[0];
    const [a,b]=[t.vertices[0],t.vertices[1]],added=splitEdge(p,a,b);
    expect(added.project.geography!.landforms[0].vertices).toContain(added.vertexId);expect(validGeometry(added.project)).toBe(true);
    expect(removeVertex(added.project,added.vertexId)).toEqual(p);
    const A=p.vertices[a],B=p.vertices[b],C=p.vertices[t.vertices[16]],D=p.vertices[t.vertices[17]];
    const split=divideArea(p,t.id,{x:(A.x+B.x)/2,y:(A.y+B.y)/2},{x:(C.x+D.x)/2,y:(C.y+D.y)/2}).project;
    expect(split.geography!.landforms[0].vertices.length).toBe(34);expect(parseProject(serializeProject(split))).toEqual(split);
  });
  it('permite unir territorios del continente y agrupar islas sin fusionar su geografía',()=>{
    const d=proposeCoasts(options),p=populateGeography(d,[4,1,1,1],{...options,count:7},'Costas');
    const mainland=p.territories.filter(t=>t.regionId===p.territories[0].regionId).map(t=>t.id),merged=mergeSelection(p,mainland);
    expect(merged.territories).toHaveLength(4);expect(parseProject(serializeProject(merged))).toEqual(merged);
    const grouped=groupAreas(merged,merged.territories.map(t=>t.id),'Archipiélago','#123456');expect(regionCount(grouped)).toBe(1);expect(grouped.geography!.landforms).toHaveLength(4);expect(parseProject(serializeProject(grouped))).toEqual(grouped);
  });
  it('rechaza costas superpuestas, anidadas, fuera del margen y cobertura incompleta',()=>{
    const draft=proposeCoasts(options),outside=structuredClone(draft);outside.landforms[0].points[0].x=0;expect(validCoastDraft(outside,options)).toBe(false);
    const overlap=structuredClone(draft);overlap.landforms[1].points=structuredClone(overlap.landforms[0].points);expect(validCoastDraft(overlap,options)).toBe(false);
    const nested=structuredClone(draft),main=nested.landforms[0].points,center={x:main.reduce((s,p)=>s+p.x,0)/main.length,y:main.reduce((s,p)=>s+p.y,0)/main.length};nested.landforms[1].points=main.map(p=>({x:center.x+(p.x-center.x)*.1,y:center.y+(p.y-center.y)*.1}));expect(validCoastDraft(nested,options)).toBe(false);
    const p=coastProject(draft,options);p.territories.pop();expect(()=>parseProject(serializeProject(p))).toThrow();
  });
  it('rechaza metadatos v4 inválidos y mantiene compatibilidad con proyectos rectangulares',()=>{
    const old=generate(options);expect(parseProject(serializeProject(old))).toEqual(old);
    const p=coastProject(proposeCoasts(options),options);p.geography!.landforms[0].vertices[0]='missing';expect(()=>parseProject(serializeProject(p))).toThrow();
    const missing=coastProject(proposeCoasts(options),options);delete missing.geography;expect(()=>parseProject(serializeProject(missing))).toThrow();
    const water=coastProject(proposeCoasts(options),options);water.territories[0].surface='water';expect(()=>parseProject(serializeProject(water))).toThrow();
  });
  it('recupera las costas editables después de guardar y carga todas sus referencias',()=>{
    const draft=proposeCoasts(options),p=populateGeography(draft,[4,1,1,1],{...options,count:7},'Costas'),loaded=parseProject(serializeProject(p));
    const recovered=coastDraftFromProject(loaded)!;expect(recovered.landforms).toHaveLength(4);expect(validCoastDraft(recovered,loaded.generation)).toBe(true);
    expect(edges(loaded).length).toBeGreaterThan(loaded.geography!.landforms.length);
  });
  it('valida el reparto y las opciones de propuestas sin modificar las costas',()=>{
    const d=proposeCoasts(options),before=JSON.stringify(d);
    expect(()=>allocateTerritories(d,2)).toThrow();expect(()=>populateGeography(d,[1,0,1,2],options,'Costas')).toThrow();expect(()=>proposeCoasts(options,{...coastDefaults,islands:9})).toThrow();expect(JSON.stringify(d)).toBe(before);
  });
});
