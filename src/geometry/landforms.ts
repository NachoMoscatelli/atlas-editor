import type {PaintDraft} from './paint';
import type {Point} from '../model/types';
import {difference,intersection,multiArea,union} from './polygons';
import type {MultiPolygon} from './polygons';
export const landMeta=(d:PaintDraft)=>d.landMeta??d.land.map((_,i)=>({id:`land${i}`,name:`Masa ${i+1}`,groupId:undefined as string|undefined}));
const tidy=(d:PaintDraft):PaintDraft=>({...d,landGroups:(d.landGroups??[]).filter(g=>landMeta(d).some(m=>m.groupId===g.id))});
/** Paint splits inherit their parent's group; merging preserves the largest overlap. */
export function reconcileLand(before:PaintDraft,after:PaintDraft):PaintDraft {
  const old=landMeta(before),used=new Set<string>();let serial=0;
  const meta=after.land.map(poly=>{let best=-1,size=0;before.land.forEach((previous,i)=>{const overlap=multiArea(intersection([previous],[poly]));if(overlap>size){size=overlap;best=i;}});const parent=best>=0?old[best]:undefined;let id=parent?.id;if(!id||used.has(id)){do{id=`land-${serial++}`;}while(used.has(id)||old.some(m=>m.id===id));}used.add(id);return {id,name:parent?.name??`Masa ${serial}`,...(parent?.groupId?{groupId:parent.groupId}:{})};});
  return tidy({...after,landMeta:meta,landGroups:structuredClone(before.landGroups??[])});
}
export function groupLand(d:PaintDraft,ids:readonly string[],name:string):PaintDraft {
  if(new Set(ids).size<2||ids.some(id=>!landMeta(d).some(m=>m.id===id)))throw new Error('Seleccioná al menos dos masas existentes.');if(!name.trim()||name.trim().length>100)throw new Error('Elegí un nombre de 1 a 100 caracteres.');
  let index=0;while((d.landGroups??[]).some(g=>g.id===`land-group-${index}`))index++;const id=`land-group-${index}`;
  return tidy({...d,landMeta:landMeta(d).map(m=>ids.includes(m.id)?{...m,groupId:id}:{...m}),landGroups:[...d.landGroups??[],{id,name:name.trim()}]});
}
export function ungroupLand(d:PaintDraft,ids:readonly string[]):PaintDraft{return tidy({...d,landMeta:landMeta(d).map(m=>ids.includes(m.id)?{id:m.id,name:m.name}:{...m})});}
export function deleteLand(d:PaintDraft,ids:readonly string[]):PaintDraft {const keep=d.land.map((poly,i)=>({poly,meta:landMeta(d)[i]})).filter(item=>!ids.includes(item.meta.id));return tidy({...d,land:keep.map(x=>x.poly),landMeta:keep.map(x=>x.meta),mountains:intersection(d.mountains,keep.map(x=>x.poly))});}
export function moveLand(d:PaintDraft,ids:readonly string[],delta:Point):PaintDraft {
  const selected=d.land.map((poly,i)=>({poly,chosen:ids.includes(landMeta(d)[i].id)})),moving=selected.filter(p=>p.chosen).map(p=>p.poly),fixed=selected.filter(p=>!p.chosen).map(p=>p.poly);if(!moving.length)return d;
  const coords=moving.flat(2),dx=Math.max(-Math.min(...coords.map(p=>p[0])),Math.min(d.width-Math.max(...coords.map(p=>p[0])),delta.x)),dy=Math.max(-Math.min(...coords.map(p=>p[1])),Math.min(d.height-Math.max(...coords.map(p=>p[1])),delta.y));
  const translate=(m:MultiPolygon):MultiPolygon=>m.map(poly=>poly.map(r=>r.map(([x,y])=>[Math.max(0,Math.min(d.width,x+dx)),Math.max(0,Math.min(d.height,y+dy))])));
  const moved=translate(moving);if(multiArea(intersection(moved,fixed))>.01||union(moved,fixed).length<moved.length+fixed.length)throw new Error('El grupo no puede superponerse ni pegarse a otra masa. Usá el pincel Tierra para unirlas.');
  const mobileMountains=intersection(d.mountains,moving),mountains=union(difference(d.mountains,moving),translate(mobileMountains));let i=0;return {...d,land:selected.map(item=>item.chosen?moved[i++]:item.poly),mountains};
}
export function importLand(d:PaintDraft,source:PaintDraft,name:string):{draft:PaintDraft;ids:string[]} {
  if(!source.land.length)throw new Error('El archivo no contiene masas de tierra.');
  const coords=source.land.flat(2),x0=Math.min(...coords.map(p=>p[0])),y0=Math.min(...coords.map(p=>p[1])),w=Math.max(...coords.map(p=>p[0]))-x0,h=Math.max(...coords.map(p=>p[1]))-y0;
  let placed:MultiPolygon|undefined,mountains:MultiPolygon=[];
  for(const factor of [.65,.45,.25,.12]){const scale=Math.min(d.width*factor/w,d.height*factor/h);for(const [cx,cy] of [[.5,.5],[.2,.2],[.8,.2],[.2,.8],[.8,.8]]){const map=(m:MultiPolygon):MultiPolygon=>m.map(p=>p.map(r=>r.map(([x,y])=>[(x-x0)*scale+cx*d.width-w*scale/2,(y-y0)*scale+cy*d.height-h*scale/2])));const candidate=map(source.land);if(candidate.flat(2).some(([x,y])=>x<0||x>d.width||y<0||y>d.height)||multiArea(intersection(candidate,d.land))>.01)continue;placed=candidate;mountains=map(source.mountains);break;}if(placed)break;}
  if(!placed)throw new Error('No hay espacio libre para importar este conjunto. Liberá una zona de agua.');if(d.land.length+placed.length>80)throw new Error('Se supera el límite de 80 masas.');
  const existing=landMeta(d);let n=0;const ids=placed.map(()=>{let id:string;do{id=`import-land-${n++}`;}while(existing.some(m=>m.id===id));return id;});
  let gid=0;while((d.landGroups??[]).some(g=>g.id===`import-group-${gid}`))gid++;const groupId=`import-group-${gid}`;
  return {ids,draft:{...d,land:[...d.land,...placed],mountains:union(d.mountains,mountains),landMeta:[...existing,...ids.map((id,i)=>({id,name:landMeta(source)[i]?.name??`Isla ${i+1}`,groupId}))],landGroups:[...d.landGroups??[],{id:groupId,name:name.trim().slice(0,100)||'Archipiélago importado'}]}};
}
