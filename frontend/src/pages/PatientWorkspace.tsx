import {Outlook7Card} from '../components/Outlook7';
import {outlookPath} from '../lib/outlook7';
import { MonitoringSummary } from '../components/BackendConnection';
import { TechnicalExports } from '../components/TechnicalExports';
import { downloadCsv, snapshotsCsv } from '../lib/csv-exports';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, ArrowDownToLine, ArrowRight, ArrowUpRight, CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, Database, FileHeart, Footprints, HeartPulse, Info, Layers3, Pause, Play, RotateCcw, ShieldCheck, Wind } from 'lucide-react';
import { PatientShell } from '../components/PatientShell';
import { AppLink } from '../components/AppLink';
import { ArchiveLoader } from '../components/WorkspaceUI';
import { ObservationChart } from '../components/ObservationChart';
import { CHANNEL_NAMES, CHANNEL_ORDER, channelCount, exportJson, formatDate, formatValue, saveSession, siteOf, useArchive, useDemoSession } from '../lib/monitoring';
import type { Channel, PatientState } from '../lib/monitoring';
import { diaryFromState, seriesKey, timestamp, usePatientHistory, visibleObservations } from '../lib/patient-data';
import type { PatientHistory } from '../lib/patient-data';
import { navigate,useSearch } from '../lib/navigation';
import { patientPath,qualityPath,reportPath,snapshotIndex } from '../lib/record-routes';
import { InvalidDecision } from '../components/RecordPage';

