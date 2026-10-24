import type {GenerationOptions,MapProject,Point} from '../model/types';
import {generationBounds} from '../model/print';
import {palette} from './generate';
import {area,validGeometry} from './topology';
import {interiorPoint} from './areas';
import {subdivideArea} from './subdivide';
import {pointInPolygon} from './selection';

export type CoastDraft={width:number;height:number;margin:number;landforms:{id:string;name:string;points:Point[];createRegion?:boolean}[]};
export type CoastOptions={islands:number;landScale:number;roughness:number;marginPercent:number;variant:number};
export const coastDefaults:CoastOptions={islands:3,landScale:.85,roughness:.65,marginPercent:6,variant:0};
function random(seed:string){let s=2166136261;for(const c of seed)s=Math.imul(s^c.charCodeAt(0),16777619);return()=>{s+=0x6D2B79F5;let t=Math.imul(s^s>>>15,1|s);t^=t+Math.imul(t^t>>>7,61|t);return ((t^t>>>14)>>>0)/4294967296;};}

/** Disjoint layout boxes guarantee sea channels; radial coast variation stays inside each box. */
export function proposeCoasts(options:GenerationOptions,settings:CoastOptions=coastDefaults):CoastDraft {
  const {width,height}=generationBounds(options),{islands,landScale,roughness,marginPercent,variant}=settings;
  if(!Number.isInteger(islands)||islands<0||islands>8||!Number.isFinite(landScale)||landScale<.4||landScale>1||!Number.isFinite(roughness)||roughness<0||roughness>1||!Number.isFinite(marginPercent)||marginPercent<0||marginPercent>20||!Number.isInteger(variant))throw new Error('Parámetros de geografía inválidos.');
  const margin=Math.min(width,height)*marginPercent/100,pad=Math.min(width,height)*.025,innerW=width-2*margin,innerH=height-2*margin,rng=random(`${options.seed}:coast:${variant}`);
  const landforms:CoastDraft['landforms']=[];
  function mass(id:string,name:string,x:number,y:number,w:number,h:number) {
    const phase=rng()*Math.PI*2,phase2=rng()*Math.PI*2;
    const points=Array.from({length:32},(_,i)=>{const angle=i*Math.PI*2/32;const radius=(.88+.075*roughness*Math.sin(3*angle+phase)+.045*roughness*Math.cos(5*angle+phase2))*landScale;return {x:x+w/2+Math.cos(angle)*w/2*radius,y:y+h/2+Math.sin(angle)*h/2*radius};});
    landforms.push({id,name,points});
  }
  if(!islands)mass('land0','Masa principal',margin,margin,innerW,innerH);
  else {
    mass('land0','Masa principal',margin,margin,innerW*.60-pad,innerH);
    const columns=islands>4?2:1,rows=Math.ceil(islands/columns),cellW=(innerW*.40-pad)/columns,cellH=innerH/rows;
    for(let i=0;i<islands;i++){const col=i%columns,row=Math.floor(i/columns);mass(`land${i+1}`,`Isla ${i+1}`,margin+innerW*.60+pad+col*cellW,margin+row*cellH+pad/2,cellW-pad,cellH-pad);}
  }
  return {width,height,margin,landforms};
}

export function coastDraftFromProject(p:MapProject):CoastDraft|null {
  if(!p.geography)return null;
  return {width:p.width,height:p.height,margin:p.geography.margin,landforms:p.geography.landforms.map(l=>{const points=l.vertices.map(id=>({...p.vertices[id]}));return {id:l.id,name:l.name,points,createRegion:p.territories.some(t=>t.regionId!==null&&pointInPolygon(interiorPoint(p,t.vertices),points))};})};
}
export function coastProject(draft:CoastDraft,options:GenerationOptions,title='Tierras del horizonte'):MapProject {
  if(!draft.landforms.length||draft.landforms.length>12)throw new Error('Definí entre 1 y 12 masas de tierra.');
  const p:MapProject={version:4,title,width:draft.width,height:draft.height,groups:[],vertices:{},territories:[],generation:{...options,segments:options.segments??2},geography:{margin:draft.margin,waterColor:'#b8d7dc',landforms:[]}};
  draft.landforms.forEach((land,i)=>{
    const vertices=land.points.map((point,j)=>{const id=`coast${i}_${j}`;p.vertices[id]={...point};return id;});
    p.geography!.landforms.push({id:land.id,name:land.name,vertices:[...vertices]});
    p.territories.push({id:`landArea${i}`,name:land.name,color:palette[i%palette.length],vertices,label:interiorPoint(p,vertices),surface:'land',regionId:land.createRegion===false?null:`landArea${i}`});
  });
  return p;
}
export function validCoastDraft(draft:CoastDraft,options:GenerationOptions):boolean {
  if(!Number.isFinite(draft.margin)||draft.margin<0||draft.margin>=Math.min(draft.width,draft.height)/2||!Number.isFinite(draft.width)||!Number.isFinite(draft.height)||draft.width<100||draft.height<100||draft.landforms.some(l=>!l.name.trim()||l.name.length>100||l.points.length<3||l.points.length>1000))return false;
  try {return validGeometry(coastProject(draft,options));}catch{return false;}
}

