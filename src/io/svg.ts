import type { MapExporter, MapProject } from '../model/types';
import { displayColor } from '../model/groups';
import { mapBorders,groupLabels } from '../geometry/presentation';
import { shapePath } from '../geometry/topology';
import { printSize } from '../model/print';
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
export function exportSvg(p:MapProject,labels=true,areasOnly=false):string {
  const size=printSize(p);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size.widthMm}mm" height="${size.heightMm}mm" viewBox="${areasOnly?`0 0 ${p.width} ${p.height}`:`-40 -65 ${p.width+80} ${p.height+110}`}">
<title>${escape(p.title)}</title>${areasOnly?'':`<rect x="-40" y="-65" width="${p.width+80}" height="${p.height+110}" fill="#faf8f1"/>
<text x="0" y="-25" font-family="serif" font-size="25" fill="#263b35">${escape(p.title)}</text>`}
${p.geography?`<rect data-ocean="true" width="${p.width}" height="${p.height}" fill="${p.geography.waterColor}"/>`:''}
${p.version>=5?`<defs><pattern id="atlas-mountains" width="24" height="22" patternUnits="userSpaceOnUse"><rect width="24" height="22" fill="#c6b79b"/><path d="M-3 19 L5 5 L13 19 M9 24 L17 10 L25 24 M3 8 L5 5 L7 8" fill="none" stroke="#806e57" stroke-width="1.2"/></pattern></defs>\n${p.geography!.landforms.map(l=>`<path data-landmass="${escape(l.id)}" d="${shapePath(p,l)}" fill-rule="evenodd" fill="#cfdbb1"/>`).join('\n')}\n${(p.geography!.mountains??[]).map(l=>`<path data-mountain="${escape(l.id)}" d="${shapePath(p,l)}" fill-rule="evenodd" fill="url(#atlas-mountains)"/>`).join('\n')}`:''}
${p.territories.map(t=>`<path data-surface="${t.surface}" data-region="${escape(t.regionId??'')}" d="${shapePath(p,t)}" fill-rule="evenodd" fill="${displayColor(p,t)}" stroke="none" stroke-width="1.5" stroke-linejoin="round"/>`).join('\n')}
${mapBorders(p).map(e=>`<line x1="${p.vertices[e.a].x}" y1="${p.vertices[e.a].y}" x2="${p.vertices[e.b].x}" y2="${p.vertices[e.b].y}" stroke="${e.internal?'#899784':'#3c4c43'}" stroke-width="${e.internal?'0.8':'1.5'}"${e.internal?' stroke-dasharray="4 3"':''}/>`).join('\n')}
${labels?groupLabels(p).map(g=>`<text x="${g.x}" y="${g.y}" text-anchor="middle" font-family="Arial,sans-serif" font-weight="bold" font-size="13" fill="#233a33">${escape(g.name)}</text>`).join('\n'):''}
${labels?p.territories.map(t=>`<text x="${t.label.x}" y="${t.label.y}" text-anchor="middle" dominant-baseline="middle" font-family="Arial,sans-serif" font-size="11" fill="#233a33">${escape(t.name)}</text>`).join('\n'):''}
</svg>`;
}
export const svgExporter:MapExporter={id:'svg',extension:'svg',mimeType:'image/svg+xml',export:exportSvg};
