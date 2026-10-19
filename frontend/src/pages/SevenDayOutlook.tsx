import {useEffect} from 'react';
import {ArrowRight,CalendarDays} from 'lucide-react';
import {RecordPage,DecisionSelector} from '../components/RecordPage';
import type {RecordContext} from '../components/RecordPage';
import {Outlook7Panel} from '../components/Outlook7';
import {AppLink} from '../components/AppLink';
import {outlookPath} from '../lib/outlook7';
import {navigate,useSearch} from '../lib/navigation';
import {timestamp} from '../lib/patient-data';

export function SevenDayOutlook(){
 const hasProfile=new URLSearchParams(useSearch()).has('patient');
 useEffect(()=>{document.title='7-day COPD outlook · Pulmira';},[]);
 return <RecordPage patientId={hasProfile?undefined:'DEMO-SYNTHETIC-002'} section="outlook">{context=><OutlookContent key={`${context.state.patient_id}:${context.state.as_of}`} {...context}/>}</RecordPage>;
}
function OutlookContent({state,history,index}:RecordContext){
 return <><section className="bench-hero outlook7-hero"><div><p className="eyebrow">7-DAY COPD OUTLOOK · FORMULA-BASED</p><h1>The next seven days.<br/><em>With every factor in view.</em></h1><p>Explore a transparent seven-day projection of physiological change and recent symptom reports for {state.patient_id}. {state.data_origin==='synthetic'?'This is the clearly marked fictional working example.':'This source profile is assessed only from its available historical inputs.'}</p><div className="sim-hero-tags"><span><CalendarDays size={14}/>Seven future UTC dates</span><span>Unvalidated heuristic · no ML claim</span></div></div><div className="outlook7-calendar-art" aria-hidden="true"><CalendarDays size={43}/><strong>7</strong><span>days ahead</span></div></section><DecisionSelector history={history} index={index} onSelect={i=>navigate(outlookPath(history.patientId,history.snapshots[i].as_of))}/><div className="data-clock-note"><CalendarDays size={15}/><p>Projection from {timestamp(state.as_of)}. This historical clock is separate from today.</p>{state.data_origin!=='synthetic'&&<AppLink href={outlookPath('DEMO-SYNTHETIC-002')} className="text-link">Open the fictional example <ArrowRight size={14}/></AppLink>}</div><Outlook7Panel state={state}/></>;
}
