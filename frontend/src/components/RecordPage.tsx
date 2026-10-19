import { useEffect } from 'react';
import type { ReactNode } from 'react';
import type { DisplayZone } from '../lib/preferences';
import { ArrowRight, CalendarDays, ChevronLeft, ChevronRight, Database } from 'lucide-react';
import { PatientShell } from './PatientShell';
import { AppLink } from './AppLink';
import { ArchiveLoader } from './WorkspaceUI';
import { saveSession, useArchive, useDemoSession } from '../lib/monitoring';
import type { Archive, PatientState } from '../lib/monitoring';
import { timestamp, usePatientHistory } from '../lib/patient-data';
import type { PatientHistory } from '../lib/patient-data';
import {outlookPath} from '../lib/outlook7';
import { useSearch } from '../lib/navigation';
import { qualityPath, reportPath, snapshotIndex } from '../lib/record-routes';

export interface RecordContext { history:PatientHistory; state:PatientState; index:number; archive:Archive }
export function RecordPage({ patientId,section,children }: { patientId?:string;section:'data'|'reports'|'outlook';children:(context:RecordContext)=>ReactNode }) {
  const { archive,error,retry } = useArchive();
  const session = useDemoSession();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const id = patientId ?? params.get('patient') ?? session.patientId;
  const states = archive ? [...archive.sourceStates,...archive.syntheticStates] : [];
  const patient = states.find(row => row.patient_id === id);
  useEffect(() => {
    if (patient && (session.patientId !== patient.patient_id || session.origin !== patient.data_origin)) saveSession({...session,patientId:patient.patient_id,origin:patient.data_origin});
  },[patient,session]);
  if (!archive) return <div className="pulmira-app"><ArchiveLoader error={error} retry={retry} /></div>;
  if (!patient) return <div className="pulmira-app patient-not-found"><Database size={30} /><h1>That demo profile isn’t in this archive.</h1><p>Choose a known public source participant or fictional illustration.</p><AppLink href="/app/dashboard" className="ui-button ui-button-primary">Back to directory <ArrowRight size={16} /></AppLink></div>;
  return <PatientShell state={patient} states={states} section={section} reportDetail={section==='reports'} selectedAsOf={params.get('asOf')}><RecordLoader key={`${id}:${patient.data_origin}`} patient={patient} requested={params.get('asOf')} section={section} archive={archive}>{children}</RecordLoader></PatientShell>;
}
function RecordLoader({ patient,requested,section,archive,children }: { patient:PatientState;requested:string|null;section:'data'|'reports'|'outlook';archive:Archive;children:(context:RecordContext)=>ReactNode }) {
  const { history,error,retry } = usePatientHistory(patient.patient_id,patient.data_origin);
  if (!history) return <ArchiveLoader error={error} retry={retry} />;
  const index = snapshotIndex(history,requested);
  if (index < 0) return <InvalidDecision href={section==='outlook' ? outlookPath(patient.patient_id) : section==='data' ? qualityPath(patient.patient_id) : reportPath(patient.patient_id)} />;
  return children({history,state:history.snapshots[index],index,archive});
}
export function InvalidDecision({href}:{href:string}) {
  return <div className="patient-empty decision-error" role="alert"><CalendarDays size={30} /><h2>That historical decision isn’t in this bundle.</h2><p>The page has not substituted a different time. Choose the final snapshot to continue.</p><AppLink href={href} className="ui-button ui-button-primary">Use final snapshot <ArrowRight size={16} /></AppLink></div>;
}
export function DecisionSelector({history,index,onSelect,timeZone}:{history:PatientHistory;index:number;timeZone?:DisplayZone;onSelect:(index:number)=>void}) {
  return <section className="patient-time-panel quality-time-panel" aria-label="Historical decision controls"><div><span className="time-icon"><CalendarDays size={20} /></span><label htmlFor="record-decision">Historical decision<select id="record-decision" value={index} onChange={event=>onSelect(Number(event.target.value))}>{history.snapshots.map((state,i)=><option key={state.as_of} value={i}>{timestamp(state.as_of,timeZone)}{i===history.snapshots.length-1?' · final snapshot':''}</option>)}</select></label></div><div className="time-controls"><button className="icon-button" aria-label="Previous historical snapshot" disabled={index===0} onClick={()=>onSelect(index-1)}><ChevronLeft size={18}/></button><span>{index+1} / {history.snapshots.length}</span><button className="icon-button" aria-label="Next historical snapshot" disabled={index===history.snapshots.length-1} onClick={()=>onSelect(index+1)}><ChevronRight size={18}/></button><button className="time-reset" onClick={()=>onSelect(history.snapshots.length-1)}>Final</button></div></section>;
}
