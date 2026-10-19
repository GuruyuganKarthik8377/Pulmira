import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowLeft, ArrowUpRight, BookOpen, CalendarHeart, ChevronRight, CircleHelp, ClipboardCheck, FlaskConical, ClipboardList, Database, FileText, HeartPulse, LayoutDashboard, Menu, Settings2, ShieldCheck, X } from 'lucide-react';
import { AppLink } from './AppLink';
import { Brand, Modal } from './WorkspaceUI';
import { saveSession, useDemoSession } from '../lib/monitoring';
import type { PatientState } from '../lib/monitoring';
import { navigate } from '../lib/navigation';
import {outlookPath} from '../lib/outlook7';
import { patientPath,qualityPath,reportPath,reportsPath } from '../lib/record-routes';

export function PatientShell({ state, states, portal = false, section = 'patient', reportDetail = false, selectedAsOf, children }: { state: PatientState; states: PatientState[]; portal?: boolean; section?: 'patient'|'data'|'reports'|'outlook'; reportDetail?:boolean; selectedAsOf?:string|null; children: ReactNode }) {
  const session = useDemoSession();
  const decision = selectedAsOf ?? state.as_of;
  const [menu, setMenu] = useState(false);
  const [help, setHelp] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const navigation = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!menu) return;
    const items = () => Array.from(navigation.current?.querySelectorAll<HTMLElement>('button, a[href]') || []).filter(element => element.getClientRects().length);
    items()[0]?.focus();
    const close = () => { setMenu(false); menuButton.current?.focus(); };
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
      if (event.key === 'Tab') {
        const all = items(), first = all[0], last = all.at(-1);
        if (event.shiftKey && (document.activeElement === first || !navigation.current?.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
        if (!event.shiftKey && (document.activeElement === last || !navigation.current?.contains(document.activeElement))) { event.preventDefault(); first?.focus(); }
      }
    };
    const media = matchMedia('(min-width: 761px)');
    const resized = () => { if (media.matches) setMenu(false); };
    addEventListener('keydown', keydown); media.addEventListener('change', resized);
    return () => { removeEventListener('keydown', keydown); media.removeEventListener('change', resized); };
  }, [menu]);
  return <div className={`pulmira-app command-page patient-experience${portal ? ' portal-experience' : ''}`}>
    <a href="#patient-main" className="patient-skip">Skip to content</a>
    {menu && <button className="sidebar-scrim" aria-label="Close navigation overlay" onClick={() => { setMenu(false); menuButton.current?.focus(); }} />}
    <aside ref={navigation} className={`workspace-sidebar${menu ? ' sidebar-open' : ''}`} aria-label="Patient navigation">
      <div className="sidebar-brand"><Brand /><button className="icon-button mobile-nav-close" aria-label="Close navigation" onClick={() => { setMenu(false); menuButton.current?.focus(); }}><X size={19} /></button></div>
      <div className="workspace-identity"><span className="identity-icon"><HeartPulse size={19} /></span><div><strong>{portal ? 'Patient space' : 'Clinical workspace'}</strong><span>Observation-led demo</span></div></div>
      <p className="nav-label">YOUR WORKSPACE</p><nav className="sidebar-navigation">
        <AppLink href="/app/dashboard"><LayoutDashboard size={19} /> Command centre</AppLink>
        <AppLink href={patientPath(state.patient_id,decision)} aria-current={!portal && section === 'patient' ? 'page' : undefined} className={!portal && section === 'patient' ? 'patient-nav-active' : ''}><HeartPulse size={19} /> Patient workspace</AppLink>
        <AppLink href={outlookPath(state.patient_id,decision)} aria-current={section === 'outlook' ? 'page' : undefined} className={section === 'outlook' ? 'patient-nav-active' : ''}><CalendarHeart size={19} /> 7-day outlook</AppLink>
        <AppLink href={qualityPath(state.patient_id,decision)} aria-current={section === 'data' ? 'page' : undefined} className={section === 'data' ? 'patient-nav-active' : ''}><Database size={19} /> Data & devices</AppLink>
        <AppLink href={reportsPath(state.patient_id,decision)} aria-current={section === 'reports' ? 'page' : undefined} className={section === 'reports' ? 'patient-nav-active' : ''}><FileText size={19} /> Reports</AppLink>
        <AppLink href={`/app/review?patient=${encodeURIComponent(state.patient_id)}`}><ClipboardCheck size={19} /> Review queue</AppLink>
        <AppLink href="/app/simulator"><FlaskConical size={19} /> Synthetic simulator</AppLink>
        <AppLink href="/patient" aria-current={portal ? 'page' : undefined} className={portal ? 'patient-nav-active' : ''}><CalendarHeart size={19} /> Patient portal</AppLink>
        <AppLink href="/patient/check-in"><ClipboardList size={19} /> Symptom check-in <ArrowUpRight size={13} className="nav-end-icon" /></AppLink>
      </nav><p className="nav-label nav-label-secondary">RESOURCES</p><nav className="sidebar-navigation">
        <button onClick={() => { setHelp(true); setMenu(false); }}><BookOpen size={19} /> About this workspace</button>
        <AppLink href="/evidence"><BookOpen size={19} /> Evidence & help</AppLink>
        <AppLink href="/app/settings"><Settings2 size={19} /> Settings</AppLink>
        <AppLink href="/demo"><Settings2 size={19} /> Demo setup</AppLink>
      </nav><div className="sidebar-bottom"><div className="sidebar-note"><span className="sidebar-note-icon"><ShieldCheck size={19} /></span><strong>Context comes first.</strong><p>Historical source data and fictional examples stay clearly separated.</p><button onClick={() => setHelp(true)}>Read the guide <ArrowUpRight size={13} /></button></div><AppLink href="/" className="sidebar-exit"><ArrowLeft size={16} /> Back to homepage</AppLink></div>
    </aside>
    <div className="workspace-body"><header className="workspace-topbar"><div className="topbar-left"><button ref={menuButton} className="icon-button mobile-menu" aria-label="Open navigation" aria-expanded={menu} onClick={() => setMenu(true)}><Menu size={21} /></button><span className="breadcrumb"><span className="patient-breadcrumb-root">Workspace</span><ChevronRight size={13} /><strong>{portal ? 'Patient portal' : section === 'outlook' ? '7-day COPD outlook' : section === 'data' ? 'Data & devices' : section === 'reports' ? 'Reports' : state.patient_id}</strong></span></div><div className="topbar-right"><span className={`source-badge${state.data_origin === 'synthetic' ? ' synthetic-badge' : ''}`}><span className="small-dot" />{state.data_origin === 'synthetic' ? 'Fictional demo' : 'Source archive'}</span><button className="icon-button" aria-label="Page information" onClick={() => setHelp(true)}><CircleHelp size={19} /></button></div></header>
      <main className="workspace-main" id="patient-main"><div className="patient-context-line"><AppLink href="/app/dashboard"><ArrowLeft size={14} /> Patient directory</AppLink><label>Demo profile <select aria-label="Select demo profile" value={state.patient_id} onChange={event => {
        const next = states.find(item => item.patient_id === event.target.value)!;
        saveSession({ ...session, patientId: next.patient_id, origin: next.data_origin });
        navigate(portal ? '/patient' : section === 'outlook' ? outlookPath(next.patient_id) : section === 'data' ? qualityPath(next.patient_id) : section === 'reports' ? reportDetail ? reportPath(next.patient_id) : `/app/reports?patient=${encodeURIComponent(next.patient_id)}` : patientPath(next.patient_id));
        setMenu(false);
      }}><optgroup label="Public source participants">{states.filter(item => item.data_origin === 'real_open').map(item => <option key={item.patient_id}>{item.patient_id}</option>)}</optgroup><optgroup label="Fictional illustration">{states.filter(item => item.data_origin === 'synthetic').map(item => <option key={item.patient_id}>{item.patient_id}</option>)}</optgroup></select></label></div>
      {children}<footer className="patient-page-footer"><span><ShieldCheck size={14} /> Research prototype · Clinical prediction unvalidated</span><button onClick={() => setHelp(true)}>Data & interpretation <ArrowUpRight size={13} /></button></footer></main>
    </div>
    <Modal open={help} onClose={() => setHelp(false)} title="A little context for this workspace"><div className="dialog-copy"><h3>Historical observations, with their source</h3><p>The selected patient and historical decision time determine every measurement and chart. A reading appears only when both its measurement and availability times are at or before that decision. Different devices and contexts stay separate.</p><h3>Gaps stay visible</h3><p>Charts use recorded timestamps, with breaks for gaps over 48 hours. Sampled timeline decisions are irregular. Values are not interpolated into unobserved days. Timestamp and 24-hour processing-lag assumptions are retrospective engineering assumptions.</p><h3>Check-in practice</h3><p>The bound fictional patient session can submit symptoms to the local backend. Success requires a server receipt; no clinical notification is sent. New demo entries stay separate from the archived 2025 diary illustration. Source participants are read-only.</p><h3>Demonstration access</h3><p>The profile selector is for exploring public and fictional demonstration records. The backend restricts patient demo sessions to one fictional profile. It does not provide production clinical identity verification. The seven-day outlook is an unvalidated formula-based change projection. No calibrated event probability, diagnosis or treatment recommendation is generated.</p><AppLink href="/evidence?section=guide" className="ui-button ui-button-white">Open full guide <ArrowUpRight size={15} /></AppLink><AppLink href="/demo" className="ui-button ui-button-primary"><Database size={16} /> Change demo setup</AppLink></div></Modal>
  </div>;
}
