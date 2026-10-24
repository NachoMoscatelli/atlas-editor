import { useCallback, useState } from 'react';
import type { MapProject } from '../model/types';
export function useProject(initial:()=>MapProject) {
  const [history,setHistory]=useState(()=>({past:[] as MapProject[],present:initial(),future:[] as MapProject[]}));
  const commit=useCallback((p:MapProject)=>setHistory(h=>({past:[...h.past,h.present].slice(-40),present:p,future:[]})),[]);
  const undo=useCallback(()=>setHistory(h=>h.past.length?{past:h.past.slice(0,-1),present:h.past.at(-1)!,future:[h.present,...h.future]}:h),[]);
  const redo=useCallback(()=>setHistory(h=>h.future.length?{past:[...h.past,h.present],present:h.future[0],future:h.future.slice(1)}:h),[]);
  return {project:history.present,commit,undo,redo,canUndo:!!history.past.length,canRedo:!!history.future.length};
}
