import clipping from 'polygon-clipping';
import type {MultiPolygon,Polygon,Pair} from 'polygon-clipping';
import type {MapProject,Point,Ringed} from '../model/types';
export type {MultiPolygon,Polygon,Pair};
export const rings=(shape:Ringed)=>[shape.vertices,...shape.holes??[],...(shape.components??[]).flatMap(c=>[c.vertices,...c.holes??[]])];
export const polygonOf=(p:MapProject,shape:Ringed):Polygon=>[shape.vertices,...shape.holes??[]].map(r=>r.map(id=>[p.vertices[id].x,p.vertices[id].y] as Pair));
export const polygonsOf=(p:MapProject,shape:Ringed):MultiPolygon=>[polygonOf(p,shape),...(shape.components??[]).map(c=>polygonOf(p,c))];
const ringArea=(r:Pair[])=>r.reduce((s,a,i)=>{const b=r[(i+1)%r.length];return s+a[0]*b[1]-b[0]*a[1];},0)/2;
export const polygonArea=(p:Polygon)=>Math.abs(ringArea(p[0]))-p.slice(1).reduce((s,r)=>s+Math.abs(ringArea(r)),0);
export const multiArea=(m:MultiPolygon)=>m.reduce((s,p)=>s+polygonArea(p),0);
export const union=(...m:MultiPolygon[]):MultiPolygon=>m.some(x=>x.length)?clipping.union(m.find(x=>x.length)!,...m.filter(x=>x.length).slice(1)):[];
export const difference=(a:MultiPolygon,b:MultiPolygon):MultiPolygon=>!a.length?[]:!b.length?clipping.union(a):clipping.difference(a,b);
export const intersection=(a:MultiPolygon,b:MultiPolygon):MultiPolygon=>!a.length||!b.length?[]:clipping.intersection(a,b);
export const frame=(width:number,height:number):MultiPolygon=>[[[[0,0],[width,0],[width,height],[0,height]]]];
export function polygonPath(poly:Polygon):string {return poly.map(r=>r.map(([x,y],i)=>`${i?'L':'M'}${x},${y}`).join(' ')+' Z').join(' ');}
export function contains(poly:Polygon,q:Point) {
  const inRing=(r:Pair[])=>{let inside=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],b=r[j];if((a[1]>q.y)!==(b[1]>q.y)&&q.x<(b[0]-a[0])*(q.y-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;};
  return inRing(poly[0])&&!poly.slice(1).some(inRing);
}
/** Scan all rings together so the label cannot land in a lake or a mountain. */
export function polygonLabel(poly:Polygon):Point {
  const ys=poly[0].map(v=>v[1]),min=Math.min(...ys),max=Math.max(...ys);let best:Point={x:poly[0][0][0],y:poly[0][0][1]},score=-1;
  for(let k=0;k<64;k++){const y=min+(max-min)*(k+.5)/64,xs:number[]=[];poly.forEach(r=>r.forEach((a,i)=>{const b=r[(i+1)%r.length];if((a[1]>y)!==(b[1]>y))xs.push(a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1]));}));xs.sort((a,b)=>a-b);for(let i=0;i+1<xs.length;i+=2){const width=xs[i+1]-xs[i];if(width>score){score=width;best={x:(xs[i]+xs[i+1])/2,y};}}}return best;
}
export function multiLabel(polys:MultiPolygon):Point{return polygonLabel(polys.reduce((best,poly)=>polygonArea(poly)>polygonArea(best)?poly:best));}
export function setRings(shape:Ringed,rs:string[][]){const shapes=[shape,...shape.components??[]];let index=0;for(const s of shapes){const size=1+(s.holes?.length??0);s.vertices=rs[index];if(size>1)s.holes=rs.slice(index+1,index+size);else delete s.holes;index+=size;}}
export function addMultiPolygon(p:MapProject,polys:MultiPolygon):Ringed{const sorted=[...polys].sort((a,b)=>polygonArea(b)-polygonArea(a));const first=addPolygon(p,sorted[0]);return {...first,...(sorted.length>1?{components:sorted.slice(1).map(poly=>addPolygon(p,poly))}:{})};}
export function allShapes(p:MapProject):Ringed[]{return [...p.territories,...p.geography?.landforms??[],...p.geography?.mountains??[]];}
/** Node every boundary at the same coordinates, including coasts and barriers.
 * Boolean clipping removes collinear points; restore these across incident rings.
 */
