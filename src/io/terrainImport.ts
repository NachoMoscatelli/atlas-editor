import {paintFromProject} from '../geometry/paint';
import type {PaintDraft} from '../geometry/paint';
import {multiArea,union} from '../geometry/polygons';
import type {MultiPolygon} from '../geometry/polygons';
import {parseProject} from './project';
/** GeoJSON polygons are longitude/latitude. Fit a local equirectangular view;
 * the result is editable map art, not a geographic measuring instrument.
 */
export function readTerrain(source:string):PaintDraft {
  if(source.length>3_000_000)throw new Error('El archivo supera 3 MB.');const raw=JSON.parse(source);if(raw?.version!==undefined)return paintFromProject(parseProject(source));
  const polys:MultiPolygon=[];let points=0;
  const polygon=(coords:unknown)=>{if(!Array.isArray(coords)||!coords.length)throw new Error('Polígono GeoJSON inválido.');const rings=coords.map((r:unknown)=>{if(!Array.isArray(r)||r.length<4)throw new Error('Anillo GeoJSON inválido.');return r.map((q:unknown)=>{if(!Array.isArray(q)||!Number.isFinite(q[0])||!Number.isFinite(q[1])||Math.abs(q[0])>180||Math.abs(q[1])>90||++points>9000)throw new Error('Coordenadas inválidas o demasiados puntos. Usá GeoJSON en longitud/latitud y simplificá a 9000 puntos.');return [q[0],q[1]] as [number,number];});});polys.push(rings);};
  const visit=(o:unknown)=>{if(!o||typeof o!=='object')throw new Error('GeoJSON inválido.');const g=o as Record<string,unknown>;switch(g.type){case 'FeatureCollection':if(!Array.isArray(g.features))throw new Error('Colección inválida.');g.features.forEach(visit);break;case 'Feature':visit(g.geometry);break;case 'GeometryCollection':if(!Array.isArray(g.geometries))throw new Error('Colección inválida.');g.geometries.forEach(visit);break;case 'Polygon':polygon(g.coordinates);break;case 'MultiPolygon':if(!Array.isArray(g.coordinates))throw new Error('Multipolígono inválido.');g.coordinates.forEach(polygon);break;default:throw new Error('Importá polígonos GeoJSON; no se admiten líneas ni puntos.');}};
  visit(raw);if(!polys.length)throw new Error('No se encontraron superficies de tierra.');const coords=polys.flat(2),lat=coords.reduce((n,p)=>n+p[1],0)/coords.length,cos=Math.max(.01,Math.cos(lat*Math.PI/180)),xs=coords.map(p=>p[0]),span=Math.max(...xs)-Math.min(...xs);if(span>180)throw new Error('Esta geometría cruza el antimeridiano. Recortala antes de importarla.');
  const projected=union(polys.map(p=>p.map(r=>r.map(([x,y])=>[x*cos,-y]))));if(!multiArea(projected))throw new Error('La geometría no tiene superficie.');
  return {width:1000,height:700,land:projected,mountains:[]};
}
