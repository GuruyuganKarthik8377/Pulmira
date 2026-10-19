import {useDemoProfiles} from '../lib/demo-profiles';
import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, CircleHelp, HeartPulse, Layers3, ShieldCheck, Stethoscope, UserRound } from 'lucide-react';
import { AppLink } from '../components/AppLink';
import { ArchiveLoader, Brand, Modal } from '../components/WorkspaceUI';
import { getStates, readSession, saveSession, siteOf, useArchive } from '../lib/monitoring';
import type { DemoOrigin, DemoRole } from '../lib/monitoring';
import { apiJson } from '../lib/api';
import { navigate } from '../lib/navigation';

export function DemoEntry() {
  const { archive, error, retry } = useArchive();
  const [initial] = useState(readSession);
  const [role, setRole] = useState<DemoRole>(initial.role);
  const [origin, setOrigin] = useState<DemoOrigin>(initial.origin);
  const [patientId, setPatientId] = useState(initial.patientId);
  const [help, setHelp] = useState(false);
  const profiles=useDemoProfiles();
  const states=profiles?profiles.filter(p=>p.data_origin===origin):archive?getStates(archive,origin):[];
  const [entryError,setEntryError]=useState('');
  const [entering,setEntering]=useState(false);
  const selectedId = states.some(state => state.patient_id === patientId) ? patientId : states[0]?.patient_id || '';
  useEffect(() => { document.title = 'Enter the demo · Pulmira'; }, []);

  return <div className="pulmira-app demo-page">
    <header className="demo-header"><Brand /><AppLink href="/" className="subtle-link"><ArrowLeft size={16} /> Back to homepage</AppLink></header>
    <main className="demo-layout">
      <section className="demo-story" aria-labelledby="demo-title">
        <div className="demo-orbit demo-orbit-one" /><div className="demo-orbit demo-orbit-two" />
        <div className="demo-story-copy">
          <span className="eyebrow"><span className="small-dot" /> RESPIRATORY DIGITAL TWIN</span>
          <h1 id="demo-title">Care starts<br />with <em>context.</em></h1>
          <p>A closer look at the observations, patterns and everyday context behind respiratory health.</p>
        </div>
        <div className="demo-visual">
          <img src="/assets/digital_lung_1791213475161.jpg" alt="Decorative respiratory illustration" />
          <div className="demo-visual-fade" />
          <div className="demo-observation-card"><span className="soft-icon"><HeartPulse size={21} /></span><div><strong>One connected view</strong><span>Observations, trends & source context</span></div><Check size={18} /></div>
          <div className="demo-trace-card"><span><i /> Recorded observations</span><svg viewBox="0 0 210 48" aria-hidden="true"><path d="M0 28H25L34 23L43 30L53 27H69L77 13L83 38L91 6L99 29H124L134 24L143 29H166L175 20L184 28H210" /></svg><small>Historical data. Clearly labelled.</small></div>
        </div>
        <div className="demo-story-footer"><span><Layers3 size={16} /> Built around the patient</span><span>Anatomical illustration</span></div>
      </section>

      <section className="demo-setup" aria-labelledby="setup-title">
        <div className="setup-progress"><span>01</span><div /><span>DEMO ACCESS</span></div>
        <h2 id="setup-title">Step inside Pulmira.</h2>
        <p className="setup-intro">Choose your perspective.<br />We’ll take you to your workspace.</p>
        {!archive ? <ArchiveLoader error={error} retry={retry} /> : <form onSubmit={async event => {
          event.preventDefault();setEntering(true);setEntryError('');
          try{saveSession({role,origin,patientId:selectedId});await apiJson('/auth/me');navigate(role==='patient'?'/patient':'/app/dashboard');}
          catch(reason){setEntryError(reason instanceof Error?reason.message:'Unable to enter the demo.');saveSession(initial);}
          finally{setEntering(false);}
        }}>
          <fieldset className="demo-role-field"><legend>Your perspective</legend>
            <div className="demo-role-options">
              {([{ value: 'clinician', label: 'Clinician', detail: 'Explore the cohort', Icon: Stethoscope }, { value: 'patient', label: 'Patient', detail: 'Focus on one profile', Icon: UserRound }] as const).map(({ value, label, detail, Icon }) => <label key={value} className={`demo-role${role === value ? ' is-selected' : ''}`}>
                <input type="radio" name="perspective" value={value} checked={role === value} onChange={() => {setRole(value);if(value==='patient'){setOrigin('synthetic');setPatientId('DEMO-SYNTHETIC-002');}}} />
                <span className="role-top"><Icon size={23} strokeWidth={1.6} /><span className="role-check">{role === value && <Check size={12} />}</span></span>
                <strong>{label}</strong><small>{detail}</small>
              </label>)}
            </div>
          </fieldset>
          <label className="field-label" htmlFor="demo-source">Observation source</label>
          <div className="select-wrap"><Layers3 size={17} /><select id="demo-source" value={origin} onChange={event => setOrigin(event.target.value as DemoOrigin)}>
            <option disabled={role==='patient'||!archive.sourceStates.length} value="real_open">TOLIFE · public observation archive</option><option value="synthetic">Fictional · contract illustration</option>
          </select></div>
          <p className="field-hint">{origin === 'real_open' ? 'Real-person observations are excluded from this public repository.' : 'One explicitly fictional profile for exploring the data contract.'}</p>
          <label className="field-label" htmlFor="demo-patient">{role === 'patient' ? 'Your demo profile' : 'Starting profile'}</label>
          <div className="select-wrap"><UserRound size={17} /><select id="demo-patient" value={selectedId} onChange={event => setPatientId(event.target.value)}>
            {states.map(state => <option key={state.patient_id} value={state.patient_id}>{state.patient_id} · {siteOf(state.patient_id)}</option>)}
          </select></div>
          <div className="demo-note"><ShieldCheck size={18} /><p>{origin === 'real_open' ? 'This archive shows recorded observations, not a live patient feed.' : 'All observations in this example are synthetic.'} {role === 'patient' && 'The backend restricts patient demo access to this fictional profile.'} The seven-day formula outlook is available separately; it is not an event probability.</p></div>
          <button className="ui-button ui-button-primary enter-workspace" type="submit" disabled={!selectedId||entering}>Enter {role === 'clinician' ? 'command centre' : 'patient workspace'} <ArrowRight size={18} /></button>
          {entryError&&<p role="alert">{entryError}</p>}<p className="demo-access-caption">No account required <span>·</span> Research prototype</p>
        </form>}
        <button className="demo-help" onClick={() => setHelp(true)}><CircleHelp size={16} /> What can I explore? <ArrowUpRight size={14} /></button>
      </section>
    </main>
    <footer className="demo-footer"><span>© 2026 Pulmira</span><AppLink href="/evidence">Evidence & help</AppLink><span>Observation-led. Patient-centred.</span></footer>
    <Modal open={help} onClose={() => setHelp(false)} title="A little context before you enter">
      <div className="dialog-copy"><p>Explore a patient directory, observation coverage and individual source snapshots. Search and filter the archive, inspect each measurement’s context, and download the selected data.</p><h3>Two clearly separated sources</h3><p><strong>TOLIFE:</strong> the original local archive contains 86 historical participants; patient-level records are excluded from this public distribution. Each snapshot has its own date. Source timing and device metadata have known limitations.</p><p><strong>Fictional illustration:</strong> one synthetic example from the verified monitoring-support package. It is not an additional real patient.</p><h3>What the demo does not estimate</h3><p>These views do not diagnose deterioration, estimate seven-day exacerbation probability or recommend treatment. Demo sessions use backend role checks. Patient sessions are restricted to the fictional profile; this is not a real clinical account.</p></div>
    </Modal>
  </div>;
}