export function normalizeTopology(p:MapProject) {
  const shapes=allShapes(p),canonical=new Map<string,string>(),coords:Record<string,Point>={},remap=new Map<string,string>();
  for(const shape of shapes)for(const ring of rings(shape))for(const old of ring){const q=p.vertices[old],key=`${q.x.toFixed(6)},${q.y.toFixed(6)}`;let id=canonical.get(key);if(!id){id=`v${canonical.size}`;canonical.set(key,id);coords[id]={x:+q.x.toFixed(6),y:+q.y.toFixed(6)};}remap.set(old,id);}
  for(const shape of shapes)setRings(shape,rings(shape).map(r=>r.map(id=>remap.get(id)!)));
  const points=Object.entries(coords);
  for(const shape of shapes)setRings(shape,rings(shape).map(r=>r.flatMap((id,i)=>{const next=r[(i+1)%r.length],a=coords[id],b=coords[next],dx=b.x-a.x,dy=b.y-a.y,len=dx*dx+dy*dy;
    const mid=points.flatMap(([key,q])=>{if(key===id||key===next||!len)return [];const u=((q.x-a.x)*dx+(q.y-a.y)*dy)/len;if(u<=1e-8||u>=1-1e-8)return [];return Math.hypot(q.x-a.x-u*dx,q.y-a.y-u*dy)<2e-6?[{key,u}]:[];}).sort((x,y)=>x.u-y.u);return [id,...mid.map(x=>x.key)];})));
  p.vertices=coords;
}
export function addPolygon(p:MapProject,poly:Polygon):Ringed {let n=Object.keys(p.vertices).length;const rs=poly.map((r,i)=>{let points=r.filter((q,j)=>j===0||q[0]!==r[j-1][0]||q[1]!==r[j-1][1]);if(points.length>1&&points[0][0]===points.at(-1)![0]&&points[0][1]===points.at(-1)![1])points=points.slice(0,-1);if((ringArea(points)>0)!==(i===0))points=[...points].reverse();return points.map(([x,y])=>{let id=`new${n++}`;while(p.vertices[id])id=`new${n++}`;p.vertices[id]={x,y};return id;});});return {vertices:rs[0],...(rs.length>1?{holes:rs.slice(1)}:{})};}

/** v5 coverage is land minus mountain surfaces, independently of region IDs. */
export function validPaintCoverage(p:MapProject):boolean {
  try {
    const g=p.geography;if(!g)return false;
    const check=(s:Ringed)=>{const polys=polygonsOf(p,s);if(polys.some(poly=>poly.some((r,i)=>r.length<3||Math.abs(ringArea(r))<1e-7||(ringArea(r)>0)!==(i===0))))return false;return Math.abs(multiArea(clipping.union(polys))-multiArea(polys))<.01;};
    if(!allShapes(p).every(check))return false;
    const rawLand=g.landforms.map(l=>polygonOf(p,l)),land=union(rawLand),rawMount=(g.mountains??[]).map(l=>polygonOf(p,l)),mount=union(rawMount);
    if(Math.abs(multiArea(rawLand)-multiArea(land))>.02||Math.abs(multiArea(rawMount)-multiArea(mount))>.02||multiArea(difference(mount,land))>.02)return false;
    if(p.stage==='terrain')return p.territories.length===0&&p.groups.length===0;
    const available=difference(land,mount),parts=p.territories.flatMap(t=>polygonsOf(p,t)),total=union(parts);
    return Math.abs(multiArea(parts)-multiArea(total))<.02&&multiArea(difference(total,available))+multiArea(difference(available,total))<.03;
  }catch{return false;}
}
