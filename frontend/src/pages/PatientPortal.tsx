import {Outlook7Card} from '../components/Outlook7';
import { checkInHistory, submitCheckIn } from '../lib/server-checkins';
import type { ServerCheckIn } from '../lib/server-checkins';
import { TechnicalExports } from '../components/TechnicalExports';
import { checkInsCsv, downloadCsv } from '../lib/csv-exports';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, ArrowDownToLine, ArrowRight, ArrowUpRight, CalendarHeart, Check, CheckCheck, ChevronRight, Clock3, FileHeart, HeartPulse, Info, LockKeyhole, ShieldCheck } from 'lucide-react';
import { AppLink } from '../components/AppLink';
import { PatientShell } from '../components/PatientShell';
import { ArchiveLoader } from '../components/WorkspaceUI';
import { SourceDiary } from './PatientWorkspace';
import { CHANNEL_NAMES, CHANNEL_ORDER, exportJson, formatDate, formatValue, saveSession, useArchive, useDemoSession } from '../lib/monitoring';
import type { PatientState } from '../lib/monitoring';
import { timestamp } from '../lib/patient-data';
import { createCheckIn, EMPTY_ANSWERS, SYMPTOM_FIELDS } from '../lib/checkins';
import type { Answers, BrowserCheckIn, SymptomField } from '../lib/checkins';
import { navigate } from '../lib/navigation';

