import {organicBoundaries} from './subdivide';
import type {GenerationOptions,MapProject,Point,Territory} from '../model/types';
import {generationBounds} from '../model/print';
import {palette} from './generate';
import {addPolygon,allShapes,contains,difference,frame,intersection,multiArea,normalizeTopology,polygonArea,polygonLabel,polygonOf,rings,union} from './polygons';
import type {MultiPolygon,Pair,Polygon} from './polygons';
export type PaintTool='land'|'water'|'mountain';
export type PaintDraft={width:number;height:number;land:MultiPolygon;mountains:MultiPolygon};
export const emptyPaint=(o:GenerationOptions):PaintDraft=>({...generationBounds(o),land:[],mountains:[]});
export function paintFromProject(p:MapProject):PaintDraft {
  return {width:p.width,height:p.height,land:union(p.geography?p.geography.landforms.map(l=>polygonOf(p,l)):p.territories.filter(t=>t.surface==='land').map(t=>polygonOf(p,t))),mountains:union((p.geography?.mountains??[]).map(l=>polygonOf(p,l)))};
}
// Brush caps are polygons, never display-only strokes. Closed strokes preserve
// their center as land, so a ring of water creates a separate physical island.
function strokePolygon(points:Point[],width:number):MultiPolygon {
  const r=width/2,parts:MultiPolygon=[];
  for(const q of points)parts.push([Array.from({length:16},(_,i)=>[q.x+Math.cos(i*Math.PI/8)*r,q.y+Math.sin(i*Math.PI/8)*r] as Pair)]);
  for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],len=Math.hypot(b.x-a.x,b.y-a.y);if(!len)continue;const x=-(b.y-a.y)/len*r,y=(b.x-a.x)/len*r;parts.push([[[a.x+x,a.y+y],[a.x-x,a.y-y],[b.x-x,b.y-y],[b.x+x,b.y+y]]]);}
  return union(...parts.map(p=>p.map(r=>r.map(([x,y])=>[+x.toFixed(6),+y.toFixed(6)] as Pair))).map(p=>[p]));
}
function clean(m:MultiPolygon):MultiPolygon {return m.filter(p=>polygonArea(p)>=1).sort((a,b)=>polygonArea(b)-polygonArea(a));}
export function paintStroke(draft:PaintDraft,tool:PaintTool,points:readonly Point[],width:number):PaintDraft {
  if(!points.length||points.length>2048||points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y))||!Number.isFinite(width)||width<=0)throw new Error('El trazo no es válido.');
  if(tool==='land'&&(points.length<3||Math.abs(points.reduce((s,a,i)=>{const b=points[(i+1)%points.length];return s+a.x*b.y-b.x*a.y;},0))<2))throw new Error('Rodeá una superficie de tierra y soltá para cerrar el contorno.');
  const shape=intersection(tool==='land'?[[points.map(p=>[p.x,p.y] as Pair)]]:strokePolygon([...points],width),frame(draft.width,draft.height));
  const land=clean(tool==='land'?union(draft.land,shape):tool==='water'?difference(draft.land,shape):draft.land);
  const mountains=clean(intersection(tool==='mountain'?union(draft.mountains,intersection(shape,land)):difference(draft.mountains,shape),land));
  if(land.length>80||mountains.length>120||[...land,...mountains].reduce((n,p)=>n+p.reduce((s,r)=>s+r.length,0),0)>9000)throw new Error('El dibujo tiene demasiado detalle. Deshacé o usá un pincel más ancho.');
  return {width:draft.width,height:draft.height,land,mountains};
}
export const occupiable=(d:PaintDraft,index:number)=>clean(difference([d.land[index]],d.mountains));
export function allocatePaint(d:PaintDraft,total:number):number[]{const minimum=d.land.map((_,i)=>occupiable(d,i).length),sizes=d.land.map((_,i)=>multiArea(occupiable(d,i))),sum=sizes.reduce((a,b)=>a+b,0),counts=[...minimum];for(let n=counts.reduce((a,b)=>a+b,0);n<total&&sum>0;n++){let best=0;for(let i=1;i<counts.length;i++)if(sizes[i]/sum*total-counts[i]>sizes[best]/sum*total-counts[best])best=i;counts[best]++;}return counts;}
/** Balanced recursive spatial cuts support holes and concave coastlines. Every
 * connected fragment receives a territory; barriers are never filled to hit a count.
 */
