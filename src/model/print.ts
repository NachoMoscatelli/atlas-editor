import type { GenerationOptions,MapProject } from './types';

// User-approved working size, not a verified measurement of a commercial board.
export const DEFAULT_BOARD_SIZE={widthMm:700,heightMm:500};
export function validatePrintSize(options:GenerationOptions) {
  const {widthMm,heightMm}=options;
  if(widthMm===undefined&&heightMm===undefined)return;
  if(!Number.isFinite(widthMm)||!Number.isFinite(heightMm)||widthMm!<100||heightMm!<100||widthMm!>2000||heightMm!>2000)throw new Error('El ancho y el alto deben estar entre 10 y 200 cm.');
}
export function printSize(project:MapProject) {
  return {widthMm:project.generation.widthMm??297,heightMm:project.generation.heightMm??210};
}
export function printSizeLabel(project:MapProject) {
  const size=printSize(project),cm=(mm:number)=>Number((mm/10).toFixed(2)).toLocaleString('es-AR');
  return `${cm(size.widthMm)} × ${cm(size.heightMm)} cm`;
}
/** Reserve the same title and margins used by SVG export inside the chosen sheet. */
export function generationBounds(options:GenerationOptions) {
  validatePrintSize(options);
  if(options.widthMm===undefined)return {width:1000,height:700};
  const w=options.widthMm,h=options.heightMm!,scale=Math.max(1000/Math.max(w,h),250/Math.min(w,h));
  return {width:+(w*scale-80).toFixed(6),height:+(h*scale-110).toFixed(6)};
}
