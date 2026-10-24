export type Point = { x: number; y: number };
export type Territory = { id: string; name: string; color: string; vertices: string[]; label: Point; surface: 'land' | 'water'; regionId: string | null };
export type GenerationOptions = { count: number; seed: string; irregularity: number; segments?: number; widthMm?:number; heightMm?:number };
export type AreaGroup = { id: string; name: string; color: string; keepSingle?: true };
export type MapProject = {
  version: 3; title: string; width: number; height: number; groups: AreaGroup[];
  vertices: Record<string, Point>; territories: Territory[];
  generation: GenerationOptions;
};
// Importers normalize any external source into the editor's shared topology.
export interface MapImporter { id: string; extensions: string[]; import(source: string): Promise<MapProject> }
export interface MapExporter { id: string; extension: string; mimeType: string; export(project: MapProject): string | Promise<Blob> }
