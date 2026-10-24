import {partitionTerritory,replacePaintTerritory} from './paint';
import {multiLabel,polygonsOf,rings,setRings} from './polygons';
import type { MapProject, Point } from '../model/types';
import { divideArea, interiorPoint } from './areas';
import { area, distanceToSegment, edgeKey, edges, validGeometry } from './topology';
import { pointInPolygon } from './selection';

type Hit={point:Point;edge:number;along:number};
export type SubdivisionOptions={irregularity?:number;segments?:number;endpoints?:'free'|'vertices'};
type Candidate={a:Point;b:Point;score:number;partsA?:number;partsB?:number};
const perimeter=(points:Point[])=>points.reduce((sum,p,i)=>sum+Math.hypot(p.x-points[(i+1)%points.length].x,p.y-points[(i+1)%points.length].y),0);
/** Find straight interior chords without assuming the face is convex. */
function candidates(p:MapProject,id:string,fraction:number) {
  const ids=p.territories.find(t=>t.id===id)!.vertices,points=ids.map(id=>p.vertices[id]),total=area(points);
  const result:Candidate[]=[];
  for(let direction=0;direction<16;direction++) {
    const angle=direction*Math.PI/16;
    const nx=Math.cos(angle),ny=Math.sin(angle),projections=points.map(v=>v.x*nx+v.y*ny),min=Math.min(...projections),max=Math.max(...projections);
    for(let sample=1;sample<32;sample++) {
      const offset=min+(max-min)*sample/32,hits:Hit[]=[];
      points.forEach((a,i)=>{const b=points[(i+1)%points.length],den=(b.x-a.x)*nx+(b.y-a.y)*ny;if(Math.abs(den)<1e-9)return;
        const t=(offset-a.x*nx-a.y*ny)/den;if(t<-1e-8||t>1+1e-8)return;
        const q={x:a.x+Math.max(0,Math.min(1,t))*(b.x-a.x),y:a.y+Math.max(0,Math.min(1,t))*(b.y-a.y)};
        if(!hits.some(h=>Math.hypot(h.point.x-q.x,h.point.y-q.y)<1e-6))hits.push({point:q,edge:i,along:-q.x*ny+q.y*nx});
      });hits.sort((a,b)=>a.along-b.along);
      for(let h=0;h+1<hits.length;h++) {
        const a=hits[h],b=hits[h+1];if(a.edge===b.edge||!pointInPolygon({x:(a.point.x+b.point.x)/2,y:(a.point.y+b.point.y)/2},points))continue;
        const ring=[a.point];for(let i=(a.edge+1)%points.length;i!==(b.edge+1)%points.length;i=(i+1)%points.length)ring.push(points[i]);ring.push(b.point);
        const size=area(ring);if(size<1||total-size<1)continue;
        const other=[b.point];for(let i=(b.edge+1)%points.length;i!==(a.edge+1)%points.length;i=(i+1)%points.length)other.push(points[i]);other.push(a.point);
        // Penalize long perimeters as well as unequal areas. An area-only score
        // tends to choose diagonal cuts that leave thin triangular pieces.
        const compactness=(perimeter(ring)**2/size+perimeter(other)**2/(total-size))/(8*Math.PI);
        result.push({a:a.point,b:b.point,score:3*Math.abs(Math.min(size,total-size)/total-fraction)+.65*compactness});
      }
    }
  }return result.sort((a,b)=>a.score-b.score);
}
/** Diagonals use only existing vertices, never inserting points on the outline. */
function vertexCandidates(p:MapProject,id:string,parts:number):Candidate[] {
  const points=p.territories.find(t=>t.id===id)!.vertices.map(v=>p.vertices[v]),n=points.length,total=area(points);
  const crossSum=[0],lengthSum=[0],result:Candidate[]=[];
  for(let i=0;i<n;i++) {
    const a=points[i],b=points[(i+1)%n];
    crossSum.push(crossSum[i]+a.x*b.y-b.x*a.y);
    lengthSum.push(lengthSum[i]+Math.hypot(b.x-a.x,b.y-a.y));
  }
  const small=Math.floor(parts/2),large=parts-small;
  for(let i=0;i<n;i++)for(let j=i+2;j<n;j++) {
    if(i===0&&j===n-1)continue;
    const a=points[i],b=points[j],size=(crossSum[j]-crossSum[i]+b.x*a.y-a.x*b.y)/2,other=total-size;
    if(size<1||other<1)continue;
    const capacityA=j-i-1,capacityB=n-(j-i)-1;
    const assignments=small===large?[[small,large]]:[[small,large],[large,small]];
    for(const [partsA,partsB] of assignments) {
      if(partsA>capacityA||partsB>capacityB||size<partsA||other<partsB)continue;
      const chord=Math.hypot(b.x-a.x,b.y-a.y),boundary=lengthSum[j]-lengthSum[i];
      const compactness=((boundary+chord)**2/size+(lengthSum[n]-boundary+chord)**2/other)/(8*Math.PI);
      result.push({a,b,partsA,partsB,score:3*Math.abs(size/total-partsA/parts)+.65*compactness});
    }
  }
  // The full topology validator in divideArea rejects diagonals outside concavities.
  return result.sort((a,b)=>a.score-b.score);
}
/** Shape only the new internal edges; the source outline and neighbors stay fixed. */
export function organicBoundaries(source:MapProject,ids:string[],options:SubdivisionOptions):MapProject {
  const irregularity=Math.max(0,Math.min(1,options.irregularity??.75));
  const segments=Math.max(1,Math.min(12,Math.round(options.segments??8)));
  if(!Number.isFinite(irregularity)||!Number.isFinite(segments))throw new Error('Los controles de división deben ser números válidos.');
  const selected=new Set(ids),uses=new Map<string,number>();
  source.territories.filter(t=>selected.has(t.id)).forEach(t=>rings(t).forEach(r=>r.forEach((a,i)=>{const key=edgeKey(a,r[(i+1)%r.length]);uses.set(key,(uses.get(key)??0)+1);})) );
  const allEdges=edges(source),chains=new Map<string,string[]>(),p=structuredClone(source);
  const displaced:{id:string;base:Point;dx:number;dy:number}[]=[];
  let serial=0;
  allEdges.forEach(([a,b],index)=>{
    if(uses.get(edgeKey(a,b))!==2)return;
    const A=source.vertices[a],B=source.vertices[b],len=Math.hypot(B.x-A.x,B.y-A.y),chain:string[]=[];
    const sign=index%2?1:-1,phase=index*2.3999632297;
    for(let j=1;j<segments;j++) {
      const t=j/segments,base={x:A.x+(B.x-A.x)*t,y:A.y+(B.y-A.y)*t};
      const clearance=Math.min(len*.22,...allEdges.filter(([c,d])=>edgeKey(a,b)!==edgeKey(c,d)).map(([c,d])=>distanceToSegment(base,source.vertices[c],source.vertices[d])));
      // A smooth broad bow with a smaller second wave, sampled as editable nodes.
      const offset=clearance*irregularity*(sign*.8*Math.sin(Math.PI*t)+.2*Math.sin(2*Math.PI*t+phase)*Math.sin(Math.PI*t));
      let id:string;do{id=`curve${serial++}`;}while(p.vertices[id]);
      const dx=-(B.y-A.y)/len*offset,dy=(B.x-A.x)/len*offset;
      p.vertices[id]={x:base.x+dx,y:base.y+dy};displaced.push({id,base,dx,dy});chain.push(id);
    }
    chains.set(edgeKey(a,b),a<b?chain:[...chain].reverse());
  });
  p.territories.forEach(t=>setRings(t,rings(t).map(r=>r.flatMap((a,i)=>{const b=r[(i+1)%r.length],chain=chains.get(edgeKey(a,b));return chain?[a,...(a<b?chain:[...chain].reverse())]:[a];}))));
  if(Object.keys(p.vertices).length>(p.version>=5?12000:3000)||p.territories.some(t=>t.vertices.length>(p.version>=5?2000:500)))throw new Error('Demasiadas aristas para esta división. Reducí el detalle o la cantidad de partes.');
  // Narrow concavities may need a gentler curve. Keep all topology checks active.
  let strength=1;
  while(!validGeometry(p)&&strength>1/64){strength/=2;displaced.forEach(({id,base,dx,dy})=>{p.vertices[id]={x:base.x+dx*strength,y:base.y+dy*strength};});}
  if(!validGeometry(p))return source;
  p.territories.filter(t=>selected.has(t.id)).forEach(t=>{t.label=p.version>=5?multiLabel(polygonsOf(p,t)):interiorPoint(p,t.vertices);});
  return p;
}
export function subdivideArea(project:MapProject,id:string,count:number,options:SubdivisionOptions={}):{project:MapProject;ids:string[]} {
  const original=project.territories.find(t=>t.id===id);
  if(!original)throw new Error('Seleccioná un área para dividir.');
  if(project.version>=5){if(!Number.isInteger(count)||count<2)throw new Error('Elegí al menos dos partes.');const components=partitionTerritory(polygonsOf(project,original),count);const result=replacePaintTerritory(project,id,components.map(p=>p[0]),components);return {...result,project:organicBoundaries(result.project,result.ids,options)};}
  if(!Number.isInteger(count)||count<2)throw new Error('Elegí una cantidad entera de al menos dos partes.');
  if(project.territories.length+count-1>120)throw new Error('La división supera el límite de 120 áreas del mapa.');
  if(options.endpoints==='vertices'&&count>original.vertices.length-2)throw new Error(`Con los ${original.vertices.length} vértices actuales se pueden obtener como máximo ${original.vertices.length-2} partes. Agregá vértices o elegí puntos de corte libres.`);
  if(area(original.vertices.map(v=>project.vertices[v]))<count)throw new Error('El área es demasiado pequeña para esa cantidad de partes.');
  let p=project;const queue=[{id,parts:count}],finished:string[]=[];
  while(queue.length) {
    const task=queue.shift()!;if(task.parts===1){finished.push(task.id);continue;}
    const small=Math.floor(task.parts/2),large=task.parts-small;
    const choices=options.endpoints==='vertices'?vertexCandidates(p,task.id,task.parts):candidates(p,task.id,small/task.parts);
    let split:ReturnType<typeof divideArea>|undefined;
    let allocation:{a:number;b:number}|undefined;
    for(const candidate of choices) {
      try {
        const next=divideArea(p,task.id,candidate.a,candidate.b);
        const A=next.project.territories.find(t=>t.id===task.id)!,B=next.project.territories.find(t=>t.id===next.newId)!;
        const sizeA=area(A.vertices.map(v=>next.project.vertices[v])),sizeB=area(B.vertices.map(v=>next.project.vertices[v]));
        if(Math.min(sizeA,sizeB)<small||Math.max(sizeA,sizeB)<large)continue;
        allocation={a:candidate.partsA??(sizeA<=sizeB?small:large),b:candidate.partsB??(sizeA<=sizeB?large:small)};
        split=next;break;
      }catch{/* Try another chord; the source project remains immutable. */}
    }
    if(!split)throw new Error(options.endpoints==='vertices'?'No se encontró una división válida entre los vértices existentes. Probá menos partes, agregá vértices o elegí puntos de corte libres.':'No se encontró una división válida para esa forma y cantidad. Probá menos partes o un corte manual.');
    p=split.project;
    const A=p.territories.find(t=>t.id===task.id)!,B=p.territories.find(t=>t.id===split!.newId)!;
    queue.push({id:A.id,parts:allocation!.a},{id:B.id,parts:allocation!.b});
  }
  // Give every resulting part a stable, readable name, without renaming neighbors.
  const ordered=[id,...finished.filter(part=>part!==id)];
  p={...p,territories:p.territories.map(t=>{const i=ordered.indexOf(t.id);return i<0?t:{...t,name:`${original.name.slice(0,85)} (${i+1})`};})};
  return {project:organicBoundaries(p,ordered,options),ids:ordered};
}
