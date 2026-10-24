export type Point = { x: number; y: number };
export type Ringed = {vertices:string[];holes?:string[][];components?:{vertices:string[];holes?:string[][]}[]};
export type Territory = Ringed & { id: string; name: string; color: string; label: Point; surface: 'land' | 'water'; regionId: string | null };
export type GenerationOptions = { count: number; seed: string; irregularity: number; segments?: number; widthMm?:number; heightMm?:number };
export type AreaGroup = { id: string; name: string; color: string; keepSingle?: true };
export type Landform = Ringed & { id:string; name:string;groupId?:string };
// margin records the proposal's initial gap; it never constrains later editing.
export type Geography = { landforms:Landform[]; mountains?:Landform[];landGroups?:{id:string;name:string}[]; margin:number; waterColor:string };
export type MapProject = {
  version: 3 | 4 | 5 | 6; stage?:'terrain'|'territories'; title: string; width: number; height: number; groups: AreaGroup[];
  geography?:Geography;
  vertices: Record<string, Point>; territories: Territory[];
  generation: GenerationOptions;
};
// Importers normalize any external source into the editor's shared topology.
export interface MapImporter { id: string; extensions: string[]; import(source: string): Promise<MapProject> }
export interface MapExporter { id: string; extension: string; mimeType: string; export(project: MapProject): string | Promise<Blob> }
