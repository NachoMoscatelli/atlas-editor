import { useEffect,useState } from 'react';
import type { MapProject } from '../model/types';
import { subdivideArea } from '../geometry/subdivide';
export type SubdivisionResult=ReturnType<typeof subdivideArea>;
type Props={project:MapProject;areaId:string;preview:SubdivisionResult|null;onPreview:(r:SubdivisionResult)=>void;onApply:()=>void;onCancel:()=>void;onStatus:(s:string)=>void};
export function SubdivisionPanel({project,areaId,preview,onPreview,onApply,onCancel,onStatus}:Props) {
  const [endpoints,setEndpoints]=useState<'vertices'|'free'>('vertices');
  const vertexCount=project.territories.find(t=>t.id===areaId)!.vertices.length;
  const remaining=121-project.territories.length,max=project.version<5&&endpoints==='vertices'?Math.min(remaining,vertexCount-2):remaining;
  const [quantity,setQuantity]=useState('3'),[busy,setBusy]=useState(false);
  const [irregularity,setIrregularity]=useState(75),[segments,setSegments]=useState(8);
  useEffect(()=>{setQuantity(String(Math.max(2,Math.min(3,max))));},[areaId,max]);
  const count=Number(quantity),valid=Number.isInteger(count)&&count>=2&&count<=max;
  async function create(){setBusy(true);onStatus('Calculando la división automática…');try{await new Promise(r=>setTimeout(r,0));onPreview(subdivideArea(project,areaId,count,{irregularity:irregularity/100,segments,endpoints}));onStatus('Vista previa lista. Aplicá la división o cancelá para conservar el área original.');}catch(error){onCancel();onStatus((error as Error).message);}finally{setBusy(false);}}
  return <div className="subdivision-panel"><h3>Dividir en varias áreas</h3><label>Cantidad de partes<input aria-label="Cantidad de partes" type="number" min="2" max={Math.max(2,max)} step="1" value={quantity} disabled={busy} onChange={e=>{setQuantity(e.target.value);onCancel();}}/></label>
    {project.version<5&&<><label>Puntos de corte<select aria-label="Puntos de corte" value={endpoints} disabled={busy} onChange={e=>{setEndpoints(e.target.value as 'vertices'|'free');onCancel();}}><option value="vertices">Vértices existentes</option><option value="free">Cualquier punto del borde</option></select></label>
    <p className="micro">{endpoints==='vertices'?`Las nuevas fronteras conectan vértices actuales del territorio (${vertexCount} disponibles). No se agregan puntos al contorno exterior. Con pocos vértices pueden aparecer partes triangulares.`:'Los cortes pueden crear puntos nuevos en cualquier lugar del borde. Ofrece más libertad para formar partes compactas.'}</p>
    </>}
    {project.version>=5&&<p className="micro">Los cortes respetan lagos y montañas y pueden agregar puntos compartidos en el borde.</p>}
    <label>Irregularidad · {irregularity}%<input aria-label="Irregularidad de la división" type="range" min="0" max="100" step="5" value={irregularity} disabled={busy} onChange={e=>{setIrregularity(Number(e.target.value));onCancel();}}/></label>
    <label>Detalle de fronteras · {segments}<input aria-label="Detalle de la división" type="range" min="1" max="12" step="1" value={segments} disabled={busy} onChange={e=>{setSegments(Number(e.target.value));onCancel();}}/></label>
    <p className="micro">Partes más compactas con fronteras curvas e irregulares. Todas permanecen en la misma región. Más detalle agrega aristas editables. El contorno exterior se conserva; una zona estrecha puede producir partes alargadas.</p>
    {remaining<2?<p className="micro">El mapa llegó al límite de 120 áreas. Uní algunas antes de dividir.</p>:max<2?<p className="micro">Para dividir este territorio, agregá vértices en Nodos o elegí cualquier punto del borde.</p>:<p className="micro">Entre 2 y {max} partes, según la geometría disponible. {project.version<5&&endpoints==='vertices'?'El máximo depende de los vértices y del límite de 120 áreas.':'El mapa admite hasta 120 áreas.'}</p>}
    <button disabled={!valid||busy} onClick={()=>void create()}>{busy?'Calculando…':preview?'Actualizar vista previa':'Previsualizar división'}</button>
    {preview&&<><p className="subdivision-review">Resultado: {preview.ids.length} áreas nuevas. Todavía no se modificó el proyecto.</p><button className="primary" disabled={busy} onClick={onApply}>Aplicar división</button><button disabled={busy} onClick={onCancel}>Cancelar vista previa</button></>}
  </div>;
}
