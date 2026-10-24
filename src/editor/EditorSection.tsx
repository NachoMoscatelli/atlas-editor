import type { ReactNode } from 'react';

export function EditorSection({title,caption,open,onToggle,children}:{title:string;caption?:string;open:boolean;onToggle:()=>void;children:ReactNode}) {
  return <details className="editor-section" open={open}>
    <summary onClick={e=>{e.preventDefault();onToggle();}}><span>{title}</span>{caption&&<small>{caption}</small>}<span className="section-chevron" aria-hidden="true">⌄</span></summary>
    <div className="editor-section-body">{children}</div>
  </details>;
}
