import {describe,it,expect} from 'vitest';
import {IDBFactory} from 'fake-indexeddb';
import {openLibrary} from './library';
import {emptyPaint,terraformProject} from '../geometry/paint';
const options={count:8,seed:'library',irregularity:.7,segments:2,widthMm:700,heightMm:500};
const project=(title:string)=>terraformProject(emptyPaint(options),options,title);
describe('biblioteca persistente',()=>{
  it('guarda mapas independientes, incluso con el mismo nombre, y los recupera al volver a abrir',async()=>{const factory=new IDBFactory(),db=await openLibrary('test',factory);await db.save({id:'one',updatedAt:'2026-10-24',project:project('Islas')});await db.save({id:'two',updatedAt:'2026-10-25',project:project('Islas')});await db.save({id:'one',updatedAt:'2026-10-26',project:project('Continente')});db.close();const reopened=await openLibrary('test',factory),rows=await reopened.list();expect(rows.map(r=>r.id)).toEqual(['one','two']);expect(rows.map(r=>r.project.title)).toEqual(['Continente','Islas']);expect(rows[0].project.stage).toBe('terrain');reopened.close();});
  it('recupera el proyecto anterior una sola vez sin sobrescribirlo tras editarlo',async()=>{const factory=new IDBFactory(),db=await openLibrary('test',factory);const legacy=project('Anterior');legacy.title='Original';await db.migrateLegacy(legacy);expect(await db.list()).toHaveLength(0);const {generate}=await import('../geometry/generate');const old=generate(options);old.title='Mapa anterior';const other=await openLibrary('legacy',factory);await other.migrateLegacy(old);await other.save({id:'legacy-map',updatedAt:'2026',project:{...old,title:'Editado'}});await other.migrateLegacy(old);expect((await other.list()).map(r=>r.project.title)).toEqual(['Editado']);db.close();other.close();});
  it('rechaza un guardado inválido sin reemplazar la copia válida',async()=>{const db=await openLibrary('test',new IDBFactory());await db.save({id:'one',updatedAt:'2026',project:project('Conservado')});const bad=project('Roto');bad.width=NaN;await expect(db.save({id:'one',updatedAt:'2027',project:bad})).rejects.toThrow();expect((await db.list())[0].project.title).toBe('Conservado');db.close();});
});
