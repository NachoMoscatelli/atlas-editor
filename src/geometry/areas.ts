import {addMultiPolygon,normalizeTopology,multiLabel,polygonsOf,rings,union} from './polygons';
import {cutPaintTerritory} from './paint';
import type { MapProject, Point, Territory } from '../model/types';
import { area, edgeKey, validGeometry } from './topology';
import { cleanGroups } from '../model/groups';
import { updateRegion } from '../model/regions';

const EPS=1e-6;
export function nearestBoundary(p:MapProject,t:Territory,point:Point) {
  let best={a:'',b:'',point:{x:0,y:0},distance:Infinity};
  rings(t).forEach(r=>r.forEach((a,i)=>{const b=r[(i+1)%r.length],A=p.vertices[a],B=p.vertices[b];
    const length=(B.x-A.x)**2+(B.y-A.y)**2;
    const u=length?Math.max(0,Math.min(1,((point.x-A.x)*(B.x-A.x)+(point.y-A.y)*(B.y-A.y))/length)):0;
    const q={x:A.x+u*(B.x-A.x),y:A.y+u*(B.y-A.y)},distance=Math.hypot(point.x-q.x,point.y-q.y);
    if(distance<best.distance)best={a,b,point:q,distance};
  }));return best;
}
export function neighbors(p:MapProject,id:string) {
  const t=p.territories.find(t=>t.id===id);if(!t)return [];
  const border=new Set(rings(t).flatMap(r=>r.map((a,i)=>edgeKey(a,r[(i+1)%r.length]))));
  return p.territories.filter(other=>other.id!==id&&rings(other).some(r=>r.some((a,i)=>border.has(edgeKey(a,r[(i+1)%r.length])))));
}
/** Horizontal scan lines find an interior label even for a concave face. */
export function interiorPoint(p:MapProject,ids:string[]):Point {
  const points=ids.map(id=>p.vertices[id]),ys=points.map(v=>v.y),min=Math.min(...ys),max=Math.max(...ys);
  let best={x:points[0].x,y:points[0].y},width=-1;
  for(let k=0;k<32;k++) {const y=min+(max-min)*(k+.5)/32,xs:number[]=[];
    points.forEach((A,i)=>{const B=points[(i+1)%points.length];if((A.y>y)!==(B.y>y))xs.push(A.x+(y-A.y)*(B.x-A.x)/(B.y-A.y));});xs.sort((a,b)=>a-b);
    for(let i=0;i+1<xs.length;i+=2){const score=(xs[i+1]-xs[i])*(1-.3*Math.abs(y-(min+max)/2)/(max-min));if(score>width){width=score;best={x:(xs[i]+xs[i+1])/2,y};}}
  }return best;
}
function uniqueId(dictionary:Record<string,unknown>,prefix:string) {let i=0;while(Object.hasOwn(dictionary,`${prefix}${i}`))i++;return `${prefix}${i}`;}
function insertBoundary(p:MapProject,id:string,point:Point) {
  const t=p.territories.find(t=>t.id===id)!,hit=nearestBoundary(p,t,point);
  if(hit.distance>EPS)throw new Error('Los extremos deben estar sobre el borde del área.');
  for(const id of [hit.a,hit.b])if(Math.hypot(p.vertices[id].x-hit.point.x,p.vertices[id].y-hit.point.y)<EPS)return id;
  const vertex=uniqueId(p.vertices,'cut');p.vertices[vertex]=hit.point;
  p.territories.forEach(t=>{const ids=t.vertices;t.vertices=ids.flatMap((a,i)=>edgeKey(a,ids[(i+1)%ids.length])===edgeKey(hit.a,hit.b)?[a,vertex]:[a]);});
  p.geography?.landforms.forEach(land=>{const ids=land.vertices;land.vertices=ids.flatMap((a,i)=>edgeKey(a,ids[(i+1)%ids.length])===edgeKey(hit.a,hit.b)?[a,vertex]:[a]);});return vertex;
}
function assertResult(p:MapProject) {
  if(p.territories.length>120||Object.keys(p.vertices).length>3000||p.territories.some(t=>t.vertices.length>500))throw new Error('La operación supera el límite de áreas o nodos.');
  if(!validGeometry(p))throw new Error('La línea debe quedar dentro del área y producir dos polígonos sin cruces.');
}
export function divideArea(project:MapProject,id:string,start:Point,end:Point):{project:MapProject;newId:string} {
  if(project.version>=5)return cutPaintTerritory(project,id,start,end);
  const source=project.territories.find(t=>t.id===id);
  if(!source)throw new Error('Seleccioná un área para dividir.');
  // Legacy individual regions store their metadata on their sole territory.
  // Give that region an independent identity before adding another territory.
  const base=source.regionId===source.id?updateRegion(project,source.id,source.name.trim()||'Región sin nombre',source.color).project:project;
  const p=structuredClone(base),a=insertBoundary(p,id,start),b=insertBoundary(p,id,end),t=p.territories.find(t=>t.id===id)!;
  const region=p.groups.find(g=>g.id===t.regionId);if(region)region.keepSingle=true;
  if(a===b)throw new Error('Elegí dos puntos distintos del borde.');
  const ia=t.vertices.indexOf(a),ib=t.vertices.indexOf(b),low=Math.min(ia,ib),high=Math.max(ia,ib);
  const one=t.vertices.slice(low,high+1),two=[...t.vertices.slice(high),...t.vertices.slice(0,low+1)];
  if(one.length<3||two.length<3||area(one.map(id=>p.vertices[id]))<1||area(two.map(id=>p.vertices[id]))<1)throw new Error('El corte debe atravesar el interior y dejar dos áreas de tamaño suficiente.');
  const newId=uniqueId(Object.fromEntries([...p.territories,...p.groups].map(t=>[t.id,true])),'area');
  t.vertices=one;t.label=interiorPoint(p,one);
  p.territories.push({...t,id:newId,name:`${t.name.slice(0,90)} (2)`,vertices:two,label:interiorPoint(p,two),regionId:t.regionId});
  assertResult(p);return {project:p,newId};
}
export function mergeAreas(project:MapProject,keepId:string,otherId:string):MapProject {
  const first=project.territories.find(t=>t.id===keepId),second=project.territories.find(t=>t.id===otherId);
  if(!first||!second||!neighbors(project,keepId).some(t=>t.id===otherId))throw new Error('Solo se pueden fusionar áreas que comparten una arista.');
  return mergeSelection(project,[keepId,otherId]);
}
/** Cancel every internal edge in one transaction, independent of selection order. */
export function mergeSelection(project:MapProject,ids:string[]):MapProject {
  const chosen=new Set(ids),keepId=ids[0];
  if(chosen.size<2)throw new Error('Seleccioná al menos dos áreas para unir.');
  const selected=project.territories.filter(t=>chosen.has(t.id));
  if(selected.length!==chosen.size)throw new Error('La selección contiene áreas que ya no existen.');
  const reached=new Set([keepId]),pending=[keepId];
  while(pending.length){const id=pending.pop()!;neighbors(project,id).forEach(t=>{if(chosen.has(t.id)&&!reached.has(t.id)){reached.add(t.id);pending.push(t.id);}});}
  if(project.version<6&&reached.size!==chosen.size)throw new Error('Las áreas deben estar conectadas por aristas para formar una sola pieza.');
  if(project.version>=5){const polys=union(selected.flatMap(t=>polygonsOf(project,t)));if(project.version<6&&polys.length!==1)throw new Error('Las áreas deben formar una pieza conectada.');const p=structuredClone(project);p.territories=p.territories.filter(t=>t.id===keepId||!chosen.has(t.id));const merged=p.territories.find(t=>t.id===keepId)!;delete merged.holes;delete merged.components;Object.assign(merged,addMultiPolygon(p,polys),{label:multiLabel(polys)});normalizeTopology(p);cleanGroups(p);if(!validGeometry(p))throw new Error('La unión no conserva el terreno.');return p;}
  const directed=new Map<string,[string,string]>();
  for(const t of selected)t.vertices.forEach((a,i)=>{const b=t.vertices[(i+1)%t.vertices.length],key=edgeKey(a,b);if(directed.has(key))directed.delete(key);else directed.set(key,[a,b]);});
  const remaining=[...directed.values()],outgoing=new Map<string,string>();
  remaining.forEach(([a,b])=>{if(outgoing.has(a))throw new Error('La unión no forma un contorno simple.');outgoing.set(a,b);});
  const ring:string[]=[],start=remaining[0]?.[0];let current=start;
  do {if(!current||ring.includes(current))throw new Error('La unión no forma un contorno simple.');ring.push(current);current=outgoing.get(current)!;}while(current!==start);
  if(ring.length!==remaining.length)throw new Error('La fusión produciría un hueco o varios contornos; todavía no se admite.');
  const p=structuredClone(project);p.territories=p.territories.filter(t=>t.id===keepId||!chosen.has(t.id));
  const merged=p.territories.find(t=>t.id===keepId)!;merged.vertices=ring;merged.label=interiorPoint(p,ring);
  const used=new Set(p.territories.flatMap(t=>t.vertices));Object.keys(p.vertices).forEach(id=>{if(!used.has(id))delete p.vertices[id];});
  cleanGroups(p);assertResult(p);return p;
}
