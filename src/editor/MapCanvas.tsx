import { useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import type { MapProject, Point } from '../model/types';
import { printSizeLabel } from '../model/print';
import { pathFor, validGeometry } from '../geometry/topology';
import { displayColor,regionCount } from '../model/groups';
import { mapBorders,groupLabels } from '../geometry/presentation';
import { nearestBoundary } from '../geometry/areas';
import { addSelection,areasInLasso,selectionPath } from '../geometry/selection';
export type Tool='select'|'vertices'|'labels'|'divide'|'multi'|'lasso';
type Props={areasOnly?:boolean;readOnly?:boolean;project:MapProject;selected:string|null;onSelect:(id:string|null)=>void;onCommit:(p:MapProject)=>void;tool:Tool;labels:boolean;zoom:number;onStatus:(s:string)=>void; selectedNode:string|null;onNode:(id:string)=>void;onSplit:(a:string,b:string)=>void;onCut:(id:string,a:Point,b:Point)=>void;mergeTarget:string|null;selectedIds:string[];onToggle:(id:string)=>void;onLasso:(ids:string[])=>void};
export function MapCanvas({project,selected,onSelect,onCommit,tool,labels,zoom,onStatus,selectedNode,onNode,onSplit,onCut,mergeTarget,selectedIds,onToggle,onLasso,readOnly=false,areasOnly=false}:Props) {
  const svg=useRef<SVGSVGElement>(null);
  const scroll=useRef<HTMLDivElement>(null);
  const [fitWidth,setFitWidth]=useState(700);
  useEffect(()=>{const el=scroll.current!;const observer=new ResizeObserver(()=>setFitWidth(Math.max(360,Math.min(el.clientWidth-80,(el.clientHeight-(areasOnly?20:165))/(project.height/project.width)))));observer.observe(el);return()=>observer.disconnect();},[project.width,project.height,areasOnly]);
  const drag=useRef<{start:Point;base:MapProject;territoryId:string;ids:string[];labelId?:string;last:MapProject}|null>(null);
  const lasso=useRef<{pointerId:number;button:number;points:Point[];base:string[]}|null>(null);
  const [lassoPoints,setLassoPoints]=useState<Point[]>([]);
  const [draft,setDraft]=useState<MapProject|null>(null);
  const [cutStart,setCutStart]=useState<Point|null>(null),[cutHover,setCutHover]=useState<Point|null>(null);
  useEffect(()=>{setCutStart(null);setCutHover(null);},[project,selected,tool]);
  useEffect(()=>{cancelLasso();},[project]);
  useEffect(()=>{const cancel=(e:KeyboardEvent)=>{if(e.key==='Escape'&&lasso.current){e.preventDefault();e.stopImmediatePropagation();cancelLasso();onStatus('Lazo cancelado. Se conserva la selección anterior.');}};const blur=()=>{if(lasso.current)cancelLasso();};window.addEventListener('keydown',cancel,true);window.addEventListener('blur',blur);return()=>{window.removeEventListener('keydown',cancel,true);window.removeEventListener('blur',blur);};},[onStatus]);
  const p=draft??project;
  function point(e:PointerEvent):Point {const matrix=svg.current!.getScreenCTM()!;return new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse());}
  function cancelLasso(){const active=lasso.current;lasso.current=null;setLassoPoints([]);if(active&&svg.current?.hasPointerCapture(active.pointerId))svg.current.releasePointerCapture(active.pointerId);}
  function beginLasso(e:PointerEvent) {
    if(readOnly){e.preventDefault();e.stopPropagation();return;}
    if(readOnly||(e.button!==2&&!(tool==='lasso'&&e.button===0))||drag.current||lasso.current)return;
    e.preventDefault();e.stopPropagation();setCutStart(null);setCutHover(null);
    lasso.current={pointerId:e.pointerId,button:e.button,points:[point(e)],base:[...selectedIds]};
    setLassoPoints([point(e)]);svg.current!.setPointerCapture(e.pointerId);
    onStatus('Dibujando lazo. Soltá para cerrarlo y sumar las áreas; Escape cancela.');
  }
  function appendLasso(e:PointerEvent,force=false) {
    const active=lasso.current;if(!active||active.pointerId!==e.pointerId)return;
    const at=point(e),last=active.points.at(-1)!,scale=svg.current!.getScreenCTM()!.a;
    if(Math.hypot(at.x-last.x,at.y-last.y)*scale<(force ? 0.1 : 3))return;
    if(active.points.length>=4096)active.points=active.points.filter((_,i)=>i%2===0);
    active.points.push(at);setLassoPoints([...active.points]);
  }
  function finishLasso(e:PointerEvent) {
    const active=lasso.current;if(!active||e.pointerId!==active.pointerId||e.button!==active.button)return;
    appendLasso(e,true);
    const scale=svg.current!.getScreenCTM()!.a,first=active.points[0];
    const largeEnough=active.points.some(p=>Math.hypot(p.x-first.x,p.y-first.y)*scale>=4);
    const added=largeEnough?areasInLasso(project,active.points):[];
    cancelLasso();
    if(!added.length){onStatus('El trazo no tocó ninguna área. Se conserva la selección anterior.');return;}
    const combined=addSelection(active.base,added);onLasso(combined);
    onStatus(`Lazo cerrado: ${combined.length-active.base.length} áreas agregadas · ${combined.length} seleccionadas.`);
  }
  function cut(e:PointerEvent) {
    if(readOnly||e.button!==0)return;e.stopPropagation();const t=project.territories.find(t=>t.id===selected);if(!t)return;
    const hit=nearestBoundary(project,t,point(e)),scale=svg.current!.getScreenCTM()!.a;
    if(hit.distance>16/scale){onStatus('Hacé clic cerca del borde del área seleccionada para fijar el extremo.');return;}
    if(!cutStart){setCutStart(hit.point);setCutHover(hit.point);onStatus('Inicio fijado. Elegí otro punto del borde; Escape cancela.');}
    else {onCut(t.id,cutStart,hit.point);setCutStart(null);setCutHover(null);}
  }
  function begin(e:PointerEvent,id:string,vertex?:string) {
    if(readOnly||e.button!==0)return;e.stopPropagation();
    if(tool==='multi'||e.shiftKey){onToggle(id);return;}
    if(tool==='divide'){if(!selected){onSelect(id);onStatus('Área seleccionada. Elegí dos puntos de su borde.');}else cut(e);return;}
    onSelect(id);
    if(vertex)onNode(vertex);
    if(tool==='vertices'&&!vertex)return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const t=project.territories.find(t=>t.id===id)!;
    drag.current={start:point(e),base:project,territoryId:id,ids:vertex?[vertex]:tool==='select'?t.vertices:[],labelId:tool==='labels'?id:undefined,last:project};
  }
  function move(e:PointerEvent) {
    if(lasso.current){appendLasso(e);return;}
    if(tool==='divide'&&cutStart){setCutHover(point(e));return;}
    const d=drag.current;if(!d)return;
    const at=point(e),dx=at.x-d.start.x,dy=at.y-d.start.y;
    const next=structuredClone(d.base);
    d.ids.forEach(id=>{const v=d.base.vertices[id];next.vertices[id]={x:v.x===0||v.x===next.width?v.x:Math.max(0,Math.min(next.width,v.x+dx)),y:v.y===0||v.y===next.height?v.y:Math.max(0,Math.min(next.height,v.y+dy))};});
    if(d.labelId||d.ids.length>1){const t=next.territories.find(t=>t.id===d.territoryId)!;const orig=d.base.territories.find(v=>v.id===t.id)!;t.label={x:Math.max(0,Math.min(next.width,orig.label.x+dx)),y:Math.max(0,Math.min(next.height,orig.label.y+dy))};}
    if(validGeometry(next)){d.last=next;setDraft(next);onStatus('Edición válida · fronteras compartidas sincronizadas');}else onStatus('Límite de edición: el movimiento produciría un cruce.');
  }
  function end(e?:PointerEvent) {if(lasso.current){if(e)finishLasso(e);return;}const d=drag.current;if(!d)return;drag.current=null;setDraft(null);if(d.last!==d.base)onCommit(d.last);}
  return <div className="canvas-scroll" ref={scroll}><div className={`paper ${areasOnly?'areas-only':''}`} style={{width:fitWidth*zoom/100,minWidth:360}}>
    {!areasOnly&&<><div className="paper-heading"><span>ATLAS / CARTOGRAFÍA TERRITORIAL</span><span>EDICIÓN 05</span></div>
    <h2>{project.title||'Mapa sin título'}</h2><p className="paper-subtitle">Un territorio, infinitas posibilidades.</p>
    </>}<svg ref={svg} viewBox={areasOnly?`0 0 ${p.width} ${p.height}`:`-8 -8 ${p.width+16} ${p.height+16}`} role="group" aria-label="Mapa territorial editable" style={{cursor:tool==='lasso'?'crosshair':undefined}} onContextMenu={e=>e.preventDefault()} onKeyDownCapture={e=>{if(readOnly){e.preventDefault();e.stopPropagation();}}} onPointerDownCapture={beginLasso} onPointerMove={move} onPointerUp={end} onPointerCancel={()=>lasso.current?cancelLasso():end()} onLostPointerCapture={()=>lasso.current?cancelLasso():end()} onPointerDown={e=>{if(readOnly||e.button!==0)return;tool==='divide'?cut(e):onSelect(null);}}>
      {p.territories.map(t=><path key={t.id} data-territory={t.id} data-surface={t.surface} data-assigned={t.regionId!==null} className={`territory ${selected===t.id?'selected':''} ${mergeTarget===t.id?'merge-target':''}`} style={{cursor:tool==='divide'||tool==='lasso'||lassoPoints.length>0?'crosshair':tool==='multi'?'pointer':undefined,stroke:'none'}} d={pathFor(p,t.vertices)} fill={displayColor(p,t)} onPointerDown={e=>begin(e,t.id)}><title>{t.name} · {t.surface==='water'?'Agua':'Tierra'} · {t.regionId?'Región asignada':'Sin región'}</title></path>)}
      {mapBorders(p).map(e=><line key={e.a+':'+e.b} x1={p.vertices[e.a].x} y1={p.vertices[e.a].y} x2={p.vertices[e.b].x} y2={p.vertices[e.b].y} className={e.internal?'group-border':'map-border'} pointerEvents="none"/>)}
      <path data-selection-outline="true" d={selectionPath(p,selectedIds)} className="selection-outline" pointerEvents="none"/>
      {p.territories.filter(t=>mergeTarget===t.id).map(t=><path key={'outline-'+t.id} d={pathFor(p,t.vertices)} className="merge-outline" pointerEvents="none"/>)}
      {labels&&groupLabels(p).map(g=><text key={'group-'+g.id} x={g.x} y={g.y} className="group-label" pointerEvents="none">{g.name}</text>)}
      {labels&&p.territories.map(t=><text key={t.id} x={t.label.x} y={t.label.y} className="map-label" style={{pointerEvents:tool==='labels'?'auto':'none',cursor:tool==='labels'?'move':undefined}} onPointerDown={e=>begin(e,t.id)}>{t.name}</text>)}
      {tool==='vertices'&&selected&&p.territories.find(t=>t.id===selected)?.vertices.map((id,i,ids)=>{const b=ids[(i+1)%ids.length],A=p.vertices[id],B=p.vertices[b];return <g key={`add-${id}`} className="add-node" role="button" tabIndex={0} aria-label={`Agregar nodo en arista ${i+1}`} onPointerDown={e=>{e.stopPropagation();onSplit(id,b);}} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSplit(id,b);}}}><circle cx={(A.x+B.x)/2} cy={(A.y+B.y)/2} r="7"/><text x={(A.x+B.x)/2} y={(A.y+B.y)/2}>+</text><title>Agregar un nodo compartido en este tramo</title></g>;})}
      {tool==='vertices'&&selected&&p.territories.find(t=>t.id===selected)?.vertices.map(id=><circle key={id} data-vertex={id} cx={p.vertices[id].x} cy={p.vertices[id].y} r="5" className={`vertex ${id===selectedNode?'chosen':''}`} onPointerDown={e=>begin(e,selected,id)}/>)}
      {cutStart&&cutHover&&<g className="cut-preview" pointerEvents="none"><line x1={cutStart.x} y1={cutStart.y} x2={cutHover.x} y2={cutHover.y}/><circle cx={cutStart.x} cy={cutStart.y} r="5"/></g>}
      {lassoPoints.length>0&&<path data-lasso-preview="true" className="lasso-preview" d={lassoPoints.map((p,i)=>`${i?'L':'M'}${p.x},${p.y}`).join(' ')+' Z'} fillRule="evenodd" vectorEffect="non-scaling-stroke" pointerEvents="none"/>}
    </svg>
    {!areasOnly&&<div className="paper-footer"><span>{regionCount(p)} REGIONES · {p.territories.filter(t=>t.regionId===null).length} ÁREAS LIBRES</span><span>◇ N</span><span>{printSizeLabel(p)}</span></div>}
  </div></div>;
}
