import type { MapProject, Territory } from './types';

export function regionCount(p:MapProject) {return new Set(p.territories.flatMap(t=>t.regionId===null?[]:[t.regionId])).size;}
export function groupFor(p:MapProject,t:Territory) {return p.groups.find(g=>g.id===t.regionId);}
export function displayColor(p:MapProject,t:Territory) {
  if(t.regionId===null)return t.surface==='water'?'#b1cdd1':'#cfdbb1';
  // In older files an individual region's initial color lives on its territory.
  return groupFor(p,t)?.color??t.color;
}
export function toggleSelection(ids:string[],id:string) {return ids.includes(id)?ids.filter(x=>x!==id):[...ids,id];}

/** Explicit region identities may retain a single member; empty records are removed. */
export function cleanGroups(p:MapProject) {
  const retained=p.groups.filter(g=>p.territories.filter(t=>t.regionId===g.id).length>=(g.keepSingle?1:2));
  const removed=new Set(p.groups.filter(g=>!retained.includes(g)).map(g=>g.id));
  p.territories=p.territories.map(t=>t.regionId!==null&&removed.has(t.regionId)?{...t,regionId:t.id}:t);p.groups=retained;
  return p;
}
function metadata(name:string,color:string) {
  if(!name.trim()||name.trim().length>100)throw new Error('Elegí un nombre de grupo de 1 a 100 caracteres.');
  if(!/^#[0-9a-f]{6}$/i.test(color))throw new Error('El color del grupo no es válido.');
}
export function groupAreas(project:MapProject,ids:string[],name:string,color:string):MapProject {
  const chosen=new Set(ids);if(chosen.size<2)throw new Error('Seleccioná al menos dos áreas.');
  if([...chosen].some(id=>!project.territories.some(t=>t.id===id)))throw new Error('La selección contiene áreas que ya no existen.');
  metadata(name,color);const p=structuredClone(project);
  let n=0;while(p.groups.some(g=>g.id===`group${n}`)||p.territories.some(t=>t.id===`group${n}`))n++;
  const id=`group${n}`;p.groups.push({id,name:name.trim(),color});
  p.territories.forEach(t=>{if(chosen.has(t.id))t.regionId=id;});return cleanGroups(p);
}
export function updateGroup(project:MapProject,id:string,name:string,color:string):MapProject {
  metadata(name,color);const p=structuredClone(project),g=p.groups.find(g=>g.id===id);
  if(!g)throw new Error('El grupo ya no existe.');g.name=name.trim();g.color=color;return p;
}
export function dissolveGroup(project:MapProject,id:string):MapProject {
  if(!project.groups.some(g=>g.id===id))throw new Error('El grupo ya no existe.');
  const p=structuredClone(project);p.territories.forEach(t=>{if(t.regionId===id)t.regionId=t.id;});return cleanGroups(p);
}