export function partitionPolygons(source:MultiPolygon,count:number):Polygon[] {
  if(!Number.isInteger(count)||count<source.length||count>120)throw new Error(`Se necesitan al menos ${source.length} áreas para cubrir las partes separadas por agua o montañas.`);
  let parts=source.map(p=>structuredClone(p));
  while(parts.length<count){const order=parts.map((p,i)=>({p,i,size:polygonArea(p)})).sort((a,b)=>b.size-a.size);let split=false;
    for(const item of order){const xs=item.p[0].map(p=>p[0]),ys=item.p[0].map(p=>p[1]),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
      const axes=(x1-x0>=y1-y0?['x','y']:['y','x']) as ('x'|'y')[];
      for(const axis of axes){const min=axis==='x'?x0:y0,max=axis==='x'?x1:y1;let low=min,high=max;
        const cut=(at:number)=>axis==='x'?frame(at+20000,40000).map(poly=>poly.map(r=>r.map(([x,y])=>[x-20000,y-20000] as Pair))):frame(40000,at+20000).map(poly=>poly.map(r=>r.map(([x,y])=>[x-20000,y-20000] as Pair)));
        for(let k=0;k<24;k++){const mid=(low+high)/2;if(multiArea(intersection([item.p],cut(mid)))<item.size/2)low=mid;else high=mid;}
        // Try nearby offsets when a cut would create more disconnected fragments
        // than the requested remaining count can accommodate.
        for(const fraction of [((low+high)/2-min)/(max-min),.4,.6,.3,.7]){const mask=cut(min+(max-min)*fraction),a=clean(intersection([item.p],mask)),b=clean(difference([item.p],mask)),next=[...a,...b];
          if(!a.length||!b.length||parts.length-1+next.length>count||next.some(p=>polygonArea(p)<1)||Math.abs(multiArea(next)-item.size)>.01)continue;
          parts.splice(item.i,1,...next);split=true;break;}
        if(split)break;
      }if(split)break;
    }
    if(!split)throw new Error('No se pudo alcanzar esa cantidad conservando los recortes. Probá otra cantidad o ajustá el dibujo.');
  }return parts;
}
export function projectFromPaint(d:PaintDraft,counts:number[],regions:boolean[],options:GenerationOptions,title:string):MapProject {
  if(counts.length!==d.land.length||regions.length!==d.land.length||counts.some((n,i)=>!Number.isInteger(n)||(n<occupiable(d,i).length||(!occupiable(d,i).length&&n!==0)))||counts.reduce((a,b)=>a+b,0)>120)throw new Error('Revisá la cantidad de áreas por masa. El límite total es 120.');
  const p:MapProject={version:5,title,width:d.width,height:d.height,vertices:{},territories:[],groups:[],generation:{...options,count:Math.max(1,counts.reduce((a,b)=>a+b,0)||options.count),segments:options.segments??2},geography:{landforms:[],mountains:[],margin:0,waterColor:'#b8d7dc'}};
  d.land.forEach((land,i)=>{p.geography!.landforms.push({id:`land${i}`,name:`Masa ${i+1}`,...addPolygon(p,land)});const available=occupiable(d,i);if(!available.length)return;
    const id=`region${i}`;if(regions[i])p.groups.push({id,name:`Región ${i+1}`,color:palette[i%palette.length],keepSingle:true});
    partitionPolygons(available,counts[i]).forEach((poly,j)=>{p.territories.push({id:`area${p.territories.length}`,name:`Territorio ${i+1}.${j+1}`,color:palette[i%palette.length],...addPolygon(p,poly),label:polygonLabel(poly),surface:'land',regionId:regions[i]?id:null});});
  });
  d.mountains.forEach((poly,i)=>p.geography!.mountains!.push({id:`mountain${i}`,name:`Montañas ${i+1}`,...addPolygon(p,poly)}));
  normalizeTopology(p);if(Object.keys(p.vertices).length>12000||allShapes(p).some(s=>rings(s).length>121||rings(s).some(r=>r.length>2000)))throw new Error('Se alcanzó el límite de detalle del proyecto. Usá trazos más simples o un pincel más ancho.');return p.territories.length>1?organicBoundaries(p,p.territories.map(t=>t.id),{irregularity:options.irregularity,segments:options.segments??2}):p;
}
/** Replace one face after a boolean cut; the other territories keep their IDs. */
export function replacePaintTerritory(project:MapProject,id:string,polys:Polygon[]):{project:MapProject;ids:string[]} {
  const p=structuredClone(project),source=p.territories.find(t=>t.id===id);if(!source)throw new Error('Seleccioná un territorio.');
  if(p.territories.length+polys.length-1>120)throw new Error('La división supera las 120 áreas.');
  let regionId=source.regionId;
  if(regionId===id){let gid=`region-${id}`;while(p.groups.some(g=>g.id===gid)||p.territories.some(t=>t.id===gid))gid+='r';p.groups.push({id:gid,name:source.name.slice(0,100),color:source.color,keepSingle:true});regionId=gid;}
  const ids:string[]=[];const faces:Territory[]=polys.map((poly,i)=>{let nextId=i===0?id:`${id}-part${i}`;while(i!==0&&p.territories.some(t=>t.id===nextId))nextId+='n';ids.push(nextId);return {...source,id:nextId,name:polys.length===1?source.name:`${source.name.slice(0,80)} (${i+1})`,holes:undefined,...addPolygon(p,poly),regionId,label:polygonLabel(poly)};});
  p.territories=p.territories.filter(t=>t.id!==id);p.territories.push(...faces);normalizeTopology(p);return {project:p,ids};
}
export function cutPaintTerritory(project:MapProject,id:string,a:Point,b:Point){const t=project.territories.find(t=>t.id===id)!;const poly=polygonOf(project,t),dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);if(len<1e-6)throw new Error('Elegí dos puntos distintos.');const scale=30000/len,u={x:dx*scale,y:dy*scale},n={x:-dy*scale,y:dx*scale};const mask:MultiPolygon=[[[[a.x-u.x,a.y-u.y],[a.x+u.x,a.y+u.y],[a.x+u.x+n.x,a.y+u.y+n.y],[a.x-u.x+n.x,a.y-u.y+n.y]]]];
  const one=clean(intersection([poly],mask)),two=clean(difference([poly],mask));if(one.length!==1||two.length!==1)throw new Error('El corte debe producir dos áreas conectadas sin cruzar un hueco.');const result=replacePaintTerritory(project,id,[one[0],two[0]]);return {project:result.project,newId:result.ids[1]};}
export function pointOnLand(d:PaintDraft,q:Point){return d.land.findIndex(p=>contains(p,q));}
