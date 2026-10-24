import { useEffect,useState } from 'react';
import type { MapProject } from '../model/types';
import { detachTerritory,listRegions,updateRegion } from '../model/regions';

type Props={project:MapProject;activeId:string|null;onActive:(id:string|null)=>void;onClose:()=>void;onCommit:(p:MapProject)=>void;onStatus:(s:string)=>void;onSelection:(ids:string[])=>void};
export function RegionsPanel({project,activeId,onActive,onClose,onCommit,onStatus,onSelection}:Props) {
  const regions=listRegions(project),active=regions.find(r=>r.id===activeId);
  const [name,setName]=useState(''),[color,setColor]=useState('#b5cbb0');
  useEffect(()=>{setName(active?.name??'');setColor(active?.color??'#b5cbb0');},[active?.id,active?.name,active?.color]);
  function save() {
    if(!active)return;
    try {const next=updateRegion(project,active.id,name,color);onCommit(next.project);onActive(next.regionId);onStatus('Nombre y color de la región actualizados.');}
    catch(error){onStatus((error as Error).message);}
  }
  function separate(territoryId:string) {
    if(!active)return;
    try {
      const territory=active.territories.find(t=>t.id===territoryId)!;
      const next=detachTerritory(project,active.id,territoryId);
      onCommit(next);if(!listRegions(next).some(r=>r.id===active.id))onActive(territoryId);
      onStatus(`«${territory.name}» ahora forma su propia región. Podés deshacer la separación.`);
    } catch(error){onStatus((error as Error).message);}
  }
  const valid=!!name.trim()&&/^#[0-9a-f]{6}$/i.test(color),changed=!!active&&(name!==active.name||color!==active.color);
  return <aside className="regions-panel" id="regions-panel" aria-label="Regiones del mapa">
    <header className="regions-heading"><div><span className="eyebrow">ORGANIZAR EL MAPA</span><h2>Regiones <span>{regions.length}</span></h2></div><button aria-label="Cerrar panel de regiones" onClick={onClose}>×</button></header>
    <p className="regions-intro">Cada región reúne uno o más territorios. Abrí una para editarla.</p>
    <div className="regions-list">
      {!regions.length&&<p className="regions-empty">Todavía no hay regiones. Asigná un territorio o creá una región desde Seleccionar y unir. Las áreas libres no aparecen aquí.</p>}
      {regions.map(region=><div className={`region-card ${activeId===region.id?'expanded':''}`} key={region.id}>
        <button className="region-row" aria-expanded={activeId===region.id} aria-controls={`region-detail-${region.id}`} onClick={()=>onActive(activeId===region.id?null:region.id)}>
          <span className="region-swatch" style={{background:region.color}} aria-hidden="true"/><span className="region-row-name">{region.name}</span><span className="region-count">{region.territories.length} {region.territories.length===1?'territorio':'territorios'}</span><span aria-hidden="true">⌄</span>
        </button>
        {activeId===region.id&&<div className="region-detail" id={`region-detail-${region.id}`}>
          <label>Nombre de la región<input aria-label="Nombre de la región" value={name} maxLength={100} onChange={e=>setName(e.target.value)}/></label>
          <label>Color de la región<span className="region-color-editor"><input aria-label="Color de la región" type="color" value={/^#[0-9a-f]{6}$/i.test(color)?color:region.color} onChange={e=>setColor(e.target.value)}/><input aria-label="Código de color de la región" value={color} maxLength={7} spellCheck={false} onChange={e=>setColor(e.target.value)}/></span></label>
          <button className="primary region-save" disabled={!valid||!changed} onClick={save}>Guardar cambios</button>
          <div className="region-members-heading"><h3>Territorios · {region.territories.length}</h3><button onClick={()=>onSelection(region.territories.map(t=>t.id))}>Ver en mapa</button></div>
          <ul className="region-members">{region.territories.map(t=><li key={t.id}><span>{t.name}</span><button className="detach-territory" aria-label={`Separar ${t.name} de la región ${region.name}`} title={t.regionId===t.id?'Ya es una región individual':'Quitar de esta región y crear una región con su nombre de territorio'} disabled={t.regionId===t.id} onClick={()=>separate(t.id)}><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7"/></svg></button></li>)}</ul>
          <p className="region-detach-note">El tachito separa el territorio y crea una región con su nombre. El color se edita desde la ficha de esa región. No se borra del mapa.</p>
        </div>}
      </div>)}
    </div>
  </aside>;
}
