import type { MapProject, Point } from '../model/types';
export const edgeKey = (a: string, b: string) => [a,b].sort().join(':');
export function edges(p: MapProject) {
  const result = new Map<string, [string,string]>();
  p.territories.forEach(t => t.vertices.forEach((a,i) => { const b=t.vertices[(i+1)%t.vertices.length]; result.set(edgeKey(a,b),[a,b]); }));
  return [...result.values()];
}
export function area(points: Point[]) { return points.reduce((sum,a,i)=> { const b=points[(i+1)%points.length]; return sum+a.x*b.y-b.x*a.y; },0)/2; }
const cross = (a:Point,b:Point,c:Point)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
function onSegment(a:Point,b:Point,c:Point) { return Math.abs(cross(a,b,c))<1e-7 && c.x>=Math.min(a.x,b.x)-1e-7 && c.x<=Math.max(a.x,b.x)+1e-7 && c.y>=Math.min(a.y,b.y)-1e-7 && c.y<=Math.max(a.y,b.y)+1e-7; }
function intersects(a:Point,b:Point,c:Point,d:Point) {
  return (cross(a,b,c)*cross(a,b,d)<0 && cross(c,d,a)*cross(c,d,b)<0) || onSegment(a,b,c)||onSegment(a,b,d)||onSegment(c,d,a)||onSegment(c,d,b);
}
export function validGeometry(p:MapProject) {
  if(Object.values(p.vertices).some(v=>!Number.isFinite(v.x)||!Number.isFinite(v.y)||v.x<0||v.y<0||v.x>p.width||v.y>p.height)) return false;
  if(p.territories.some(t=>area(t.vertices.map(id=>p.vertices[id]))<1)) return false;
  const es=edges(p);
  for(let i=0;i<es.length;i++) for(let j=i+1;j<es.length;j++) {
    const [a,b]=es[i], [c,d]=es[j];
    if(a===c||a===d||b===c||b===d) {
      const common=a===c||a===d?a:b, one=a===common?b:a, two=c===common?d:c;
      if(onSegment(p.vertices[common],p.vertices[one],p.vertices[two])||onSegment(p.vertices[common],p.vertices[two],p.vertices[one])) return false;
    } else if(intersects(p.vertices[a],p.vertices[b],p.vertices[c],p.vertices[d])) return false;
  }
  return true;
}
export function distanceToSegment(p:Point,a:Point,b:Point) {
  const l=(b.x-a.x)**2+(b.y-a.y)**2;
  const t=l?Math.max(0,Math.min(1,((p.x-a.x)*(b.x-a.x)+(p.y-a.y)*(b.y-a.y))/l)):0;
  return Math.hypot(p.x-a.x-t*(b.x-a.x),p.y-a.y-t*(b.y-a.y));
}
export function pathFor(p:MapProject,ids:string[]) {return ids.map((id,i)=>`${i?'L':'M'}${p.vertices[id].x},${p.vertices[id].y}`).join(' ')+' Z';}
