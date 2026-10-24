import type { MapProject } from '../model/types';
import { area, edges, edgeKey, validGeometry } from '../geometry/topology';
import { validatePrintSize } from '../model/print';
export const serializeProject=(p:MapProject)=>JSON.stringify(p,null,2);
export function parseProject(source:string):MapProject {
  if(source.length>3_000_000)throw new Error('El archivo supera el límite de 3 MB.');
  const raw=JSON.parse(source);
  if(raw?.version===1) {
    if(!Array.isArray(raw.territories)||!raw.generation)throw new Error('Proyecto v1 inválido.');
    raw.territories=raw.territories.map((t:Record<string,unknown>)=>({...t,surface:'land',regionId:t?.id}));
    raw.generation={...raw.generation,segments:2};raw.version=2;
  }
  if(raw?.version===2){raw.version=3;raw.groups=[];}
  const p=raw as MapProject;
  const point=(v:unknown):boolean=>!!v&&typeof v==='object'&&Number.isFinite((v as {x:number}).x)&&Number.isFinite((v as {y:number}).y);
  if(!p||p.version!==3||typeof p.title!=='string'||p.title.length>150||!Number.isFinite(p.width)||!Number.isFinite(p.height)||p.width<100||p.height<100||p.width>10000||p.height>10000)throw new Error('Formato o versión de proyecto incompatible.');
  if(!p.vertices||typeof p.vertices!=='object'||Array.isArray(p.vertices)||Object.keys(p.vertices).length>3000||!Object.values(p.vertices).every(point)||!Array.isArray(p.territories)||p.territories.length<1||p.territories.length>120)throw new Error('Malla inválida o demasiado grande.');
  const ids=new Set<string>();
  if(!Array.isArray(p.groups)||p.groups.length>120)throw new Error('Grupos inválidos.');
  const groups=new Set<string>();
  for(const g of p.groups){if(!g||typeof g.id!=='string'||!g.id||g.id.length>80||groups.has(g.id)||typeof g.name!=='string'||!g.name.trim()||g.name.length>100||!/^#[0-9a-f]{6}$/i.test(g.color)||(g.keepSingle!==undefined&&g.keepSingle!==true))throw new Error('Grupo inválido.');groups.add(g.id);}
  for(const t of p.territories) {
    if(!t||typeof t.id!=='string'||ids.has(t.id)||typeof t.name!=='string'||t.name.length>100||!/^#[0-9a-f]{6}$/i.test(t.color)||!point(t.label)||!Array.isArray(t.vertices)||t.vertices.length<3||t.vertices.length>500||new Set(t.vertices).size!==t.vertices.length||!t.vertices.every(id=>typeof id==='string'&&Object.hasOwn(p.vertices,id)))throw new Error('Territorios inválidos.');
    ids.add(t.id);
    if(!['land','water'].includes(t.surface)||(t.regionId!==null&&t.regionId!==t.id&&!groups.has(t.regionId)))throw new Error('Superficie o asignación de región inválida.');
  }
  if(p.groups.some(g=>ids.has(g.id)||p.territories.filter(t=>t.regionId===g.id).length<(g.keepSingle?1:2)))throw new Error('Cada grupo debe tener al menos dos áreas, o una identidad de región con un territorio, y un identificador propio.');
  if(!p.generation||!Number.isInteger(p.generation.count)||p.generation.count<4||p.generation.count>120||typeof p.generation.seed!=='string'||p.generation.seed.length>150||!Number.isFinite(p.generation.irregularity)||p.generation.irregularity<0||p.generation.irregularity>1)throw new Error('Parámetros de generación inválidos.');
  if(!Number.isInteger(p.generation.segments)||p.generation.segments!<1||p.generation.segments!>6)throw new Error('Detalle de fronteras inválido.');
  validatePrintSize(p.generation);
  const incidence=new Map<string,number>();
  p.territories.forEach(t=>t.vertices.forEach((a,i)=>{const key=[a,t.vertices[(i+1)%t.vertices.length]].sort().join(':');incidence.set(key,(incidence.get(key)||0)+1);}));
  const boundary=(a:{x:number;y:number},b:{x:number;y:number})=>(a.x===b.x&&(a.x===0||a.x===p.width))||(a.y===b.y&&(a.y===0||a.y===p.height));
  const invalidBoundary=edges(p).some(([a,b])=>incidence.get(edgeKey(a,b))===1&&!boundary(p.vertices[a],p.vertices[b]));
  const totalArea=p.territories.reduce((n,t)=>n+area(t.vertices.map(id=>p.vertices[id])),0);
  if(invalidBoundary||Math.abs(totalArea-p.width*p.height)>.1||[...incidence.values()].some(n=>n>2)||!validGeometry(p))throw new Error('La malla contiene cruces, huecos, solapamientos o coordenadas inválidas.');
  return p;
}
export function download(content:string|Blob,name:string,mime='application/json') {
  const url=URL.createObjectURL(content instanceof Blob?content:new Blob([content],{type:mime}));
  const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
const KEY='atlas.project.v3';
export function loadLocal():MapProject|null {try{const s=localStorage.getItem(KEY)??localStorage.getItem('atlas.project.v2')??localStorage.getItem('atlas.project.v1');return s?parseProject(s):null;}catch{return null;}}
export function saveLocal(p:MapProject) {localStorage.setItem(KEY,serializeProject(p));}
