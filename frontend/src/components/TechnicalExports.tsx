import { useEffect, useRef } from 'react';
import { ArrowDownToLine, ChevronDown, FileJson2 } from 'lucide-react';

/** Native disclosure: keyboard-operable, dismissed by Escape/outside click, JSON stays secondary. */
export function TechnicalExports({items,description='Full-precision structured data for developers and verification.',align='end'}:{items:{label:string;onSelect:()=>void;disabled?:boolean;format?:'JSON'|'PDF'}[];description?:string;align?:'start'|'end'}){
 const ref=useRef<HTMLDetailsElement>(null);
 useEffect(()=>{
  const close=(event:PointerEvent)=>{if(ref.current?.open&&!ref.current.contains(event.target as Node))ref.current.open=false;};
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&ref.current?.open){event.preventDefault();event.stopPropagation();ref.current.open=false;ref.current.querySelector('summary')?.focus();}};
  document.addEventListener('pointerdown',close);document.addEventListener('keydown',escape);return()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',escape);};
 },[]);
 return <details ref={ref} className={`technical-exports align-${align}`}><summary className="ui-button ui-button-white" aria-label="Advanced technical exports">Advanced <ChevronDown size={14}/></summary><div className="technical-export-panel" role="group" aria-label="Technical exports"><span><FileJson2 size={16}/>Technical exports</span><p>{description}</p>{items.map(item=><button key={item.label} type="button" disabled={item.disabled} onClick={()=>{item.onSelect();if(ref.current){ref.current.open=false;ref.current.querySelector('summary')?.focus();}}}><ArrowDownToLine size={14}/>{item.label}<small>{item.format??'JSON'}</small></button>)}</div></details>;
}
