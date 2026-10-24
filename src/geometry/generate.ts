import { Delaunay } from 'd3-delaunay';
import type { GenerationOptions, MapProject, Point } from '../model/types';
import { area, distanceToSegment, edgeKey, edges } from './topology';
import { generationBounds } from '../model/print';
export const palette=['#b5cbb0','#e5cca1','#b1cdd1','#d7b8ab','#c2bed4','#cfdbb1'];
function random(seed:string) { let s=2166136261; for(const c of seed) s=Math.imul(s^c.charCodeAt(0),16777619); return ()=> {s+=0x6D2B79F5; let t=Math.imul(s^s>>>15,1|s); t^=t+Math.imul(t^t>>>7,61|t); return ((t^t>>>14)>>>0)/4294967296;}; }
export function generate(options:GenerationOptions):MapProject {
  const count=Math.max(4,Math.min(120,Math.round(options.count))), irregularity=Math.max(0,Math.min(1,options.irregularity));
  const segments=Math.max(1,Math.min(6,Math.round(options.segments??2)));
  const rng=random(options.seed), {width,height}=generationBounds(options),margin=Math.min(30,width*.1,height*.1);
  let sites: [number,number][]=Array.from({length:count},()=>[margin+rng()*(width-2*margin),margin+rng()*(height-2*margin)]);
  // Two Lloyd passes prevent tiny slivers while keeping organic variation.
  for(let pass=0;pass<2;pass++) {const v=Delaunay.from(sites).voronoi([0,0,width,height]); sites=sites.map((s,i)=> {const poly=v.cellPolygon(i); if(!poly)return s; const ps=poly.slice(0,-1); return [ps.reduce((n,p)=>n+p[0],0)/ps.length,ps.reduce((n,p)=>n+p[1],0)/ps.length];});}
  const voronoi=Delaunay.from(sites).voronoi([0,0,width,height]);
  const p:MapProject={version:3,groups:[],title:'Tierras del horizonte',width,height,vertices:{},territories:[],generation:{...options,count,irregularity,segments}};
  const canonical=new Map<string,string>();
  function vertex(x:number,y:number) {const key=`${x.toFixed(6)},${y.toFixed(6)}`; let id=canonical.get(key); if(!id){id=`v${canonical.size}`; canonical.set(key,id);p.vertices[id]={x:+x.toFixed(6),y:+y.toFixed(6)};}return id;}
  sites.forEach((s,i)=> {const poly=voronoi.cellPolygon(i)!; let ids=poly.slice(0,-1).map(([x,y])=>vertex(x,y));if(area(ids.map(id=>p.vertices[id]))<0)ids=ids.reverse();p.territories.push({id:`t${i}`,name:`Territorio ${String(i+1).padStart(2,'0')}`,color:palette[i%palette.length],vertices:ids,label:{x:s[0],y:s[1]},surface:'land',regionId:`t${i}`});});
  const originalEdges=edges(p), mids=new Map<string,string[]>();
  originalEdges.forEach(([a,b],i)=> {
    const A=p.vertices[a], B=p.vertices[b];
    const boundary=(A.x===B.x&&(A.x===0||A.x===width))||(A.y===B.y&&(A.y===0||A.y===height));
    if(boundary)return;
    const len=Math.hypot(B.x-A.x,B.y-A.y);
    const ids:string[]=[];
    for(let j=1;j<segments;j++) {
      const m:Point={x:A.x+(B.x-A.x)*j/segments,y:A.y+(B.y-A.y)*j/segments};
      const clearance=Math.min(len/segments,...originalEdges.filter(([c,d])=>edgeKey(a,b)!==edgeKey(c,d)).map(([c,d])=>distanceToSegment(m,p.vertices[c],p.vertices[d])));
      const offset=(rng()*2-1)*clearance*.35*irregularity;
      const id=`m${i}_${j}`;p.vertices[id]={x:m.x-(B.y-A.y)/len*offset,y:m.y+(B.x-A.x)/len*offset};ids.push(id);
    }
    // Both faces must traverse exactly the same chain in opposite directions.
    mids.set(edgeKey(a,b),a<b?ids:[...ids].reverse());
  });
  p.territories.forEach(t=> {t.vertices=t.vertices.flatMap((id,i)=> {const b=t.vertices[(i+1)%t.vertices.length],mid=mids.get(edgeKey(id,b));return mid?[id,...(id<b?mid:[...mid].reverse())]:[id];});});
  return p;
}
