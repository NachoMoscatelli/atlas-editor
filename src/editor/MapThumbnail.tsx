import type {MapProject} from '../model/types';
import {shapePath} from '../geometry/topology';
import {displayColor} from '../model/groups';
export function MapThumbnail({project:p}:{project:MapProject}){return <svg viewBox={`0 0 ${p.width} ${p.height}`} aria-hidden="true"><rect width={p.width} height={p.height} fill="#b8d7dc"/>{p.geography?.landforms.map(l=><path key={l.id} d={shapePath(p,l)} fill="#cfdbb1" fillRule="evenodd"/>)}{p.territories.map(t=><path key={t.id} d={shapePath(p,t)} fill={displayColor(p,t)} fillRule="evenodd" stroke="#637c68" strokeWidth="1.5"/>)}{p.geography?.mountains?.map(m=><path key={m.id} d={shapePath(p,m)} fill="#aa9675" fillRule="evenodd"/>)}</svg>;}