const QUESTIONS: { field: SymptomField; title: string; detail: string }[] = [
  { field:'dyspnea_worse_than_usual', title:'Is your breathlessness worse than usual?', detail:'Compare with what is usual for this fictional profile.' },
  { field:'cough_worse_than_usual', title:'Is your cough worse than usual?', detail:'Choose Unsure when you cannot confidently compare.' },
  { field:'sputum_change', title:'Has your sputum changed?', detail:'For example, a change in colour, amount or thickness.' },
];
export function PatientPortal({ checkIn = false }: { checkIn?: boolean }) {
  const { archive, error, retry } = useArchive();
  const session = useDemoSession();
  const states = archive ? [...archive.sourceStates, ...archive.syntheticStates] : [];
  const patient = states.find(state => state.patient_id === session.patientId && state.data_origin === session.origin) || states.find(state => state.data_origin === session.origin);
  useEffect(() => { document.title = `${checkIn ? 'Symptom check-in' : 'Patient portal'} · Pulmira`; }, [checkIn]);
  if (!archive || !patient) return <div className="pulmira-app"><ArchiveLoader error={error} retry={retry} /></div>;
  return <PatientShell state={patient} states={states} portal><PortalContent key={patient.patient_id} state={patient} checkIn={checkIn} /></PatientShell>;
}
function PortalContent({ state, checkIn }: { state: PatientState; checkIn: boolean }) {
  const session = useDemoSession();
  const [records, setRecords] = useState<ServerCheckIn[]>([]);
  const [storageError, setStorageError] = useState('');
  const synthetic = state.data_origin === 'synthetic';
  const refresh=useCallback(async(signal?:AbortSignal)=>{if(!synthetic)return;try{const entries=await checkInHistory(state.patient_id,signal);if(!signal?.aborted){setRecords(entries);setStorageError('');}}catch(reason){if(!signal?.aborted)setStorageError(reason instanceof Error?reason.message:'Unable to read server check-in history.');}},[synthetic,state.patient_id]);
  useEffect(()=>{const controller=new AbortController();void Promise.resolve().then(()=>refresh(controller.signal));return()=>controller.abort();},[refresh]);
  const switchToFictional = () => { saveSession({ ...session, role:'patient', patientId:'DEMO-SYNTHETIC-002', origin:'synthetic' }); navigate('/patient/check-in'); };
  return <>
    <div className="portal-route-tabs" aria-label="Patient portal pages"><AppLink href="/patient" aria-current={!checkIn ? 'page' : undefined}>My overview</AppLink><AppLink href="/patient/check-in" aria-current={checkIn ? 'page' : undefined}>Symptom check-in</AppLink><AppLink href={`/app/patients/${state.patient_id}`}>Detailed workspace <ArrowUpRight size={13} /></AppLink></div>
    <section className="portal-welcome"><div><p className="eyebrow">YOUR PATIENT SPACE · {state.patient_id}</p><h1>{checkIn ? <>A little check-in.<br /><em>A little more context.</em></> : <>Your observations.<br /><em>A little clearer.</em></>}</h1><p>{checkIn ? 'Three questions about everyday symptoms, with room for uncertainty.' : 'Explore your recorded measurements and the everyday context around them.'}</p><span className="portal-welcome-pill"><Clock3 size={13} /> Historical snapshot · {formatDate(state.as_of)}</span></div><div className="portal-welcome-art"><img src="/assets/digital_lung_1791213475161.jpg" alt="Decorative respiratory illustration" /><div><HeartPulse size={20} /><span>Every observation<br /><strong>has its own context.</strong></span></div></div></section>
    <div className="portal-source-note"><Info size={16} /><p>{synthetic ? 'You are exploring a fictional profile. Archived measurements and the original diary use a 2025 demo clock. New check-ins use your current browser time and stay separate.' : 'These are public historical observations, not current readings or a live patient account. Check-in practice is available separately with the fictional profile.'}</p></div>
    {checkIn ? <div className="portal-checkin-layout"><section className="patient-panel checkin-card"><div className="patient-section-heading"><div><p className="eyebrow">A MOMENT FOR EVERYDAY CONTEXT</p><h2>Your symptom check-in</h2></div><span className="checkin-heading-icon"><CalendarHeart size={23} /></span></div>{synthetic && session.role==='patient' ? <CheckInForm patientId={state.patient_id} onSaved={refresh} /> : <div className="source-checkin-block"><span><LockKeyhole size={26} /></span><h3>{synthetic?'Choose the patient demo to submit.':'This source archive is read-only.'}</h3><p>Only the bound fictional patient session can submit a report. Historical source participants remain read-only.</p><button className="ui-button ui-button-primary" onClick={switchToFictional}>Try the fictional check-in <ArrowRight size={16} /></button><small>You’ll switch to DEMO-SYNTHETIC-002.</small></div>}</section><aside className="checkin-aside"><article className="patient-panel checkin-explainer"><span className="soft-icon"><ShieldCheck size={23} /></span><h2>Good context<br />includes uncertainty.</h2><p>Choose Yes, No or Unsure for each question. No answer is selected for you.</p><div><Check size={15} /><span>Unsure stays unknown.</span></div><div><Check size={15} /><span>No seven-day risk is calculated.</span></div><div><Check size={15} /><span>No clinician is notified.</span></div><div className="browser-only-note"><strong>Persistent demo check-in</strong><p>The local backend stores submitted entries and assigns a UTC receipt. No clinical notification is sent.</p></div></article><article className="patient-panel portal-recent"><div className="patient-panel-title"><Clock3 size={18} /><h2>Recent demo check-ins</h2></div><CheckInHistory records={records.slice(0,3)} error={storageError} compact /><AppLink href="/patient" className="text-link">View your overview <ArrowRight size={14} /></AppLink></article></aside></div> : <>
      <div className="portal-overview-layout"><section className="patient-panel portal-measurements"><div className="patient-section-heading"><div><p className="eyebrow">THE RECORDED PICTURE</p><h2>Your latest archived readings</h2></div><Activity size={20} /></div><p className="patient-secondary">Values and their age are relative to {timestamp(state.as_of)}.</p><div className="portal-reading-grid">{CHANNEL_ORDER.map(channel => {
        const matches = state.channels.filter(row => row.channel === channel);
        return <article key={channel}><span>{CHANNEL_NAMES[channel]}</span>{matches.length ? matches.map(row => <div key={`${row.context}:${row.source_series_id}`}><strong>{formatValue(row)}</strong><p>{row.context.replaceAll('_',' ')}</p><small>{formatDate(row.measurement_end)} · {Math.round(row.measurement_age_hours).toLocaleString()} h old at snapshot</small><span className={`state-badge ${row.freshness === 'fresh' ? 'state-fresh' : 'state-archived'}`}>{row.freshness === 'fresh' ? 'Fresh at snapshot' : row.freshness === 'stale' ? 'Stale reading' : 'Invalid reading'}</span></div>) : <div><strong>—</strong><p>Not observed</p><small>A missing value is not a normal reading.</small></div>}</article>;
      })}</div><AppLink href={`/app/patients/${state.patient_id}`} className="text-link">Explore the detailed history <ArrowUpRight size={14} /></AppLink></section><aside className="portal-overview-aside"><article className="portal-checkin-prompt"><span><CalendarHeart size={26} /></span><p className="eyebrow">EVERYDAY CONTEXT</p><h2>How has the<br />day been?</h2><p>A short symptom check-in helps you explore how a patient diary could work.</p><AppLink href="/patient/check-in" className="ui-button ui-button-primary">{synthetic ? 'Start a demo check-in' : 'Explore symptom check-in'} <ArrowRight size={16} /></AppLink><small>Fictional practice · Server receipt</small></article><Outlook7Card state={state}/><article className="patient-panel care-plan-note"><FileHeart size={21} /><h3>Care plan</h3><p>No clinician-provided care plan is supplied with this demonstration.</p></article></aside></div>
      <div className="portal-history-layout"><section className="patient-panel" id="demo-checkin-history"><div className="patient-section-heading"><div><p className="eyebrow">RECEIVED BY THE BACKEND</p><h2>Demo check-in history</h2></div><div className="export-actions"><button className="ui-button ui-button-white" disabled={!records.length||!!storageError} onClick={()=>downloadCsv(`pulmira-${state.patient_id}-server-check-ins.csv`,checkInsCsv(records))}><ArrowDownToLine size={15}/>Download check-ins CSV</button><TechnicalExports items={[{label:'Download check-in history',disabled:!records.length||!!storageError,onSelect:()=>exportJson(`pulmira-${state.patient_id}-server-check-ins.json`,{schema_version:'pulmira-server-check-in-export-1.0.0',patient_id:state.patient_id,data_origin:state.data_origin,server_connected:true,entries:records})}]}/></div></div><p className="patient-secondary">These practice entries are separate from archived source diaries. No report has been sent to a clinician.</p><CheckInHistory records={records} error={storageError} /></section><section className="patient-panel"><div className="patient-panel-title"><FileHeart size={18} /><h2>Diary in the archived snapshot</h2></div><SourceDiary state={state} /></section></div>
    </>}
  </>;
}
function CheckInForm({ patientId, onSaved }: { patientId: string; onSaved: () => void }) {
  const [answers, setAnswers] = useState<Answers>({ ...EMPTY_ANSWERS });
  const onsetInput = useRef<HTMLInputElement>(null);
  const [offset, setOffset] = useState('+00:00');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState<ServerCheckIn | null>(null);
  const pending=useRef<{fingerprint:string;entry:BrowserCheckIn}|null>(null);
  const feedback = useRef<HTMLDivElement>(null);
  const completed = SYMPTOM_FIELDS.filter(field => !!answers[field]).length;
  useEffect(() => { if (status === 'saved' || status === 'error') feedback.current?.focus(); }, [status]);
  return <form className="symptom-form" noValidate onSubmit={async event => {
    event.preventDefault(); if (status === 'saving' || status === 'saved') return;
    setError(''); setStatus('saving');
    try {
      if (onsetInput.current && !onsetInput.current.validity.valid) throw new Error('Enter a complete symptom-start date and time, or leave it blank.');
      const fingerprint=JSON.stringify({answers,onset:onsetInput.current?.value||'',offset});
      if(pending.current?.fingerprint!==fingerprint)pending.current={fingerprint,entry:createCheckIn(patientId,'synthetic',answers,onsetInput.current?.value||'',offset)};
      const receipt=await submitCheckIn(pending.current.entry);
      setSaved(receipt); setStatus('saved'); onSaved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The backend did not confirm this check-in. Your answers remain available for retry.');
      setStatus('error');
    }
  }}>
    <div className="checkin-progress"><span>{completed} of 3 questions answered</span><div aria-hidden="true">{[1,2,3].map(i => <i key={i} className={completed >= i ? 'complete' : ''} />)}</div></div>
    <p className="patient-secondary">Use this fictional profile to try the workflow. Select an answer for every question; choose Unsure when the answer is unknown.</p>
    <fieldset className="checkin-fields" disabled={status === 'saving' || status === 'saved'}><legend className="visually-hidden">Daily symptom questions</legend>{QUESTIONS.map(({field,title,detail},i) => <fieldset className="symptom-question" key={field}><legend><span>0{i+1}</span>{title}</legend><p>{detail}</p><div className="symptom-answers">{(['yes','no','unsure'] as const).map(answer => <label key={answer} className={answers[field] === answer ? 'answer-selected' : ''}><input type="radio" name={field} value={answer} checked={answers[field] === answer} onChange={() => { setAnswers(value => ({ ...value, [field]:answer })); if (status === 'error') setStatus('idle'); }} /><span>{answer === 'yes' ? 'Yes' : answer === 'no' ? 'No' : 'Unsure'}</span>{answers[field] === answer && <Check size={14} />}</label>)}</div></fieldset>)}
    <div className="symptom-onset"><label htmlFor="symptom-onset">When did these changes start? <span>Optional</span></label><p>If the time is uncertain, leave this blank. A date without a time is not assumed to be exact.</p><div><input ref={onsetInput} id="symptom-onset" type="datetime-local" /><select aria-label="Symptom-start timezone" value={offset} onChange={event => setOffset(event.target.value)}><option value="+00:00">UTC (+00:00)</option><option value="+05:30">IST (+05:30)</option><option value="+01:00">UTC +01:00</option><option value="+02:00">UTC +02:00</option></select></div><small>New check-in time: assigned by this browser when you save.</small></div></fieldset>
    {status === 'error' && <div className="checkin-feedback checkin-error" role="alert" tabIndex={-1} ref={feedback}><Info size={20} /><div><strong>Check-in not saved</strong><p>{error}</p></div></div>}
    {status === 'saved' && saved ? <div className="checkin-feedback checkin-success" role="status" tabIndex={-1} ref={feedback}><CheckCheck size={24} /><div><strong>Received by the backend</strong><p>{timestamp(saved.client_collected_at)} · {patientId}</p><p>Server receipt: {timestamp(saved.server_received_at)}. No clinician was notified. Archived measurements are unchanged.</p><div className="saved-actions"><button type="button" className="text-link" onClick={()=>downloadCsv(`pulmira-${saved.id}-demo-check-in.csv`,checkInsCsv([saved]))}>Download entry CSV <ArrowDownToLine size={14}/></button><TechnicalExports align="start" items={[{label:'Download check-in entry',onSelect:()=>exportJson(`pulmira-${saved.id}-demo-check-in.json`,saved)}]}/><button type="button" className="text-link" onClick={() => { setAnswers({...EMPTY_ANSWERS}); if (onsetInput.current) onsetInput.current.value = ''; setSaved(null);pending.current=null;setStatus('idle'); }}>Start another <ArrowRight size={14} /></button></div></div></div> : <><div className="checkin-storage-note"><ShieldCheck size={17} /><p>Fictional demonstration only. Saving sends this fictional report to your local backend. A confirmed server receipt is required for success.</p></div><button className="ui-button ui-button-primary checkin-submit" type="submit" disabled={status === 'saving'}>{status === 'saving' ? 'Sending check-in…' : status === 'error' ? 'Try saving again' : 'Save demo check-in'} <ArrowRight size={17} /></button></>}
  </form>;
}
function CheckInHistory({ records, error, compact = false }: { records: ServerCheckIn[]; error: string; compact?: boolean }) {
  if (error) return <div className="checkin-history-error" role="alert"><Info size={20} /><p>{error} No empty history has been substituted. Retry by reopening this page.</p></div>;
  if (!records.length) return <div className={`patient-empty${compact ? ' compact-empty' : ''}`}><CalendarHeart size={27} /><h3>No submitted demo check-ins yet</h3><p>Saved fictional entries will appear here, with their own collection time.</p></div>;
  return <ol className={`checkin-history${compact ? ' compact-history' : ''}`}>{records.map(entry => <li key={entry.id}><details><summary><span className="history-check"><Check size={15} /></span><span><strong>{timestamp(entry.client_collected_at)}</strong><small>Server received · {entry.patient_id}</small></span><ChevronRight size={16} /></summary><div className="history-report"><dl>{QUESTIONS.map(({field,title}) => <div key={field}><dt>{title}</dt><dd>{entry[field] === null ? 'Unsure / unknown' : entry[field] ? 'Yes' : 'No'}</dd></div>)}<div><dt>Reported symptom start</dt><dd>{entry.reported_symptom_start_at ? timestamp(entry.reported_symptom_start_at) : 'Unknown'}</dd></div></dl><p>Server receipt: {timestamp(entry.server_received_at)} · No clinical validation</p></div></details></li>)}</ol>;
}
