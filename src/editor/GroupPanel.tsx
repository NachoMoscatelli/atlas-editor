import { useEffect,useState } from 'react';
import type { MapProject } from '../model/types';
import { dissolveGroup,groupAreas,groupFor,updateGroup,unassignAreas } from '../model/groups';
type Props={project:MapProject;ids:string[];onSelection:(ids:string[])=>void;onCommit:(p:MapProject)=>void;onStatus:(s:string)=>void;onUnite:()=>void};
export function GroupPanel({project,ids,onSelection,onCommit,onStatus,onUnite}:Props) {
  const primary=project.territories.find(t=>t.id===ids.at(-1)),group=primary?groupFor(project,primary):undefined;
  const members=group?project.territories.filter(t=>t.regionId===group.id):[];
  const entire=!!group&&members.length===ids.length&&members.every(t=>ids.includes(t.id));
  const [name,setName]=useState('Nueva región'),[color,setColor]=useState('#c2bed4');
  useEffect(()=>{setName(group?.name??'Nueva región');setColor(group?.color??'#c2bed4');},[group?.id,group?.name,group?.color]);
  function apply(action:()=>MapProject,message:string){try{onCommit(action());onStatus(message);}catch(error){onStatus((error as Error).message);}}
  const first=project.territories.find(t=>t.id===ids[0]);
  return <section className="group-panel"><div className="section-title"><h2>Seleccionar y unir</h2><output>{ids.length} áreas</output></div>
    <p className="micro">Usá Mayús + clic o mantené el botón derecho para dibujar un lazo. Suma las áreas que el trazo toque o encierre, sin pasar por sus centros. El borde resaltado rodea toda la selección.</p>
    <div className="selection-actions"><button onClick={()=>onSelection(project.territories.map(t=>t.id))}>Seleccionar todas</button><button disabled={!ids.length} onClick={()=>onSelection([])}>Limpiar selección</button></div>
    <button className="primary" disabled={ids.length<2} onClick={onUnite}>Unir en una sola área</button>
    {project.geography&&<><button disabled={!ids.some(id=>project.territories.some(t=>t.id===id&&t.regionId!==null))} onClick={()=>apply(()=>unassignAreas(project,ids),'Áreas sin región. La tierra y sus contornos se conservan. Podés deshacer.')}>Dejar como tierra sin región</button><p className="micro">Conserva la tierra como contexto del mapa. Quita su asignación regional sin mover costas ni fronteras.</p></>}
    {ids.length>=2&&<p className="merge-review">{ids.length} áreas → 1 pieza. Conserva el nombre «{first?.name}», color, superficie y asignación de la primera seleccionada. Deben estar conectadas y no dejar huecos. Podés deshacer la unión.</p>}
    <details className="logical-groups"><summary>Región con subdivisiones</summary><p className="micro">Esta opción conserva las áreas separadas bajo un nombre y color común.</p>
    {ids.length>0&&<><label>Nombre del grupo<input aria-label="Nombre del grupo" maxLength={100} value={name} onChange={e=>setName(e.target.value)}/></label><label>Color del grupo<input aria-label="Color del grupo" type="color" value={color} onChange={e=>setColor(e.target.value)}/></label>
      <button disabled={ids.length<2} onClick={()=>apply(()=>groupAreas(project,ids,name,color),'Región creada conservando las áreas y sus fronteras.')}>Crear grupo conservando áreas</button>
      {group&&<div className="group-current"><p>Grupo actual: <strong>{group.name}</strong> · {members.length} áreas</p><button onClick={()=>onSelection(members.map(t=>t.id))}>Seleccionar grupo completo</button><button disabled={!entire} onClick={()=>apply(()=>updateGroup(project,group.id,name,color),'Nombre y color del grupo actualizados.')}>Guardar cambios del grupo</button><button disabled={!entire} onClick={()=>apply(()=>dissolveGroup(project,group.id),'Grupo desarmado. Cada área vuelve a ser una región individual.')}>Desagrupar grupo</button>{!entire&&<p className="micro">Seleccioná el grupo completo para modificarlo o desagruparlo.</p>}</div>}
      <p className="micro">La región determina el color de todos sus territorios, también al imprimir. Podés agrupar áreas separadas, de agua o de tierra.</p>
    </>}
    </details></section>;
}
