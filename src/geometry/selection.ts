import {contains,polygonsOf,rings} from './polygons';
import type { MapProject, Point } from '../model/types';
import { edgeKey, distanceToSegment } from './topology';

/** Boundary of a selection, including holes and disconnected components. */
export function selectionBoundary(p:MapProject,ids:readonly string[]) {
  const chosen=new Set(ids),boundary=new Map<string,[string,string]>();
  p.territories.filter(t=>chosen.has(t.id)).forEach(t=>rings(t).forEach(r=>r.forEach((a,i)=>{const b=r[(i+1)%r.length],key=edgeKey(a,b);if(boundary.has(key))boundary.delete(key);else boundary.set(key,[a,b]);})));
  return [...boundary.values()];
}
export function selectionPath(p:MapProject,ids:readonly string[]) {
  return selectionBoundary(p,ids).map(([a,b])=>`M${p.vertices[a].x},${p.vertices[a].y} L${p.vertices[b].x},${p.vertices[b].y}`).join(' ');
}
export function pointInPolygon(point:Point,polygon:readonly Point[]) {
  if(polygon.length<3)return false;let inside=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
    const a=polygon[j],b=polygon[i];
    if(distanceToSegment(point,a,b)<1e-7)return true;
    if((a.y>point.y)!==(b.y>point.y)&&point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
  }return inside;
}
export function lassoHasArea(points:readonly Point[]) {
  if(points.length<3)return false;const a=points[0],b=points.find(p=>Math.hypot(p.x-a.x,p.y-a.y)>1e-6);
  return !!b&&points.some(c=>Math.abs((b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x))>1e-6);
}
export function areasInLasso(p:MapProject,points:readonly Point[]):string[] {
  if(points.length<2||!points.some(q=>Math.hypot(q.x-points[0].x,q.y-points[0].y)>1e-7))return [];
  const closed=lassoHasArea(points);
  const segments=points.slice(1).map((b,i)=>[points[i],b] as const);
  if(closed)segments.push([points.at(-1)!,points[0]]);
  return p.territories.filter(t=>{
    const polygon=t.vertices.map(id=>p.vertices[id]),all=rings(t).map(r=>r.map(id=>p.vertices[id]));
    if(points.some(q=>t.holes?.length||t.components?.length?polygonsOf(p,t).some(poly=>contains(poly,q)):pointInPolygon(q,polygon)))return true;
    if(closed&&all.some(r=>r.some(q=>pointInPolygon(q,points))))return true;
    return all.some(r=>r.some((a,i)=>segments.some(([c,d])=>segmentsTouch(a,r[(i+1)%r.length],c,d))));
  }).map(t=>t.id);
}
function segmentsTouch(a:Point,b:Point,c:Point,d:Point) {
  const eps=1e-7;
  if(Math.max(a.x,b.x)+eps<Math.min(c.x,d.x)||Math.max(c.x,d.x)+eps<Math.min(a.x,b.x)||Math.max(a.y,b.y)+eps<Math.min(c.y,d.y)||Math.max(c.y,d.y)+eps<Math.min(a.y,b.y))return false;
  if(distanceToSegment(a,c,d)<=eps||distanceToSegment(b,c,d)<=eps||distanceToSegment(c,a,b)<=eps||distanceToSegment(d,a,b)<=eps)return true;
  const cross=(A:Point,B:Point,C:Point)=>(B.x-A.x)*(C.y-A.y)-(B.y-A.y)*(C.x-A.x);
  return cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0;
}
export function addSelection(current:readonly string[],added:readonly string[]) {return [...new Set([...current,...added])];}