export type MapSide='left'|'right'|'top'|'bottom';
/** Keep the coast facing into the map and continue the other side to its frame.
 * This operates on a draft, before territories exist, and does not move islands.
 */
export function extendLandToFrame(draft:CoastDraft,index:number,side:MapSide,options:GenerationOptions):CoastDraft {
  const next=structuredClone(draft),land=next.landforms[index];
  if(!land)throw new Error('Elegí una masa de tierra.');
  const points=land.points;
  const extreme=(axis:'x'|'y',maximum:boolean)=>points.reduce((best,p,i)=>(maximum?p[axis]>points[best][axis]:p[axis]<points[best][axis])?i:best,0);
  const left=extreme('x',false),right=extreme('x',true),top=extreme('y',false),bottom=extreme('y',true);
  const [start,end]=side==='left'?[top,bottom]:side==='right'?[bottom,top]:side==='top'?[right,left]:[left,right];
  const chain:Point[]=[];for(let i=start;;i=(i+1)%points.length){chain.push({...points[i]});if(i===end)break;}
  const project=(p:Point):Point=>side==='left'?{x:0,y:p.y}:side==='right'?{x:draft.width,y:p.y}:side==='top'?{x:p.x,y:0}:{x:p.x,y:draft.height};
  chain.push(project(points[end]),project(points[start]));
  // Extending an already attached mass can repeat points or leave collinear
  // nodes. Remove these before the shared-topology crossing checks.
  let ring=chain.filter((p,i)=>{const q=chain[(i+1)%chain.length];return Math.hypot(p.x-q.x,p.y-q.y)>1e-7;});
  let removed=true;
  while(removed&&ring.length>3){removed=false;for(let i=0;i<ring.length;i++){const a=ring[(i+ring.length-1)%ring.length],b=ring[i],c=ring[(i+1)%ring.length];if(Math.abs((b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x))<1e-7&&(b.x-a.x)*(c.x-b.x)+(b.y-a.y)*(c.y-b.y)>=0){ring.splice(i,1);removed=true;break;}}}
  land.points=ring;
  if(!validCoastDraft(next,options))throw new Error('Esta prolongación se cruzaría con otra masa o con su propio contorno. Ajustá la geografía antes de continuar.');
  return next;
}

/** Clamp translation to the frame, instead of stopping before an invisible margin. */
export function moveDraftLand(draft:CoastDraft,index:number,delta:Point,vertex:number|null):CoastDraft {
  const next=structuredClone(draft),land=next.landforms[index],points=land.points;
  if(vertex===null){const dx=Math.max(-Math.min(...points.map(p=>p.x)),Math.min(draft.width-Math.max(...points.map(p=>p.x)),delta.x));const dy=Math.max(-Math.min(...points.map(p=>p.y)),Math.min(draft.height-Math.max(...points.map(p=>p.y)),delta.y));land.points=points.map(p=>({x:Math.max(0,Math.min(draft.width,p.x+dx)),y:Math.max(0,Math.min(draft.height,p.y+dy))}));}
  else {const p=points[vertex];land.points[vertex]={x:Math.max(0,Math.min(draft.width,p.x+delta.x)),y:Math.max(0,Math.min(draft.height,p.y+delta.y))};}
  return next;
}
export function allocateTerritories(draft:CoastDraft,total:number):number[] {
  const count=draft.landforms.length;if(!Number.isInteger(total)||total<count||total>120)throw new Error(`Elegí entre ${count} y 120 territorios: al menos uno por masa.`);
  const anyRegional=draft.landforms.some(l=>l.createRegion!==false);
  const sizes=draft.landforms.map(l=>anyRegional&&l.createRegion===false?0:area(l.points)),sum=sizes.reduce((a,b)=>a+b,0),allocation=sizes.map(()=>1);
  for(let k=count;k<total;k++){let best=0;for(let i=1;i<count;i++)if(sizes[i]/sum*total-allocation[i]>sizes[best]/sum*total-allocation[best])best=i;allocation[best]++;}
  return allocation;
}
/** Partition actual land polygons, preserving their coasts and leaving sea entirely unoccupied. */
export function populateGeography(draft:CoastDraft,counts:number[],options:GenerationOptions,title:string):MapProject {
  if(!validCoastDraft(draft,options))throw new Error('Los contornos se cruzan, se superponen o salen del encuadre del mapa.');
  const total=counts.reduce((a,b)=>a+b,0);
  if(counts.length!==draft.landforms.length||counts.some(n=>!Number.isInteger(n)||n<1)||total<4||total>120)throw new Error('Repartí entre 4 y 120 territorios, al menos uno por masa de tierra.');
  let p=coastProject(draft,{...options,count:total},title);
  const initialIds=p.territories.map(t=>t.id);
  for(let i=0;i<counts.length;i++)if(counts[i]>1)p=subdivideArea(p,initialIds[i],counts[i],{endpoints:'free',irregularity:options.irregularity,segments:options.segments??2}).project;
  if(!validGeometry(p))throw new Error('No se pudo generar una división válida. Probá menos territorios.');
  return p;
}
