import { TechnicalExports } from '../components/TechnicalExports';
import { downloadCsv, snapshotsCsv } from '../lib/csv-exports';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, ArrowDownToLine, ArrowRight, ArrowUpRight, Check, ChevronLeft, ChevronRight, ChevronsUpDown, CircleHelp, ClipboardCheck, FlaskConical, Clock3, Database, FileText, HeartPulse, Info, LayoutDashboard, LogOut, Menu, Search, Settings2, ShieldCheck, SlidersHorizontal, Sparkles, Stethoscope, UsersRound, X } from 'lucide-react';
import { AppLink } from '../components/AppLink';
import { ArchiveLoader, Brand, Modal } from '../components/WorkspaceUI';
import { CHANNEL_NAMES, CHANNEL_ORDER, channelCount, exportJson, formatDate, formatValue, getStates, readSession, siteOf, useArchive } from '../lib/monitoring';
import type { PatientState } from '../lib/monitoring';

type View = 'overview' | 'directory' | 'review';
type StatusFilter = 'all' | 'gaps' | 'archived' | 'none';
const PAGE_SIZE = 8;

function SnapshotDetails({ state, onClose }: { state: PatientState | null; onClose: () => void }) {
  return <Modal open={state !== null} onClose={onClose} title={state ? `Snapshot · ${state.patient_id}` : 'Observation snapshot'} drawer>
    {state && <>
      <div className="snapshot-intro"><span className={`source-badge${state.data_origin === 'synthetic' ? ' synthetic-badge' : ''}`}>{state.data_origin === 'synthetic' ? 'Fictional illustration' : 'Public source archive'}</span><p>Snapshot: {formatDate(state.as_of, true)} · {new Date(state.as_of).toISOString().slice(11, 16)} UTC</p><p>Individual final historical snapshot. Measurement dates and age are shown separately below.</p></div>
      <div className="snapshot-summary"><div><strong>{channelCount(state)} / 6</strong><span>Channel types</span></div><div><strong>{state.channels.length}</strong><span>Distinct series</span></div><div><strong>{state.missing_channels.length}</strong><span>Unseen channels</span></div></div>
      <div className="snapshot-series">{state.channels.map(channel => <article key={`${channel.channel}-${channel.context}-${channel.source_series_id}`} className="snapshot-channel">
        <div className="channel-title"><h3>{CHANNEL_NAMES[channel.channel] || channel.channel}</h3><span className={`state-badge ${channel.freshness === 'fresh' ? 'state-fresh' : 'state-archived'}`}>{channel.freshness === 'stale' ? 'Stale reading' : channel.freshness}</span></div>
        <strong className="channel-number">{formatValue(channel)}</strong>
        <p className="channel-context">{channel.context.replaceAll('_', ' ')}</p>
        <dl><div><dt>Recorded</dt><dd>{formatDate(channel.measurement_end)} · {new Date(channel.measurement_end).toISOString().slice(11, 16)} UTC</dd></div><div><dt>Age at snapshot</dt><dd>{Math.round(channel.measurement_age_hours).toLocaleString('en-GB')} hours</dd></div><div><dt>Physical device</dt><dd>{channel.device_id || 'Not established'}</dd></div><div><dt>Source stream</dt><dd>{channel.source_series_id}</dd></div><div><dt>Personal baseline</dt><dd>{channel.baseline.mean === null ? 'Insufficient history' : formatValue({ ...channel, value: channel.baseline.mean })} · {channel.baseline.prior_observed_days} prior days</dd></div></dl>
      </article>)}</div>
      {state.missing_channels.length > 0 && <div className="detail-note"><Info size={17} /><div><strong>Not observed in this snapshot</strong><p>{state.missing_channels.map(channel => CHANNEL_NAMES[channel] || channel).join(', ')}. Missing values are not interpreted as normal readings.</p></div></div>}
      <div className="detail-note forecast-note"><ShieldCheck size={18} /><div><strong>Seven-day forecast unavailable</strong><p>No validated exacerbation forecast is provided. Source observations and descriptive changes are not a probability or treatment recommendation.</p></div></div>
      <AppLink href={`/app/patients/${state.patient_id}`} className="ui-button ui-button-primary snapshot-download">Open patient workspace <ArrowRight size={16} /></AppLink>
      <div className="snapshot-export-group"><button className="ui-button ui-button-white" onClick={()=>downloadCsv(`pulmira-${state.patient_id}-readings.csv`,snapshotsCsv([state]))}><ArrowDownToLine size={16}/>Download readings CSV</button><TechnicalExports align="start" items={[{label:'Download source snapshot',onSelect:()=>exportJson(`pulmira-${state.patient_id}-snapshot.json`,state)}]}/></div>
    </>}
  </Modal>;
}

