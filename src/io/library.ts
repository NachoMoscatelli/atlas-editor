import type {MapProject} from '../model/types';
import {parseProject,serializeProject} from './project';
export type SavedMap={id:string;updatedAt:string;project:MapProject};
const request=<T>(r:IDBRequest<T>)=>new Promise<T>((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error??new Error('No se pudo leer la biblioteca.'));});
const completed=(t:IDBTransaction)=>new Promise<void>((resolve,reject)=>{t.oncomplete=()=>resolve();t.onabort=t.onerror=()=>reject(t.error??new Error('No se pudo guardar el mapa.'));});
export async function openLibrary(name='atlas-map-library',factory:IDBFactory=indexedDB){
  const opening=factory.open(name,1);opening.onupgradeneeded=()=>{opening.result.createObjectStore('maps',{keyPath:'id'});opening.result.createObjectStore('settings');};
  const db=await request(opening);
  return {
    async list():Promise<SavedMap[]>{const tx=db.transaction('maps','readonly'),done=completed(tx),rows=await request(tx.objectStore('maps').getAll());await done;return rows.map((row:SavedMap)=>({...row,project:parseProject(serializeProject(row.project))})).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));},
    async save(record:SavedMap){parseProject(serializeProject(record.project));const tx=db.transaction('maps','readwrite'),done=completed(tx);tx.objectStore('maps').put(record);await done;},
    async migrateLegacy(project:MapProject|null){const tx=db.transaction(['maps','settings'],'readwrite'),done=completed(tx),settings=tx.objectStore('settings');const migrated=await request(settings.get('legacy-migrated'));if(!migrated){if(project&&(project.territories.length||project.geography?.landforms.length)){parseProject(serializeProject(project));tx.objectStore('maps').put({id:'legacy-map',updatedAt:new Date().toISOString(),project});}settings.put(true,'legacy-migrated');}await done;},
    close(){db.close();}
  };
}
