import {describe,it,expect} from 'vitest';
import {generate} from '../geometry/generate';
import {area} from '../geometry/topology';
import {parseProject,serializeProject} from '../io/project';
import {exportSvg} from '../io/svg';
import {DEFAULT_BOARD_SIZE,printSize,printSizeLabel} from './print';
const options={count:32,seed:'dimensiones',irregularity:.8,segments:4};
describe('tamaño físico del tablero',()=>{
  for(const [widthMm,heightMm] of [[700,500],[500,700],[400,400],[900,600],[100,2000],[2000,100]])it(`genera y exporta ${widthMm} × ${heightMm} mm sin huecos ni deformación`,()=>{
    const p=generate({...options,widthMm,heightMm});
    expect(p.territories).toHaveLength(32);expect(printSize(p)).toEqual({widthMm,heightMm});
    const total=p.territories.reduce((sum,t)=>sum+area(t.vertices.map(v=>p.vertices[v])),0);
    expect(total).toBeCloseTo(p.width*p.height,3);
    expect((p.width+80)/(p.height+110)).toBeCloseTo(widthMm/heightMm,6);
    expect(parseProject(serializeProject(p))).toEqual(p);
    const svg=exportSvg(p);expect(svg).toContain(`width="${widthMm}mm" height="${heightMm}mm"`);
  });
  it('conserva geometría y exportación A4 de los proyectos anteriores',()=>{
    const p=generate(options);expect(p.width).toBe(1000);expect(p.height).toBe(700);
    expect(printSize(p)).toEqual({widthMm:297,heightMm:210});expect(exportSvg(p)).toContain('width="297mm" height="210mm"');
    expect(parseProject(serializeProject(p))).toEqual(p);
  });
  it('usa 70 × 50 cm como referencia provisional sin mutar los parámetros',()=>{
    const initial={...options,...DEFAULT_BOARD_SIZE},before=JSON.stringify(initial),p=generate(initial);
    expect(printSizeLabel(p)).toBe('70 × 50 cm');expect(JSON.stringify(initial)).toBe(before);
    expect(generate(initial)).toEqual(p);
  });
  it('rechaza dimensiones incompletas, fuera de rango y no finitas al generar o cargar',()=>{
    for(const size of [{widthMm:700},{heightMm:500},{widthMm:99,heightMm:500},{widthMm:700,heightMm:2001},{widthMm:NaN,heightMm:500},{widthMm:700,heightMm:Infinity}]) {
      expect(()=>generate({...options,...size})).toThrow();
      const p=generate(options);p.generation={...p.generation,...size};expect(()=>parseProject(serializeProject(p))).toThrow();
    }
  });
  it('exporta solo el rectángulo de áreas sin título visible ni fondo de presentación',()=>{
    const p=generate({...options,...DEFAULT_BOARD_SIZE}),before=serializeProject(p),svg=exportSvg(p,true,true);
    expect(svg).toContain(`viewBox="0 0 ${p.width} ${p.height}"`);
    expect(svg).toContain('width="700mm" height="500mm"');expect(svg).not.toContain('<rect');expect(svg).not.toContain('font-family="serif"');
    expect(svg.match(/data-surface=/g)).toHaveLength(p.territories.length);expect(svg).toContain(p.territories[0].name);
    expect(serializeProject(p)).toBe(before);
  });
  it('permite ocultar nombres de las áreas independientemente de la presentación',()=>{
    const p=generate(options),svg=exportSvg(p,false,true);
    expect(svg).not.toContain('<text');expect(svg).toContain('<path');
    expect(exportSvg(p)).toContain('<rect');expect(exportSvg(p)).toContain('font-family="serif"');
  });
});
