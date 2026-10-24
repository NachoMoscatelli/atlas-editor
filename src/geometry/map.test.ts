import { describe, it, expect } from 'vitest';
import { generate } from './generate';
import { area, edges, validGeometry } from './topology';
import { parseProject, serializeProject } from '../io/project';
import { exportSvg } from '../io/svg';
describe('malla territorial',()=> {
  it('es determinista y cambia con la semilla',()=> {
    const a=generate({count:32,seed:'atlas',irregularity:.8});
    expect(a).toEqual(generate(a.generation));
    expect(a.vertices).not.toEqual(generate({...a.generation,seed:'otra'}).vertices);
  });
  for(const count of [4,32,120])for(const seed of ['horizonte-01','1','islas',''])it(`cubre el lienzo sin cruces: ${count}/${seed}`,()=> {
    const p=generate({count,seed,irregularity:1});
    expect(p.territories).toHaveLength(count);
    expect(validGeometry(p)).toBe(true);
    expect(p.territories.reduce((n,t)=>n+area(t.vertices.map(id=>p.vertices[id])),0)).toBeCloseTo(p.width*p.height,2);
    const used=p.territories.flatMap(t=>t.vertices.map((a,i)=>[a,t.vertices[(i+1)%t.vertices.length]].sort().join(':')));
    const incidence=new Map<string,number>();used.forEach(k=>incidence.set(k,(incidence.get(k)||0)+1));
    expect([...incidence.values()].every(n=>n===1||n===2)).toBe(true);
    edges(p).forEach(([a,b])=> {if(incidence.get([a,b].sort().join(':'))===1){const A=p.vertices[a],B=p.vertices[b];expect((A.x===B.x&&(A.x===0||A.x===p.width))||(A.y===B.y&&(A.y===0||A.y===p.height))).toBe(true);}});
    expect(parseProject(serializeProject(p))).toEqual(p);
  });
  it('la irregularidad modifica fronteras sin cambiar la cantidad',()=> {
    const opts={count:20,seed:'atlas',irregularity:0};
    const a=generate(opts),b=generate({...opts,irregularity:1});
    expect(a.vertices).not.toEqual(b.vertices);expect(a.territories.length).toEqual(b.territories.length);
  });
  it('rechaza cruces, referencias rotas y versiones desconocidas',()=> {
    const p=generate({count:12,seed:'atlas',irregularity:1});
    expect(()=>parseProject(JSON.stringify({...p,version:4}))).toThrow();
    const broken=structuredClone(p);broken.territories[0].vertices[0]='missing';expect(()=>parseProject(JSON.stringify(broken))).toThrow();
    const crossed=structuredClone(p);const ids=crossed.territories[0].vertices;[crossed.vertices[ids[0]],crossed.vertices[ids[2]]]=[crossed.vertices[ids[2]],crossed.vertices[ids[0]]];expect(validGeometry(crossed)).toBe(false);
  });
  it('escapa nombres en SVG y omite etiquetas cuando se pide',()=> {
    const p=generate({count:4,seed:'x',irregularity:0});p.title='<script>&';p.territories[0].name='A & B < C';
    const svg=exportSvg(p);expect(svg).not.toContain('<script>');expect(svg).toContain('&lt;script&gt;&amp;');expect(svg).toContain('A &amp; B &lt; C');expect(svg).toContain('width="297mm"');expect(exportSvg(p,false)).not.toContain('A &amp; B');
  });
});
