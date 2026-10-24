import { useEffect,useRef,useState } from 'react';
import type { GenerationOptions } from '../model/types';
import { DEFAULT_BOARD_SIZE,validatePrintSize } from '../model/print';

export function GenerationDialog({initial,onGenerate,onGeography,onClose}:{initial:GenerationOptions;onGenerate:(o:GenerationOptions)=>void;onGeography:(o:GenerationOptions)=>void;onClose:()=>void}) {
  const ref=useRef<HTMLDialogElement>(null);
  const [options,setOptions]=useState(initial),[width,setWidth]=useState(String((initial.widthMm??DEFAULT_BOARD_SIZE.widthMm)/10)),[height,setHeight]=useState(String((initial.heightMm??DEFAULT_BOARD_SIZE.heightMm)/10));
  const [mode,setMode]=useState<'coasts'|'classic'>('coasts');
  const [error,setError]=useState(''),[busy,setBusy]=useState(false);
  useEffect(()=>{const dialog=ref.current!;dialog.showModal();return()=>dialog.close();},[]);
  async function submit() {
    const next={...options,widthMm:+(Number(width)*10).toFixed(6),heightMm:+(Number(height)*10).toFixed(6)};
    try{validatePrintSize(next);setError('');setBusy(true);await new Promise(r=>setTimeout(r,0));if(mode==='coasts')onGeography(next);else onGenerate(next);}
    catch(e){setError((e as Error).message);setBusy(false);}
  }
  const isDefault=Number(width)===70&&Number(height)===50;
  return <dialog className="generation-dialog" ref={ref} aria-labelledby="generation-title" onCancel={e=>{e.preventDefault();if(!busy)onClose();}}>
    <form onSubmit={e=>{e.preventDefault();void submit();}}>
      <header><div><span className="eyebrow">UN NUEVO PUNTO DE PARTIDA</span><h2 id="generation-title">Generar mapa</h2></div><button type="button" aria-label="Cerrar configuración de generación" disabled={busy} onClick={onClose}>×</button></header>
      <div className="generation-dialog-body"><fieldset disabled={busy}>
        <div className="generation-size-heading"><h3>Tamaño del tablero</h3><button type="button" onClick={()=>{setWidth('70');setHeight('50');}}>Usar 70 × 50 cm</button></div>
        <div className="generation-dimensions"><label>Ancho (cm)<input autoFocus aria-label="Ancho del mapa en cm" type="number" min="10" max="200" step="0.1" required value={width} onChange={e=>setWidth(e.target.value)}/></label><span aria-hidden="true">×</span><label>Alto (cm)<input aria-label="Alto del mapa en cm" type="number" min="10" max="200" step="0.1" required value={height} onChange={e=>setHeight(e.target.value)}/></label></div>
        <p className="generation-size-note">{isDefault?'70 × 50 cm es una referencia provisional para el tablero, no una medida verificada de TEG La Revancha.':'Elegí entre 10 y 200 cm por lado, en orientación horizontal o vertical.'} El SVG se exportará con estas medidas totales, incluidos el título y los márgenes.</p>
        <label>Tipo de mapa<select aria-label="Tipo de mapa" value={mode} onChange={e=>setMode(e.target.value as 'coasts'|'classic')}><option value="coasts">Costas e islas · geografía primero</option><option value="classic">Rectángulo clásico · toda la superficie</option></select></label><h3>Distribución de territorios</h3>
        <label>Territorios <output>{options.count}</output><input aria-label="Cantidad de territorios" type="range" min="4" max="120" value={options.count} onChange={e=>setOptions({...options,count:+e.target.value})}/></label>
        <label>Semilla<input aria-label="Semilla de generación" maxLength={150} value={options.seed} onChange={e=>setOptions({...options,seed:e.target.value})}/></label>
        <div className="generation-parameters"><label>Irregularidad <output>{Math.round(options.irregularity*100)} %</output><input aria-label="Irregularidad de generación" type="range" min="0" max="1" step=".05" value={options.irregularity} onChange={e=>setOptions({...options,irregularity:+e.target.value})}/></label><label>Tramos por frontera <output>{options.segments??2}</output><input aria-label="Tramos por frontera" type="range" min="1" max="6" step="1" value={options.segments??2} onChange={e=>setOptions({...options,segments:+e.target.value})}/></label></div>
        <p className="micro">La misma semilla, dimensiones y parámetros producen el mismo mapa.</p>
      </fieldset>{error&&<p role="alert" className="generation-error">{error}</p>}</div>
      <footer><p>{mode==='coasts'?'Primero revisarás la geografía y sus territorios. El mapa actual no cambia hasta aplicar.':'Reemplaza el mapa actual. Podés recuperarlo con Deshacer.'}</p><div><button type="button" disabled={busy} onClick={onClose}>Cancelar</button><button className="primary" type="submit" disabled={busy}>{busy?'Preparando…':mode==='coasts'?'Definir geografía →':'Generar mapa'}</button></div></footer>
    </form>
  </dialog>;
}