export function CommandCentre() {
  const { archive, error, retry } = useArchive();
  const [session] = useState(readSession);
  const [view, setView] = useState<View>('overview');
  const [mobileNav, setMobileNav] = useState(false);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [site, setSite] = useState('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [sort, setSort] = useState('id');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(session.patientId);
  const [detail, setDetail] = useState<PatientState | null>(null);
  const [modal, setModal] = useState<'source' | 'guide' | null>(null);
  const [exported, setExported] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  const isPatient = session.role === 'patient';
  const isSynthetic = session.origin === 'synthetic';
  const allStates = useMemo(() => archive ? getStates(archive, session.origin) : [], [archive, session.origin]);
  const scope = useMemo(() => isPatient ? allStates.filter(state => state.patient_id === (allStates.some(row => row.patient_id === session.patientId) ? session.patientId : allStates[0]?.patient_id)) : allStates, [allStates, isPatient, session.patientId]);
  const filtered = useMemo(() => scope.filter(state => {
    const term = deferredQuery.toLowerCase().trim();
    return (!term || `${state.patient_id} ${siteOf(state.patient_id)}`.toLowerCase().includes(term))
      && (site === 'all' || state.patient_id.startsWith(site))
      && (status === 'all' || (status === 'gaps' && state.missing_channels.length > 0) || (status === 'archived' && state.channels.some(channel => channel.freshness === 'stale')) || (status === 'none' && state.channels.length === 0));
  }).sort((a, b) => sort === 'recent' ? b.as_of.localeCompare(a.as_of) || a.patient_id.localeCompare(b.patient_id) : a.patient_id.localeCompare(b.patient_id)), [scope, deferredQuery, site, status, sort]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const selected = scope.find(state => state.patient_id === selectedId) || scope[0];
  const seriesCount = scope.reduce((sum, state) => sum + state.channels.length, 0);
  const gapCount = scope.filter(state => state.missing_channels.length > 0).length;
  const coverage = CHANNEL_ORDER.map(channel => ({ channel, count: scope.filter(state => state.channels.some(series => series.channel === channel && series.value !== null)).length }));
  const sourceDates = scope.map(state => state.as_of).sort();

  useEffect(() => { document.title = `${isPatient ? 'Patient workspace' : 'Command centre'} · Pulmira`; }, [isPatient]);
  useEffect(() => {
    if (!mobileNav) return;
    const focusable = () => Array.from(navRef.current?.querySelectorAll<HTMLElement>('button, a[href]') || []).filter(element => element.getClientRects().length > 0);
    focusable()[0]?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setMobileNav(false); menuRef.current?.focus(); }
      if (event.key === 'Tab') {
        const elements = focusable(), first = elements[0], last = elements.at(-1);
        if (event.shiftKey && (document.activeElement === first || !navRef.current?.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
        if (!event.shiftKey && (document.activeElement === last || !navRef.current?.contains(document.activeElement))) { event.preventDefault(); first?.focus(); }
      }
    };
    const media = window.matchMedia('(min-width: 761px)');
    const onDesktop = () => { if (media.matches) setMobileNav(false); };
    window.addEventListener('keydown', keydown); media.addEventListener('change', onDesktop);
    return () => { window.removeEventListener('keydown', keydown); media.removeEventListener('change', onDesktop); };
  }, [mobileNav]);
  useEffect(() => {
    if (!exported) return;
    const timeout = window.setTimeout(() => setExported(false), 4000);
    return () => window.clearTimeout(timeout);
  }, [exported]);
  const resetFilters = () => { setQuery(''); setSite('all'); setStatus('all'); setPage(1); };
  const chooseView = (next: View) => {
    setView(next); setMobileNav(false); setPage(1);
    setStatus(next === 'review' ? 'gaps' : 'all');
    if (next === 'overview') window.scrollTo({ top: 0, behavior: 'smooth' });
    else window.requestAnimationFrame(() => document.getElementById('patient-directory')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  return <div className="pulmira-app command-page">
    {mobileNav && <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}
    <aside ref={navRef} className={`workspace-sidebar${mobileNav ? ' sidebar-open' : ''}`} aria-label="Workspace navigation">
      <div className="sidebar-brand"><Brand /><button className="icon-button mobile-nav-close" aria-label="Close navigation" onClick={() => setMobileNav(false)}><X size={19} /></button></div>
      <div className="workspace-identity"><span className="identity-icon"><Stethoscope size={18} /></span><div><strong>{isPatient ? 'Patient perspective' : 'Clinical workspace'}</strong><span>Read-only demo access</span></div></div>
      <p className="nav-label">YOUR WORKSPACE</p>
      <nav className="sidebar-navigation">
        <AppLink href="/app/outlook"><HeartPulse size={19} /> 7-day outlook</AppLink>
        <button className={view === 'overview' ? 'active' : ''} onClick={() => chooseView('overview')} aria-current={view === 'overview' ? 'page' : undefined}><LayoutDashboard size={19} /> Overview <span className="nav-active-dot" /></button>
        <button className={view === 'directory' ? 'active' : ''} onClick={() => chooseView('directory')} aria-current={view === 'directory' ? 'page' : undefined}><UsersRound size={19} /> {isPatient ? 'My observations' : 'Patient directory'} <span className="nav-counter">{scope.length || '—'}</span></button>
        <button className={view === 'review' ? 'active' : ''} onClick={() => chooseView('review')} aria-current={view === 'review' ? 'page' : undefined}><SlidersHorizontal size={19} /> Data review {gapCount > 0 && <span className="nav-counter">{gapCount}</span>}</button>
      </nav>
      <p className="nav-label nav-label-secondary">RESOURCES</p>
      <nav className="sidebar-navigation">
        <button onClick={() => { setModal('source'); setMobileNav(false); }}><Database size={19} /> Data & provenance <ArrowUpRight size={14} className="nav-end-icon" /></button>
        <button onClick={() => { setModal('guide'); setMobileNav(false); }}><CircleHelp size={19} /> Workspace guide</button>
        <AppLink href="/app/data-quality"><Database size={19} /> Data & devices</AppLink>
        <AppLink href="/app/review"><ClipboardCheck size={19} /> Review queue</AppLink>
        <AppLink href="/app/simulator"><FlaskConical size={19} /> Synthetic simulator</AppLink>
        <AppLink href="/app/reports"><FileText size={19} /> Reports</AppLink>
        <AppLink href="/patient"><HeartPulse size={19} /> Patient portal</AppLink>
        <AppLink href="/evidence"><CircleHelp size={19} /> Evidence & help</AppLink>
        <AppLink href="/app/settings"><Settings2 size={19} /> Settings</AppLink>
        <AppLink href="/demo"><Settings2 size={19} /> Demo setup</AppLink>
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-note"><span className="sidebar-note-icon"><Sparkles size={19} /></span><strong>Every signal has a source.</strong><p>Explore the observations and the context behind them.</p><button onClick={() => setModal('source')}>View source details <ArrowUpRight size={14} /></button></div>
        <AppLink className="sidebar-exit" href="/"><LogOut size={17} /> Back to homepage</AppLink>
      </div>
    </aside>

    <div className="workspace-body">
      <header className="workspace-topbar"><div className="topbar-left"><button ref={menuRef} className="icon-button mobile-menu" aria-label="Open navigation" aria-expanded={mobileNav} onClick={() => setMobileNav(true)}><Menu size={21} /></button><span className="breadcrumb">Workspace <ChevronRight size={13} /> <strong>{isPatient ? 'My overview' : 'Overview'}</strong></span></div><div className="topbar-right"><span className={`source-badge${isSynthetic ? ' synthetic-badge' : ''}`}><span className="small-dot" />{isSynthetic ? 'Synthetic demo' : 'Archive demo'}</span><button className="icon-button topbar-help" aria-label="Workspace information" onClick={() => setModal('guide')}><CircleHelp size={19} /></button><span className="workspace-avatar" aria-label={isPatient ? 'Patient demo view' : 'Clinician demo view'}>{isPatient ? 'PD' : 'CD'}</span></div></header>
      {!archive ? <ArchiveLoader error={error} retry={retry} /> : <main className="workspace-main" id="main-content">
        <section className="workspace-intro"><div><p className="eyebrow">{isPatient ? 'YOUR OBSERVATION SPACE' : 'THE COMMAND CENTRE'}</p><h1>{isPatient ? 'Your observations, together.' : 'A clearer view of your cohort.'}</h1><p>{isPatient ? 'Explore the recorded data behind your selected demo profile.' : 'A connected overview of recorded observations, with context at every step.'}</p></div><div className="export-actions"><button className="ui-button ui-button-white export-overview" disabled={!filtered.length} onClick={()=>{downloadCsv('pulmira-observation-overview.csv',snapshotsCsv(filtered,'all_filtered_snapshots'));setExported(true);}}><ArrowDownToLine size={16}/>Download overview CSV</button><TechnicalExports description="Full filtered state packets and the applied directory filters." items={[{label:'Download overview packet',onSelect:()=>{exportJson('pulmira-observation-overview.json',{exported_at:new Date().toISOString(),source:isSynthetic?'Fictional contract illustration':archive.sourceLabel,view:session.role,note:archive.clockNote,clinical_validation:false,filters:{query:deferredQuery,site,status,sort},snapshots:filtered});setExported(true);}}]}/></div></section>

        <div className="archive-context"><span><Clock3 size={14} /> {isSynthetic ? 'Fictional historical illustration' : 'Historical snapshots · individual source dates'}</span><button onClick={() => setModal('source')}>About this data <ArrowUpRight size={13} /></button></div>

        <section className="workspace-stats" aria-label="Observation overview">
          <article className="stat-card stat-card-purple"><div className="stat-top"><span>{isPatient ? 'Selected profile' : 'Participants'}</span><span className="stat-icon"><UsersRound size={18} /></span></div><strong>{scope.length}<small>{isPatient ? 'demo profile' : 'in this archive'}</small></strong><p>{isSynthetic ? 'Explicitly fictional data' : 'Source identifiers, without invented profiles'}</p></article>
          <article className="stat-card"><div className="stat-top"><span>Observed series</span><span className="stat-icon"><Activity size={18} /></span></div><strong>{seriesCount}<small>distinct streams</small></strong><p>Device and measurement contexts kept separate</p></article>
          <article className="stat-card"><div className="stat-top"><span>Snapshots with gaps</span><span className="stat-icon stat-icon-amber"><LayersIcon /></span></div><strong>{gapCount}<small>of {scope.length} snapshots</small></strong><p>One or more channel types not observed</p></article>
          <article className="stat-card forecast-stat"><div className="stat-top"><span>7-day COPD outlook</span><span className="stat-icon"><ShieldCheck size={18} /></span></div><strong>Rule-based</strong><p>Fictional working example · unvalidated</p><AppLink href="/app/outlook" className="text-link">Open 7-day outlook <ArrowUpRight size={12} /></AppLink></article>
        </section>

        <section className="workspace-insights" aria-label="Archive coverage and selected snapshot">
          <article className="coverage-panel workspace-panel"><div className="panel-heading"><div><p className="eyebrow">THE OBSERVATION PICTURE</p><h2>What’s in the archive?</h2></div><span className="neutral-pill">{scope.length} {scope.length === 1 ? 'profile' : 'participants'}</span></div><p className="panel-description">Participants with a recorded value for each channel type.</p><div className="coverage-chart" role="img" aria-label={coverage.map(item => `${CHANNEL_NAMES[item.channel]}: ${item.count} of ${scope.length}`).join('; ')}>{coverage.map(({ channel, count }, index) => <div className="coverage-bar-group" key={channel} title={`${CHANNEL_NAMES[channel]}: ${count} of ${scope.length}`}><span className="coverage-number">{count}</span><div className="coverage-bar-track"><div className={`coverage-bar coverage-bar-${index}`} style={{ height: `${scope.length ? count / scope.length * 100 : 0}%` }} /></div><span className="coverage-label">{({ spo2_pct: 'SpO₂', heart_rate_bpm: 'Heart rate', respiratory_rate_per_min: 'Resp. rate', sleep_hours: 'Sleep', gait_speed_m_per_s: 'Gait speed', aqi_index: 'AQI' } as Record<string, string>)[channel]}</span></div>)}</div><div className="coverage-footnote"><span className="legend-dot" /><span>Recorded values may be stale. This measures channel presence, not wear-time adherence.</span></div></article>
          <article className="twin-preview workspace-panel"><div className="preview-copy"><span className="eyebrow">A LOOK INSIDE THE TWIN</span><h2>From measurements<br />to context.</h2><p>Each snapshot preserves its own source, history and measurement age.</p>{selected && <button className="preview-action" onClick={() => setDetail(selected)}>Inspect {selected.patient_id} <ArrowUpRight size={16} /></button>}</div><div className="preview-visual"><img src="/assets/digital_lung_1791213475161.jpg" alt="Decorative lung illustration" /><div className="preview-image-mask" /><span className="anatomical-label">Illustration</span></div><div className="preview-footer"><span><HeartPulse size={15} /> Observed state</span><span>Rule-based outlook <Info size={13} /></span></div></article>
        </section>

        <section className="directory-panel workspace-panel" id="patient-directory" aria-labelledby="directory-title">
          <div className="directory-heading"><div><div className="directory-title-row"><h2 id="directory-title">{view === 'review' ? 'Snapshots with missing channels' : isPatient ? 'My observation snapshot' : 'Patient directory'}</h2><span className="count-pill">{filtered.length}</span></div><p>{view === 'review' ? 'Data-completeness review, without assigning clinical priority.' : 'Explore source snapshots. Select a profile to inspect the underlying observations.'}</p></div><span className="directory-source"><Database size={14} /> {isSynthetic ? 'Fictional example' : 'TOLIFE CSA · v2'}</span></div>
          <div className="directory-filters"><div className="search-input"><Search size={17} /><input type="search" aria-label="Search patients" placeholder={isPatient ? 'Search your demo profile…' : 'Search patient ID or source site…'} value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} />{query && <button aria-label="Clear search" onClick={() => { setQuery(''); setPage(1); }}><X size={15} /></button>}</div><div className="directory-selects"><div className="compact-select"><SlidersHorizontal size={14} /><select aria-label="Filter source site" value={site} onChange={event => { setSite(event.target.value); setPage(1); }}><option value="all">All source sites</option>{[...new Set(scope.map(state => state.patient_id.split('-')[0]))].sort().map(prefix => <option value={prefix} key={prefix}>{siteOf(prefix)}</option>)}</select></div><div className="compact-select"><select aria-label="Filter data status" value={status} onChange={event => { setStatus(event.target.value as StatusFilter); setPage(1); }}><option value="all">All snapshots</option><option value="gaps">Missing channels</option><option value="archived">Stale readings</option><option value="none">No observations</option></select></div><div className="compact-select sort-select"><ChevronsUpDown size={14} /><select aria-label="Sort patients" value={sort} onChange={event => { setSort(event.target.value); setPage(1); }}><option value="id">Patient ID</option><option value="recent">Snapshot date</option></select></div></div></div>
          {(query || site !== 'all' || status !== 'all') && <div className="filter-summary" role="status">{filtered.length} matching {filtered.length === 1 ? 'snapshot' : 'snapshots'}<button onClick={resetFilters}>Clear filters <X size={12} /></button></div>}
          <div className="directory-table-wrap"><table className="directory-table"><thead><tr><th scope="col">Patient / source ID</th><th scope="col">Source site</th><th scope="col">Channel coverage</th><th scope="col">Data status</th><th scope="col">Snapshot date (UTC)</th><th scope="col"><span className="visually-hidden">Inspect snapshot</span></th></tr></thead><tbody>{visible.map(state => <tr key={state.patient_id} className={state.patient_id === selected?.patient_id ? 'selected-patient' : ''}>
            <td><AppLink className="patient-id-button" href={`/app/patients/${state.patient_id}`}><span className={`patient-monogram site-${state.patient_id.split('-')[0].toLowerCase()}`}>{state.patient_id.startsWith('DEMO') ? 'SY' : state.patient_id.split('-')[0].slice(0, 2)}</span><span><strong>{state.patient_id}</strong><small>{isSynthetic ? 'Synthetic profile' : 'Source participant'}</small></span></AppLink></td>
            <td><span className="site-name"><i />{siteOf(state.patient_id)}</span></td><td><div className="channel-coverage"><div className="channel-segments" aria-hidden="true">{CHANNEL_ORDER.map(channel => <span key={channel} className={state.channels.some(series => series.channel === channel) ? 'present' : ''} />)}</div><span>{channelCount(state)} of 6 types</span></div></td>
            <td><span className={`state-badge${state.channels.length && state.channels.every(channel => channel.freshness === 'fresh') ? ' state-fresh' : ' state-archived'}`}><i />{state.channels.length === 0 ? 'No observations' : state.channels.some(channel => channel.freshness === 'stale') ? 'Stale readings' : state.channels.some(channel => channel.freshness === 'invalid') ? 'Invalid reading' : 'Fresh example'}</span></td><td className="snapshot-date">{formatDate(state.as_of)}</td><td><button className="row-open" aria-label={`Inspect snapshot for ${state.patient_id}`} onClick={() => { setSelectedId(state.patient_id); setDetail(state); }}><ArrowUpRight size={17} /></button></td>
          </tr>)}</tbody></table></div>
          {filtered.length === 0 && <div className="directory-empty"><Search size={26} /><h3>No matching snapshots</h3><p>Try another patient ID or reset the source and data filters.</p><button className="ui-button ui-button-white" onClick={resetFilters}>Reset filters <ArrowRight size={16} /></button></div>}
          <div className="directory-pagination"><span>{filtered.length ? `Showing ${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, filtered.length)} of ${filtered.length}` : '0 snapshots'}<span className="pagination-note"> · Source identifiers only</span></span><div><button aria-label="Previous page" className="pagination-arrow" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={17} /></button><span aria-live="polite">Page <strong>{currentPage}</strong> of {totalPages}</span><button aria-label="Next page" className="pagination-arrow" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}><ChevronRight size={17} /></button></div></div>
        </section>
        <footer className="workspace-footer"><span><ShieldCheck size={14} /> Research prototype · No clinical forecast</span><button onClick={() => setModal('source')}>Source & methodology <ArrowUpRight size={12} /></button></footer>
        {exported && <div className="export-toast" role="status"><Check size={16} /> Overview download started.</div>}
      </main>}
    </div>

    <SnapshotDetails state={detail} onClose={() => setDetail(null)} />
    <Modal open={modal === 'source'} onClose={() => setModal(null)} title="Data & provenance"><div className="dialog-copy"><span className={`source-badge${isSynthetic ? ' synthetic-badge' : ''}`}>{isSynthetic ? 'Synthetic illustration' : 'Public source observations'}</span><h3>{isSynthetic ? 'A fictional contract example' : archive?.sourceLabel}</h3><p>{isSynthetic ? 'This is one explicitly fictional profile from the monitoring-support contract illustration. It is not a clinical participant or a model performance experiment.' : 'The bundled archive contains final historical monitoring-support snapshots for 86 TOLIFE participants. No names, ages, diagnoses or treatment profiles have been invented.'}</p><div className="source-facts"><div><span>Snapshot range</span><strong>{sourceDates.length ? `${formatDate(sourceDates[0])} – ${formatDate(sourceDates.at(-1)!)}` : '—'}</strong></div><div><span>Clock</span><strong>Individual snapshot times · UTC</strong></div><div><span>Access</span><strong>Bundled read-only archive</strong></div><div><span>Forecast</span><strong>Unavailable · not clinically validated</strong></div></div><h3>Keep the timing context</h3><p>{archive?.clockNote} Source window timing and 24-hour processing lag are retrospective assumptions. A stale reading can still be displayed with its age; it is not a current or normal reading.</p><p>Channel counts describe presence in a snapshot, not sensor adherence or predictive accuracy. Separate device/context streams remain separate.</p>{!isSynthetic && <><a className="text-link" href={archive?.sourceUrl} target="_blank" rel="noreferrer">View TOLIFE source publication <ArrowUpRight size={14} /></a><p className="small-copy">Licence: {archive?.license}. The bundled data is served locally; no live clinical backend is connected.</p><details><summary>Archive integrity reference</summary><code className="source-hash">{archive?.sourceSha256}</code></details></>}</div></Modal>
    <Modal open={modal === 'guide'} onClose={() => setModal(null)} title="Your workspace, explained"><div className="dialog-copy"><h3>Start with the patient directory</h3><p>Search a source identifier or site, filter for missing channels, and choose a snapshot. The detail panel shows every series with its units, source context, baseline history and age at the snapshot.</p><h3>What the overview shows</h3><p>Participant and series counts are calculated from the selected archive. The chart counts profiles with a recorded value per channel type. Export overview downloads the currently filtered snapshots with source and time information.</p><h3>The seven-day formula-based outlook</h3><p>Open 7-day outlook from the sidebar or summary card. It projects seven future dates from eligible historical sensor trends and recent reports, with every factor visible. Its points are an unvalidated heuristic, not event probabilities. Clinical predictive accuracy remains unestablished.</p><h3>Perspective and access</h3><p>The patient perspective limits this interface to the selected demonstration profile. It does not provide authentication or access control. Use Demo setup to change perspective or switch between source and synthetic data.</p><AppLink href="/demo" className="ui-button ui-button-primary">Change demo setup <ArrowRight size={16} /></AppLink></div></Modal>
  </div>;
}

function LayersIcon() { return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m12 3 9 5-9 5-9-5 9-5Z M3 12l9 5 9-5 M3 16l9 5 9-5" /></svg>; }