const TABS = ['Overview', 'Monitoring', 'Exposure', 'Timeline', 'Diary'] as const;
type Tab = typeof TABS[number];
const ICONS = [Activity, HeartPulse, Wind, Clock3, Footprints, Wind];
export function PatientWorkspace({ patientId }: { patientId: string }) {
  const { archive, error, retry } = useArchive();
  const session = useDemoSession();
  const search = useSearch();
  const states = archive ? [...archive.sourceStates, ...archive.syntheticStates] : [];
  const patient = states.find(state => state.patient_id === patientId);
  useEffect(() => {
    document.title = `${patientId} · Patient workspace · Pulmira`;
    if (patient && (session.patientId !== patient.patient_id || session.origin !== patient.data_origin)) saveSession({ ...session, patientId: patient.patient_id, origin: patient.data_origin });
  }, [patient, patientId, session]);
  if (!archive) return <div className="pulmira-app"><ArchiveLoader error={error} retry={retry} /></div>;
  if (!patient) return <div className="pulmira-app patient-not-found"><Database size={32} /><h1>That demo profile isn’t in this archive.</h1><p>Choose a source participant or the fictional example from the directory.</p><AppLink href="/app/dashboard" className="ui-button ui-button-primary">Back to directory <ArrowRight size={16} /></AppLink></div>;
  return <PatientShell state={patient} states={states} selectedAsOf={new URLSearchParams(search).get('asOf')}><PatientHistoryContent key={`${patient.data_origin}:${patient.patient_id}`} patient={patient} /></PatientShell>;
}
function PatientHistoryContent({ patient }: { patient: PatientState }) {
  const { history, error, retry } = usePatientHistory(patient.patient_id, patient.data_origin);
  const search = useSearch();
  if (!history) return <ArchiveLoader error={error} retry={retry} />;
  const index = snapshotIndex(history,new URLSearchParams(search).get('asOf'));
  if (index < 0) return <InvalidDecision href={patientPath(patient.patient_id)} />;
  return <PatientRecord history={history} index={index} />;
}
function PatientRecord({ history,index }: { history: PatientHistory;index:number }) {
  const [tab, setTab] = useState<Tab>('Overview');
  const setIndex = (value:number) => navigate(patientPath(history.patientId,history.snapshots[value].as_of));
  const [playing, setPlaying] = useState(false);
  const [chosenSeries, setChosenSeries] = useState('');
  const [exported, setExported] = useState(false);
  const tabs = useRef<HTMLDivElement>(null);
  const state = history.snapshots[index];
  const last = history.snapshots.length - 1;
  const observations = useMemo(() => visibleObservations(history.observations, state.as_of), [history.observations, state.as_of]);
  const series = state.channels.find(row => seriesKey(row) === chosenSeries) || state.channels.find(row => row.channel === 'spo2_pct') || state.channels[0];
  const seriesRows = series ? observations.filter(row => seriesKey(row) === seriesKey(series)) : [];
  const aqiSeries = state.channels.filter(row => row.channel === 'aqi_index');
  useEffect(() => {
    if (!playing || index >= last) return;
    const timeout = setTimeout(() => { if (index + 1 >= last) setPlaying(false); navigate(patientPath(history.patientId,history.snapshots[index+1].as_of)); }, 1400);
    return () => clearTimeout(timeout);
  }, [playing, index, last, history]);
  useEffect(() => { if (exported) { const timeout = setTimeout(() => setExported(false), 3500); return () => clearTimeout(timeout); } }, [exported]);
  const selectIndex = (value: number) => { setPlaying(false); setIndex(value); };
  const downloadJson = () => { exportJson(`pulmira-${state.patient_id}-${state.as_of.slice(0,10)}-state.json`, state); setExported(true); };
  return <>
    <section className="patient-title-row"><div><p className="eyebrow">THE PATIENT WORKSPACE</p><h1>A closer look at <span>{state.patient_id}.</span></h1><p>Every observation, with the context that belongs to it.</p></div><div className="patient-title-actions"><AppLink href={reportPath(state.patient_id,state.as_of)} className="ui-button ui-button-white">View report <ArrowUpRight size={15} /></AppLink><AppLink href="/patient" className="ui-button ui-button-white">Patient portal <ArrowUpRight size={15} /></AppLink><button className="ui-button ui-button-primary" onClick={()=>{downloadCsv(`pulmira-${state.patient_id}-${state.as_of.replace(/[:.]/g,'-')}-readings.csv`,snapshotsCsv([state]));setExported(true);}}><ArrowDownToLine size={16}/>Download readings CSV</button><TechnicalExports items={[{label:'Download selected snapshot',onSelect:downloadJson}]}/></div></section>
    <div className="patient-identity-strip"><span><span className={`patient-monogram site-${state.patient_id.split('-')[0].toLowerCase()}`}>{state.data_origin === 'synthetic' ? 'SY' : state.patient_id.slice(0,2)}</span><strong>{state.patient_id}</strong><span className="identity-divider" />{state.data_origin === 'synthetic' ? 'Fictional contract illustration' : `${siteOf(state.patient_id)} · Public source participant`}</span><AppLink href={outlookPath(state.patient_id,state.as_of)}><ShieldCheck size={14} /> 7-day rule-based outlook</AppLink></div>
    <section className="patient-time-panel" aria-label="Historical decision controls"><div><span className="time-icon"><CalendarDays size={20} /></span><label htmlFor="snapshot-time">Historical decision<select id="snapshot-time" value={index} onChange={event => selectIndex(Number(event.target.value))}>{history.snapshots.map((snapshot, i) => <option key={snapshot.as_of} value={i}>{timestamp(snapshot.as_of)}{i === last ? ' · final snapshot' : ''}</option>)}</select></label></div><div className="time-controls"><button className="icon-button" aria-label="Previous historical snapshot" disabled={index === 0} onClick={() => selectIndex(index-1)}><ChevronLeft size={18} /></button><button className="time-play" disabled={last === 0} aria-label={playing ? 'Pause historical replay' : 'Play historical replay'} onClick={() => { if (playing) setPlaying(false); else { if (index === last) setIndex(0); setPlaying(true); } }}>{playing ? <Pause size={15} /> : <Play size={15} />}</button><button className="icon-button" aria-label="Next historical snapshot" disabled={index === last} onClick={() => selectIndex(index+1)}><ChevronRight size={18} /></button><button className="time-reset" onClick={() => selectIndex(last)}><RotateCcw size={13} /> Final</button><span aria-live="polite">{index+1} / {history.snapshots.length}</span></div></section>
    <p className="time-interpretation"><Clock3 size={13} /> Irregular historical snapshots. Measurement and availability dates are kept separate. Detailed times show their timezone; chart dates use UTC.</p>
    <div className="patient-tabs" role="tablist" aria-label="Patient workspace sections" ref={tabs}>{TABS.map((name, i) => <button key={name} role="tab" id={`patient-tab-${name}`} aria-selected={tab === name} tabIndex={tab === name ? 0 : -1} aria-controls="patient-tab-content" onClick={() => setTab(name)} onKeyDown={event => {
      let next = i;
      if (event.key === 'ArrowRight') next = (i+1)%TABS.length; else if (event.key === 'ArrowLeft') next = (i+TABS.length-1)%TABS.length; else if (event.key === 'Home') next = 0; else if (event.key === 'End') next = TABS.length-1; else return;
      event.preventDefault(); setTab(TABS[next]); tabs.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
    }}>{name}{name === 'Diary' && diaryFromState(state) && <i />}</button>)}</div>
    <section role="tabpanel" id="patient-tab-content" aria-labelledby={`patient-tab-${tab}`} className="patient-tab-content" tabIndex={0}>
      {tab === 'Overview' && <>
        <Outlook7Card state={state}/><MonitoringSummary state={state}/>
        <div className="patient-overview-grid"><div><div className="patient-section-heading"><h2>The recorded picture</h2><span className="neutral-pill">{channelCount(state)} of 6 channel types</span></div><div className="patient-metric-grid">{CHANNEL_ORDER.map((channel, i) => {
          const matches = state.channels.filter(row => row.channel === channel), Icon = ICONS[i];
          return <article className={`patient-metric${!matches.length ? ' metric-unseen' : ''}`} key={channel}><div className="metric-label"><span>{CHANNEL_NAMES[channel]}</span><Icon size={17} /></div>{matches.length ? matches.map(row => <div className="metric-stream" key={seriesKey(row)}><strong>{formatValue(row)}</strong><span>{row.context.replaceAll('_',' ')}</span><small><i />{row.freshness === 'fresh' ? 'Fresh at snapshot' : row.freshness === 'stale' ? 'Stale at snapshot' : 'Invalid reading'} · {Math.round(row.measurement_age_hours).toLocaleString()} h old</small></div>) : <><strong className="unseen-value">—</strong><span className="unseen-copy">Not observed by this decision time</span></>}</article>;
        })}</div></div><aside className="patient-twin-card"><p className="eyebrow">OBSERVED DIGITAL TWIN</p><h2>A source-linked<br />view of the patient.</h2><div className="patient-lung"><img src="/assets/digital_lung_1791213475161.jpg" alt="Decorative lung illustration, not patient anatomy" /><span>Anatomical illustration</span></div><div className="twin-card-facts"><div><span>Distinct series</span><strong>{state.channels.length}</strong></div><div><span>Missing channels</span><strong>{state.missing_channels.length}</strong></div><div><span>Decision date</span><strong>{formatDate(state.as_of)}</strong></div></div></aside></div>
        <div className="patient-bottom-grid"><article className="patient-panel"><div className="patient-panel-title"><Layers3 size={18} /><h2>Data behind this view</h2></div><p className="patient-secondary">These checks describe observation availability, not clinical stability.</p><div className="quality-summary"><div><span>Prior-day baseline support</span><strong>{state.channels.filter(row => row.baseline.mean !== null).length} / {state.channels.length} series</strong></div><div><span>Missing channel types</span><strong>{state.missing_channels.length ? state.missing_channels.map(channel => CHANNEL_NAMES[channel]).join(', ') : 'All six types observed'}</strong></div><div><span>Physical device identity</span><strong>{state.channels.length ? state.channels.every(row => row.device_id) ? 'Declared in source packet' : 'Some metadata not established' : 'No observed series'}</strong></div></div><AppLink href={qualityPath(state.patient_id,state.as_of)} className="text-link quality-page-link">Open Data & devices <ArrowUpRight size={14}/></AppLink><details className="quality-details"><summary>Inspect source and baseline details</summary><SeriesFacts channels={state.channels} /></details></article><article className="patient-panel diary-overview-card"><div className="patient-panel-title"><FileHeart size={18} /><h2>A little everyday context</h2></div><p>{diaryFromState(state) ? 'A fictional self-report is available at this historical decision.' : 'No symptom diary was supplied for this source snapshot.'}</p><div className="diary-illustration"><span /><span /><span /></div><button className="ui-button ui-button-white" onClick={() => setTab('Diary')}>Explore the diary <ArrowRight size={15} /></button><small>Self-reports are separate from verified clinical events.</small></article></div>
      </>}
      {tab === 'Monitoring' && <article className="patient-panel monitoring-panel"><div className="patient-section-heading"><div><p className="eyebrow">MEASUREMENTS OVER TIME</p><h2>Follow a recorded signal.</h2></div><span className="neutral-pill">{observations.length} available observations</span></div><p className="patient-secondary">Choose one source stream. Separate measurement contexts are never averaged together.</p>{series ? <><label className="patient-field-label">Measurement stream<select aria-label="Measurement stream" value={seriesKey(series)} onChange={event => setChosenSeries(event.target.value)}>{state.channels.map(row => <option key={seriesKey(row)} value={seriesKey(row)}>{CHANNEL_NAMES[row.channel]} · {row.context.replaceAll('_',' ')} · {row.source_series_id}</option>)}</select></label><ObservationChart key={`${seriesKey(series)}:${state.as_of}`} rows={seriesRows} series={series} asOf={state.as_of} /><SeriesFacts channels={[series]} /><DescriptiveTrend state={state} series={series} /></> : <EmptyObservations />}</article>}
      {tab === 'Exposure' && <><div className="patient-exposure-banner"><Wind size={27} /><div><p className="eyebrow">ENVIRONMENTAL CONTEXT</p><h2>Air quality, as recorded.</h2><p>AQI retains its source units and timing. It does not establish a personal causal trigger.</p></div></div>{aqiSeries.length ? aqiSeries.map(row => <article className="patient-panel exposure-chart" key={seriesKey(row)}><div className="patient-section-heading"><h2>Air quality index</h2><span className="neutral-pill">{row.context.replaceAll('_',' ')}</span></div><ObservationChart rows={observations.filter(item => seriesKey(item) === seriesKey(row))} series={row} asOf={state.as_of} /><SeriesFacts channels={[row]} /></article>) : <article className="patient-panel"><div className="patient-empty"><Wind size={30} /><h3>No AQI observations available</h3><p>This snapshot has no source-backed air-quality stream.</p></div></article>}<div className="patient-inline-note"><Info size={18} /><p>Location routes, workplace history, PM2.5 and trigger-attribution percentages are unavailable in this archive. The lung illustration is decorative.</p></div></>}
      {tab === 'Timeline' && <article className="patient-panel"><div className="patient-section-heading"><div><p className="eyebrow">TRACE THE RECORDED HISTORY</p><h2>One decision at a time.</h2></div><span className="neutral-pill">{history.snapshots.length} decisions</span></div><p className="patient-secondary">{history.samplingNote} Select a decision below or use the replay controls above.</p><ol className="patient-timeline">{history.snapshots.map((snapshot, i) => <li key={snapshot.as_of} className={i === index ? 'current-decision' : ''}><span className="timeline-node">{i === index ? <Check size={12} /> : <Clock3 size={12} />}</span><button aria-current={i === index ? 'step' : undefined} onClick={() => selectIndex(i)}><span><strong>{timestamp(snapshot.as_of)}</strong><small>{i === last ? 'Final archive snapshot' : 'Sampled availability decision'}</small></span><span>{snapshot.channels.length} series · {snapshot.missing_channels.length} missing types <ChevronRight size={15} /></span></button></li>)}</ol><div className="patient-inline-note"><Info size={17} /><p>Replay changes the entire patient snapshot. It reveals only observations available by each selected decision; old readings may remain stale.</p></div></article>}
      {tab === 'Diary' && <article className="patient-panel"><div className="patient-section-heading"><div><p className="eyebrow">THE PATIENT’S OWN WORD</p><h2>Symptom diary</h2></div><FileHeart size={24} /></div><p className="patient-secondary">Reports available by {timestamp(state.as_of)}.</p><SourceDiary state={state} /><div className="patient-inline-note"><Info size={18} /><p>New browser demo check-ins are kept separately in the patient portal. They do not alter this historical source snapshot or establish a clinically verified onset.</p></div><AppLink href="/patient/check-in" className="ui-button ui-button-primary">Open symptom check-in <ArrowRight size={16} /></AppLink></article>}
    </section>
    {exported && <div className="export-toast" role="status"><Check size={16} /> Selected historical snapshot download started.</div>}
  </>;
}
export function SourceDiary({ state }: { state: PatientState }) {
  const report = diaryFromState(state);
  if (!report) return <div className="patient-empty"><FileHeart size={30} /><h3>No source diary at this time</h3><p>No report has been invented or backdated for this profile.</p></div>;
  return <div className="source-diary"><span className={`source-badge${report.data_origin === 'synthetic' ? ' synthetic-badge' : ''}`}>{report.data_origin === 'synthetic' ? 'Fictional archived illustration' : 'Archived source self-report'}</span><h3>Self-report · {timestamp(report.collected_at)}</h3><dl>{([['Breathlessness worse than usual',report.dyspnea_worse_than_usual],['Cough worse than usual',report.cough_worse_than_usual],['Sputum changed',report.sputum_change]] as const).map(([label,value]) => <div key={label}><dt>{label}</dt><dd className={value === null ? 'answer-unknown' : ''}>{value === null ? 'Unknown / unsure' : value ? 'Yes' : 'No'}</dd></div>)}</dl><p>Available: {timestamp(report.available_at)}{report.freshness && <><br />{report.freshness === 'fresh' ? 'Fresh at this historical snapshot' : 'Stale at this historical snapshot'}</>}<br />Reported symptom start: {report.reported_symptom_start_at ? timestamp(report.reported_symptom_start_at) : 'Unknown'}</p><small>Direct self-report. Not a clinician-verified exacerbation or validated symptom instrument.</small></div>;
}
export function SeriesFacts({ channels }: { channels: Channel[] }) {
  return <div className="series-facts">{channels.map(row => <article key={seriesKey(row)}><h3>{CHANNEL_NAMES[row.channel]} <small>{row.context.replaceAll('_',' ')}</small></h3><dl><div><dt>Source stream</dt><dd>{row.source_series_id}</dd></div><div><dt>Physical device</dt><dd>{row.device_id || 'Not established'}</dd></div><div><dt>Recorded</dt><dd>{timestamp(row.measurement_end)}</dd></div><div><dt>Available</dt><dd>{timestamp(row.available_at)}</dd></div><div><dt>Prior-day baseline</dt><dd>{row.baseline.mean === null ? 'Insufficient history' : formatValue({ ...row, value: row.baseline.mean })} · {row.baseline.prior_observed_days} observed days</dd></div><div><dt>Time evidence</dt><dd>{row.time_evidence.replaceAll('_',' ')}</dd></div><div><dt>Window evidence</dt><dd>{row.window_evidence.replaceAll('_',' ')}</dd></div></dl></article>)}</div>;
}
function EmptyObservations() { return <div className="patient-empty"><Activity size={30} /><h3>No observations at this decision</h3><p>Choose another historical decision or a different demo profile.</p></div>; }

function DescriptiveTrend({ state, series }: { state: PatientState; series: Channel }) {
  const trend = state.patient_trends?.find(row => seriesKey(row) === seriesKey(series));
  if (!trend) return null;
  return <div className="descriptive-trend"><div className="patient-panel-title"><Activity size={17} /><h2>Descriptive history</h2></div><div><article><span>Prior 28-day observed days</span><strong>{trend.prior28_observed_days}</strong></article><article><span>Prior 28-day median</span><strong>{trend.prior28_median === null ? 'Insufficient history' : formatValue({ ...series, value:trend.prior28_median })}</strong></article><article><span>Recent 7-day observed days</span><strong>{trend.recent7_observed_days} / 7</strong></article><article><span>Recent slope</span><strong>{trend.recent7_slope_units_per_day === null ? 'Insufficient history' : `${trend.recent7_slope_units_per_day.toFixed(3)} ${series.units} / day`}</strong></article></div><p>Observed days measure presence, not wear-time adherence. Trends describe this stream; they do not establish a clinical prediction or causal trigger.</p></div>;
}
