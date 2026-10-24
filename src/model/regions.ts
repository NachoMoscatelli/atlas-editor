import type { MapProject, Territory } from './types';
import { cleanGroups } from './groups';

export type Region = { id:string; name:string; color:string; territories:Territory[] };

/** Each assigned region appears once; free land and water do not appear. */
export function listRegions(project:MapProject):Region[] {
  const result=new Map<string,Region>();
  for(const t of project.territories) {
    if(t.regionId===null)continue;
    let region=result.get(t.regionId);
    if(!region) {
      const metadata=project.groups.find(g=>g.id===t.regionId);
      region={id:t.regionId,name:metadata?.name??t.name,color:metadata?.color??t.color,territories:[]};
      result.set(region.id,region);
    }
    region.territories.push(t);
  }
  return [...result.values()];
}

/** Region metadata is independent of the names and own colors of its territories. */
export function updateRegion(project:MapProject,id:string,name:string,color:string):{project:MapProject;regionId:string} {
  if(!name.trim()||name.trim().length>100)throw new Error('Elegí un nombre de región de 1 a 100 caracteres.');
  if(!/^#[0-9a-f]{6}$/i.test(color))throw new Error('Ingresá un color válido, por ejemplo #b5cbb0.');
  const region=listRegions(project).find(r=>r.id===id);
  if(!region)throw new Error('La región ya no existe.');
  const p=structuredClone(project),metadata=p.groups.find(g=>g.id===id);
  if(metadata) {metadata.name=name.trim();metadata.color=color;metadata.keepSingle=true;return {project:p,regionId:id};}
  let n=0;while(p.groups.some(g=>g.id===`region${n}`)||p.territories.some(t=>t.id===`region${n}`))n++;
  const regionId=`region${n}`;
  p.groups.push({id:regionId,name:name.trim(),color,keepSingle:true});
  p.territories.filter(t=>t.regionId===id).forEach(t=>{t.regionId=regionId;});
  return {project:p,regionId};
}

/** Separating a territory creates its own region, rather than making it free. */
export function detachTerritory(project:MapProject,regionId:string,territoryId:string):MapProject {
  const territory=project.territories.find(t=>t.id===territoryId);
  if(!territory||territory.regionId===null||territory.regionId!==regionId)throw new Error('Ese territorio ya no pertenece a la región.');
  if(territory.regionId===territory.id)throw new Error('El territorio ya tiene su propia región individual.');
  const p=structuredClone(project),region=p.groups.find(g=>g.id===regionId);
  if(region)region.keepSingle=true;
  p.territories.find(t=>t.id===territoryId)!.regionId=territoryId;
  return cleanGroups(p);
}
