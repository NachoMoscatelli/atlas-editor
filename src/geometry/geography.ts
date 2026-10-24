import type {GenerationOptions,MapProject,Point} from '../model/types';
import {generationBounds} from '../model/print';
import {palette} from './generate';
import {area,validGeometry} from './topology';
import {interiorPoint} from './areas';
import {subdivideArea} from './subdivide';

export type CoastDraft={width:number;height:number;margin:number;landforms:{id:string;name:string;points:Point[]}[]};
export type CoastOptions={islands:number;landScale:number;roughness:number;marginPercent:number;variant:number};
export const coastDefaults:CoastOptions={islands:3,landScale:.85,roughness:.65,marginPercent:6,variant:0};
function random(seed:string){let s=2166136261;for(const c of seed)s=Math.imul(s^c.charCodeAt(0),16777619);return()=>{s+=0x6D2B79F5;let t=Math.imul(s^s>>>15,1|s);t^=t+Math.imul(t^t>>>7,61|t);return ((t^t>>>14)>>>0)/4294967296;};}

/** Disjoint layout boxes guarantee sea channels; radial coast variation stays inside each box. */
export function proposeCoasts(options:GenerationOptions,settings:CoastOptions=coastDefaults):CoastDraft {
  const {width,height}=generationBounds(options),{islands,landScale,roughness,marginPercent,variant}=settings;
  if(!Number.isInteger(islands)||islands<0||islands>8||!Number.isFinite(landScale)||landScale<.4||landScale>1||!Number.isFinite(roughness)||roughness<0||roughness>1||!Number.isFinite(marginPercent)||marginPercent<2||marginPercent>20||!Number.isInteger(variant))throw new Error('Parámetros de geografía inválidos.');
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
  return {width:p.width,height:p.height,margin:p.geography.margin,landforms:p.geography.landforms.map(l=>({id:l.id,name:l.name,points:l.vertices.map(id=>({...p.vertices[id]}))}))};
}
export function coastProject(draft:CoastDraft,options:GenerationOptions,title='Tierras del horizonte'):MapProject {
  if(!draft.landforms.length||draft.landforms.length>12)throw new Error('Definí entre 1 y 12 masas de tierra.');
  const p:MapProject={version:4,title,width:draft.width,height:draft.height,groups:[],vertices:{},territories:[],generation:{...options,segments:options.segments??2},geography:{margin:draft.margin,waterColor:'#b8d7dc',landforms:[]}};
  draft.landforms.forEach((land,i)=>{
    const vertices=land.points.map((point,j)=>{const id=`coast${i}_${j}`;p.vertices[id]={...point};return id;});
    p.geography!.landforms.push({id:land.id,name:land.name,vertices:[...vertices]});
    p.territories.push({id:`landArea${i}`,name:land.name,color:palette[i%palette.length],vertices,label:interiorPoint(p,vertices),surface:'land',regionId:`landArea${i}`});
  });
  return p;
}
export function validCoastDraft(draft:CoastDraft,options:GenerationOptions):boolean {
  if(!Number.isFinite(draft.margin)||draft.margin<=0||draft.margin>=Math.min(draft.width,draft.height)/2||!Number.isFinite(draft.width)||!Number.isFinite(draft.height)||draft.width<100||draft.height<100||draft.landforms.some(l=>!l.name.trim()||l.name.length>100||l.points.length<3||l.points.length>1000))return false;
  try {return validGeometry(coastProject(draft,options));}catch{return false;}
}
export function allocateTerritories(draft:CoastDraft,total:number):number[] {
  const count=draft.landforms.length;if(!Number.isInteger(total)||total<count||total>120)throw new Error(`Elegí entre ${count} y 120 territorios: al menos uno por masa.`);
  const sizes=draft.landforms.map(l=>area(l.points)),sum=sizes.reduce((a,b)=>a+b,0),allocation=sizes.map(()=>1);
  for(let k=count;k<total;k++){let best=0;for(let i=1;i<count;i++)if(sizes[i]/sum*total-allocation[i]>sizes[best]/sum*total-allocation[best])best=i;allocation[best]++;}
  return allocation;
}
/** Partition actual land polygons, preserving their coasts and leaving sea entirely unoccupied. */
export function populateGeography(draft:CoastDraft,counts:number[],options:GenerationOptions,title:string):MapProject {
  if(!validCoastDraft(draft,options))throw new Error('Las costas se cruzan, se superponen o invaden el margen del tablero.');
  const total=counts.reduce((a,b)=>a+b,0);
  if(counts.length!==draft.landforms.length||counts.some(n=>!Number.isInteger(n)||n<1)||total<4||total>120)throw new Error('Repartí entre 4 y 120 territorios, al menos uno por masa de tierra.');
  let p=coastProject(draft,{...options,count:total},title);
  const initialIds=p.territories.map(t=>t.id);
  for(let i=0;i<counts.length;i++)if(counts[i]>1)p=subdivideArea(p,initialIds[i],counts[i],{endpoints:'free',irregularity:options.irregularity,segments:options.segments??2}).project;
  if(!validGeometry(p))throw new Error('No se pudo generar una división válida. Probá menos territorios.');
  return p;
}
