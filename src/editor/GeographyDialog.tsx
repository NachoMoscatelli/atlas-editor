import {useEffect,useRef,useState} from 'react';
import type {PointerEvent} from 'react';
import type {GenerationOptions,MapProject,Point} from '../model/types';
import {allocateTerritories,coastDefaults,coastDraftFromProject,coastProject,populateGeography,proposeCoasts,validCoastDraft} from '../geometry/geography';
import type {CoastDraft,CoastOptions} from '../geometry/geography';
import {displayColor} from '../model/groups';
import {pathFor} from '../geometry/topology';

type Props={project:MapProject;options:GenerationOptions;editExisting:boolean;onApply:(p:MapProject)=>void;onClose:()=>void};
export function GeographyDialog({project,options,editExisting,onApply,onClose}:Props) {
  const ref=useRef<HTMLDialogElement>(null),svg=useRef<SVGSVGElement>(null);
  const [settings,setSettings]=useState<CoastOptions>(coastDefaults);
  const [draft,setDraft]=useState<CoastDraft>(()=>(editExisting?coastDraftFromProject(project):null)??proposeCoasts(options));
  const [selected,setSelected]=useState(0),[step,setStep]=useState<'coasts'|'territories'>('coasts');
  const [counts,setCounts]=useState(()=>allocateTerritories(draft,Math.max(options.count,draft.landforms.length)));
  const [preview,setPreview]=useState<MapProject|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const drag=useRef<{pointer:number;start:Point;base:CoastDraft;mass:number;vertex:number|null}|null>(null);
  useEffect(()=>{const dialog=ref.current!;dialog.showModal();return()=>dialog.close();},[]);
  const total=counts.reduce((a,b)=>a+b,0),selectedLand=draft.landforms[selected];
  function revise(next:CoastDraft){setDraft(next);setPreview(null);setError('');setCounts(allocateTerritories(next,Math.max(options.count,next.landforms.length)));}
  function propose(next:CoastOptions){try{revise(proposeCoasts(options,next));setSettings(next);setSelected(0);}catch(e){setError((e as Error).message);}}
  function point(e:PointerEvent):Point {return new DOMPoint(e.clientX,e.clientY).matrixTransform(svg.current!.getScreenCTM()!.inverse());}
  function begin(e:PointerEvent,mass:number,vertex:number|null){if(step!=='coasts'||e.button!==0)return;e.preventDefault();e.stopPropagation();setSelected(mass);drag.current={pointer:e.pointerId,start:point(e),base:draft,mass,vertex};svg.current!.setPointerCapture(e.pointerId);}
  function move(e:PointerEvent){const d=drag.current;if(!d||d.pointer!==e.pointerId)return;const q=point(e),next=structuredClone(d.base),land=next.landforms[d.mass];
    land.points=land.points.map((v,i)=>d.vertex===null||i===d.vertex?{x:v.x+q.x-d.start.x,y:v.y+q.y-d.start.y}:v);
    if(validCoastDraft(next,options)){setDraft(next);setPreview(null);setError('');}else setError('La costa no puede cruzarse, superponerse con otra masa ni entrar en el margen de agua.');
  }
  function end(){drag.current=null;}
  function removeMass(){if(draft.landforms.length<=1)return;revise({...draft,landforms:draft.landforms.filter((_,i)=>i!==selected)});setSelected(0);}
  function insertPoint(){const next=structuredClone(draft),points=next.landforms[selected].points;let index=0,longest=-1;points.forEach((a,i)=>{const b=points[(i+1)%points.length],len=Math.hypot(a.x-b.x,a.y-b.y);if(len>longest){longest=len;index=i;}});const a=points[index],b=points[(index+1)%points.length];points.splice(index+1,0,{x:(a.x+b.x)/2,y:(a.y+b.y)/2});if(points.length<=200)revise(next);}
  async function subdivide(){setBusy(true);setError('');try{await new Promise(r=>setTimeout(r,0));setPreview(populateGeography(draft,counts,options,project.title));}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  const massPath=(points:Point[])=>points.map((p,i)=>`${i?'L':'M'}${p.x},${p.y}`).join(' ')+' Z';
  const coastView=coastProject(draft,options,project.title);
  return <dialog className="geography-dialog" ref={ref} aria-labelledby="geography-title" onCancel={e=>{e.preventDefault();if(!busy)onClose();}}>
    <header><div><span className="eyebrow">PRIMERO LA GEOGRAFÍA, DESPUÉS LAS DIVISIONES</span><h2 id="geography-title">Costas e islas</h2></div><button disabled={busy} aria-label="Cerrar geografía" onClick={onClose}>×</button></header>
    <nav className="geography-steps" aria-label="Etapas de creación"><button aria-pressed={step==='coasts'} disabled={busy} onClick={()=>setStep('coasts')}>1 · Definir tierra y agua</button><button aria-pressed={step==='territories'} disabled={busy} onClick={()=>setStep('territories')}>2 · Distribuir territorios</button></nav>
    <div className="geography-workspace"><aside key={step} className="geography-controls">
      {step==='coasts'?<><h3>Proponer una geografía</h3><p>El azul es mar libre. Arrastrá una masa para moverla o sus puntos para ajustar la costa.</p>
        <label>Islas adicionales <output>{settings.islands}</output><input aria-label="Cantidad de islas" type="range" min="0" max="8" step="1" value={settings.islands} onChange={e=>propose({...settings,islands:+e.target.value})}/></label>
        <label>Extensión de tierra <output>{Math.round(settings.landScale*100)} %</output><input aria-label="Extensión de tierra" type="range" min=".4" max="1" step=".05" value={settings.landScale} onChange={e=>propose({...settings,landScale:+e.target.value})}/></label>
        <label>Irregularidad de costa <output>{Math.round(settings.roughness*100)} %</output><input aria-label="Irregularidad de costa" type="range" min="0" max="1" step=".05" value={settings.roughness} onChange={e=>propose({...settings,roughness:+e.target.value})}/></label>
        <label>Margen de agua <output>{settings.marginPercent} %</output><input aria-label="Margen de agua" type="range" min="2" max="20" step="1" value={settings.marginPercent} onChange={e=>propose({...settings,marginPercent:+e.target.value})}/></label>
        <button onClick={()=>propose({...settings,variant:settings.variant+1})}>Otra propuesta</button><p className="micro">Cambiar estos controles reemplaza la propuesta de costas. El proyecto abierto todavía no se modifica.</p>
        <h3>Masa seleccionada</h3><label>Elegir masa<select aria-label="Masa de tierra" value={selected} onChange={e=>setSelected(+e.target.value)}>{draft.landforms.map((land,i)=><option value={i} key={land.id}>{land.name}</option>)}</select></label>
        <label>Nombre<input aria-label="Nombre de la masa" value={selectedLand.name} maxLength={100} onChange={e=>{const next=structuredClone(draft);next.landforms[selected].name=e.target.value;setDraft(next);setPreview(null);}}/></label>
        <div className="geography-mass-actions"><button disabled={selectedLand.points.length>=200} onClick={insertPoint}>Agregar punto de costa</button><button disabled={draft.landforms.length<=1} onClick={removeMass}>Quitar esta masa</button></div>
        <p className="micro">Esta primera versión trabaja con costas simples e islas separadas. Los lagos interiores y recortes libres se incorporarán después.</p>
      </>:<><h3>Territorios sobre la tierra</h3><p>Indicá cuántos territorios tendrá cada masa. Las costas se conservan y el mar queda sin territorios.</p>
        {draft.landforms.map((land,i)=><label key={land.id}>{land.name}<input aria-label={`Territorios en ${land.name}`} type="number" min="1" max="120" step="1" value={Number.isNaN(counts[i])?'':counts[i]} onChange={e=>{setCounts(counts.map((n,j)=>j===i?(e.target.value===''?NaN:Number(e.target.value)):n));setPreview(null);}}/></label>)}
        <p className="geography-total">Total: {Number.isFinite(total)?total:'—'} territorios · {draft.landforms.length} masas de tierra</p>
        <button className="primary" disabled={busy||total<4||total>120||counts.some(n=>!Number.isInteger(n)||n<1)} onClick={()=>void subdivide()}>{busy?'Calculando…':'Previsualizar territorios'}</button>
        <p className="micro">Se crea una región por masa como punto de partida. Después podés reorganizar sus territorios, incluso entre islas y continente, desde Regiones.</p>
        <p className="micro">Al editar la geografía de un mapa existente, esta operación propone una distribución nueva. Reemplaza los territorios y regiones actuales solo al aplicar.</p>
      </>}
    </aside><div className="geography-preview"><svg ref={svg} viewBox={`0 0 ${draft.width} ${draft.height}`} role="group" aria-label="Vista previa de geografía" onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end}>
      <rect width={draft.width} height={draft.height} fill="#b8d7dc"/>
      <rect x={draft.margin} y={draft.margin} width={draft.width-2*draft.margin} height={draft.height-2*draft.margin} fill="none" stroke="#68959b" strokeDasharray="6 6" pointerEvents="none"/>
      {preview&&step==='territories'?preview.territories.map(t=><path data-preview-territory={t.id} key={t.id} d={pathFor(preview,t.vertices)} fill={displayColor(preview,t)} stroke="#476359" strokeWidth="1.2"/>):draft.landforms.map((land,i)=><path data-landform={land.id} key={land.id} d={massPath(land.points)} fill={i===selected?'#d2dcb5':'#c1d0ab'} stroke="#4e6d4a" strokeWidth={i===selected?2.5:1.2} onPointerDown={e=>begin(e,i,null)}/>)}
      {step==='coasts'&&selectedLand.points.map((q,i)=><circle data-coast-point={i} key={i} cx={q.x} cy={q.y} r={draft.width/170} fill="#fffdf1" stroke="#436744" strokeWidth="1.1" onPointerDown={e=>begin(e,selected,i)}/>)}
      {(preview&&step==='territories'?preview.territories:coastView.territories).map(t=><text key={t.id} x={t.label.x} y={t.label.y} textAnchor="middle" fontSize={Math.max(10,draft.width/95)} fill="#314b3d" pointerEvents="none">{t.name}</text>)}
    </svg><p>{step==='coasts'?'Mové la tierra y sus vértices. La línea punteada indica el margen protegido de agua.':preview?'Vista previa: todavía no se aplicó al proyecto.':'Las costas están listas. Calculá la distribución para ver sus territorios.'}</p></div></div>
    <footer>{error&&<p className="geography-error" role="alert">{error}</p>}<div><span>{step==='coasts'?'Tu mapa actual se conserva hasta aplicar.':'Aplicar reemplaza el mapa actual. Se puede deshacer en un paso.'}</span><button disabled={busy} onClick={onClose}>Cancelar</button>{step==='coasts'?<button className="primary" onClick={()=>{if(draft.landforms.some(l=>!l.name.trim())){setError('Cada masa necesita un nombre.');return;}setStep('territories');}}>Continuar a territorios →</button>:<button className="primary" disabled={!preview||busy} onClick={()=>preview&&onApply(preview)}>Aplicar mapa costero</button>}</div></footer>
  </dialog>;
}
