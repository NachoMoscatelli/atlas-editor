import type { MapProject } from '../model/types';
import { edges, edgeKey, validGeometry } from './topology';

/** Split the same edge in every incident face; no independent boundary copies. */
export function splitEdge(project: MapProject, a: string, b: string): { project: MapProject; vertexId: string } {
  if (!edges(project).some(([c,d]) => edgeKey(a,b) === edgeKey(c,d))) throw new Error('La arista ya no existe.');
  const affected = project.territories.filter(t=>t.vertices.some((id,i)=>edgeKey(id,t.vertices[(i+1)%t.vertices.length])===edgeKey(a,b)));
  if(Object.keys(project.vertices).length>=3000||affected.some(t=>t.vertices.length>=500)) throw new Error('Se alcanzó el límite de nodos del proyecto.');
  const next=structuredClone(project);
  let index=0; while(Object.hasOwn(next.vertices,`edit${index}`))index++;
  const vertexId=`edit${index}`, A=next.vertices[a], B=next.vertices[b];
  next.vertices[vertexId]={x:(A.x+B.x)/2,y:(A.y+B.y)/2};
  next.territories.forEach(t=>{const ids=t.vertices;t.vertices=ids.flatMap((id,i)=>edgeKey(id,ids[(i+1)%ids.length])===edgeKey(a,b)?[id,vertexId]:[id]);});
  next.geography?.landforms.forEach(t=>{const ids=t.vertices;t.vertices=ids.flatMap((id,i)=>edgeKey(id,ids[(i+1)%ids.length])===edgeKey(a,b)?[id,vertexId]:[id]);});
  if(!validGeometry(next))throw new Error('No se puede subdividir este tramo: es demasiado pequeño.');
  return {project:next,vertexId};
}

/** Only degree-two nodes can be dissolved. Junctions and sheet corners are protected. */
export function removeVertex(project:MapProject,id:string):MapProject {
  const v=project.vertices[id];if(!v)throw new Error('Seleccioná un nodo.');
  const neighbors=new Set(edges(project).filter(([a,b])=>a===id||b===id).flatMap(([a,b])=>[a,b]).filter(n=>n!==id));
  if(neighbors.size!==2)throw new Error('Es una unión de fronteras. Solo se pueden quitar nodos intermedios.');
  if((v.x===0||v.x===project.width)&&(v.y===0||v.y===project.height))throw new Error('Las esquinas de la hoja están protegidas.');
  if(project.territories.some(t=>t.vertices.includes(id)&&t.vertices.length<=3))throw new Error('Cada área necesita al menos tres nodos.');
  const next=structuredClone(project);
  next.territories.forEach(t=>{t.vertices=t.vertices.filter(n=>n!==id);});next.geography?.landforms.forEach(t=>{t.vertices=t.vertices.filter(n=>n!==id);});delete next.vertices[id];
  if(!validGeometry(next))throw new Error('Quitar este nodo produciría un cruce de fronteras.');
  return next;
}
