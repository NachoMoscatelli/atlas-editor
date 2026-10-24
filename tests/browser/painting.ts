import React from 'react';
import {createRoot} from 'react-dom/client';
import {GeographyDialog} from '../../src/editor/GeographyDialog';
import {generate} from '../../src/geometry/generate';
import {intersection,multiArea,polygonOf} from '../../src/geometry/polygons';
import {parseProject,serializeProject} from '../../src/io/project';
import {exportSvg} from '../../src/io/svg';
import '../../src/styles.css';
const button=document.querySelector<HTMLButtonElement>('#run')!,results=document.querySelector<HTMLPreElement>('#results')!;
const wait=async(test:()=>boolean)=>{for(let i=0;i<200;i++){if(test())return;await new Promise(r=>setTimeout(r,25));}throw new Error('Tiempo de espera agotado.');};
button.onclick=async()=>{button.disabled=true;results.textContent='Comprobando…';const root=createRoot(document.querySelector('#fixture')!);const passed:string[]=[];
  const assert=(value:unknown,name:string)=>{if(!value)throw new Error(name);passed.push('✓ '+name);};
  try{let applied=false;const options={count:8,seed:'fixture-paint',irregularity:.6,segments:2,widthMm:700,heightMm:500};
    root.render(React.createElement(GeographyDialog,{project:generate(options),options,editExisting:false,onClose:()=>{},onApply:p=>{assert(p.geography!.landforms.length===2,'Anillo de agua: dos masas reales');assert(p.geography!.mountains!.length>0,'Montañas guardadas como geometría');assert(multiArea(intersection(p.territories.map(t=>polygonOf(p,t)),p.geography!.mountains!.map(m=>polygonOf(p,m))))===0,'Ningún territorio sobre montañas');assert(parseProject(serializeProject(p)).version===5,'Guardado y carga v5');assert(exportSvg(p).includes('fill="url(#atlas-mountains)"'),'SVG con textura de montañas');applied=true;}}));
    await wait(()=>!!document.querySelector('dialog[open] svg'));const svg=document.querySelector<SVGSVGElement>('dialog svg')!,box=svg.viewBox.baseVal;
    // Pointer capture requires a native active pointer. Stub only in this fixture.
    svg.setPointerCapture=()=>{};svg.releasePointerCapture=()=>{};
    const click=(text:string)=>{const b=[...document.querySelectorAll<HTMLButtonElement>('dialog button')].find(b=>b.textContent===text);if(!b||b.disabled)throw new Error('Control no disponible: '+text);b.click();};
    const stroke=async(points:[number,number][])=>{const matrix=svg.getScreenCTM()!;const event=(type:string,q:[number,number])=>{const p=new DOMPoint(q[0]*box.width,q[1]*box.height).matrixTransform(matrix);svg.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:9,pointerType:'mouse',button:0,buttons:type==='pointerup'?0:1,clientX:p.x,clientY:p.y}));};event('pointerdown',points[0]);points.slice(1).forEach(p=>event('pointermove',p));event('pointerup',points.at(-1)!);await wait(()=>![...document.querySelectorAll<HTMLButtonElement>('dialog button')].find(b=>b.textContent==='Vaciar dibujo')!.disabled);await new Promise(r=>setTimeout(r,50));};
    await stroke([[.08,.08],[.92,.08],[.92,.92],[.08,.92]]);assert(document.querySelectorAll('[data-landmass]').length===1,'Contorno libre cerrado crea tierra');
    click('Deshacer trazo');await wait(()=>document.querySelectorAll('[data-landmass]').length===0);click('Rehacer trazo');await wait(()=>document.querySelectorAll('[data-landmass]').length===1);assert(true,'Deshacer y rehacer el dibujo');
    click('Agua · pincel');await new Promise(r=>setTimeout(r,30));await stroke(Array.from({length:49},(_,i)=>[.4+.16*Math.cos(i*Math.PI/24),.5+.16*Math.sin(i*Math.PI/24)] as [number,number]));assert(document.querySelectorAll('[data-landmass]').length===2,'Agua cerrada separa una isla');
    click('Montañas · pincel');await new Promise(r=>setTimeout(r,30));await stroke([[.75,.2],[.75,.8]]);assert(document.querySelectorAll('[data-landmass]').length===2,'Montañas conservan las masas');
    click('Continuar a territorios →');await wait(()=>!![...document.querySelectorAll('button')].find(b=>b.textContent==='Previsualizar territorios'));click('Previsualizar territorios');await wait(()=>!![...document.querySelectorAll<HTMLButtonElement>('dialog button')].find(b=>b.textContent==='Aplicar mapa'&&!b.disabled));click('Aplicar mapa');await wait(()=>applied);
    root.unmount();results.textContent=passed.join('\n')+'\n'+passed.length+' comprobaciones aprobadas.';
  }catch(e){root.unmount();results.textContent=passed.join('\n')+'\nERROR: '+(e as Error).message;}finally{button.disabled=false;}
};
