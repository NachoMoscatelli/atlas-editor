import {rings} from './polygons';
import type { MapProject } from '../model/types';
import { area, edgeKey } from './topology';
export function mapBorders(p:MapProject) {
  const borders=new Map<string,{a:string;b:string;regions:(string|null)[]}>();
  p.territories.forEach(t=>rings(t).forEach(r=>r.forEach((a,i)=>{const b=r[(i+1)%r.length],key=edgeKey(a,b);const item=borders.get(key)??{a,b,regions:[]};item.regions.push(t.regionId);borders.set(key,item);})));
  return [...borders.values()].map(e=>({...e,internal:e.regions.length===2&&e.regions[0]!==null&&e.regions[0]===e.regions[1]}));
}
export function groupLabels(p:MapProject) {
  return p.groups.flatMap(g=>{const members=p.territories.filter(t=>t.regionId===g.id);const anchor=members.reduce<typeof members[number]|undefined>((best,t)=>!best||area(t.vertices.map(id=>p.vertices[id]))>area(best.vertices.map(id=>p.vertices[id]))?t:best,undefined);return anchor?[{...g,x:anchor.label.x,y:anchor.label.y+18}]:[];});
}
