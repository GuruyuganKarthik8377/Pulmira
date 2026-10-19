import { lazy, Suspense, useEffect } from 'react';
import { MotionConfig } from 'framer-motion';
import { PatientProvider } from './context/PatientContext';
import { AppLink } from './components/AppLink';
import { usePath } from './lib/navigation';
import './workspace.css';
import './patient.css';
import './records.css';
import './workbench.css';
import './resources.css';
import './exports.css';
import './integration.css';
import { useDemoSession } from './lib/monitoring';
import { usePreferences } from './lib/use-preferences';

const HomePage = lazy(() => import('./pages/HomePage').then(module => ({ default: module.HomePage })));
const DemoEntry = lazy(() => import('./pages/DemoEntry').then(module => ({ default: module.DemoEntry })));
const CommandCentre = lazy(() => import('./pages/CommandCentre').then(module => ({ default: module.CommandCentre })));

const PatientWorkspace = lazy(() => import('./pages/PatientWorkspace').then(module => ({ default: module.PatientWorkspace })));
const PatientPortal = lazy(() => import('./pages/PatientPortal').then(module => ({ default: module.PatientPortal })));

const DataDevices = lazy(() => import('./pages/DataDevices').then(module => ({ default:module.DataDevices })));
const Reports = lazy(() => import('./pages/Reports').then(module => ({ default:module.Reports })));
const PatientReport = lazy(() => import('./pages/Reports').then(module => ({ default:module.PatientReport })));

const ReviewQueue = lazy(() => import('./pages/ReviewQueue').then(module => ({default:module.ReviewQueue})));
const SyntheticSimulator = lazy(() => import('./pages/SyntheticSimulator').then(module => ({default:module.SyntheticSimulator})));

const EvidenceHelp = lazy(() => import('./pages/EvidenceHelp').then(module => ({default:module.EvidenceHelp})));
const Settings = lazy(() => import('./pages/Settings').then(module => ({default:module.Settings})));

const Recordings=lazy(()=>import('./pages/Recordings').then(m=>({default:m.Recordings})));

const SevenDayOutlook=lazy(()=>import('./pages/SevenDayOutlook').then(m=>({default:m.SevenDayOutlook})));

function App() {
  useDemoSession();
  const {preferences}=usePreferences();
  useEffect(()=>{document.documentElement.dataset.pulmiraMotion=preferences.motion;document.documentElement.dataset.pulmiraSpacing=preferences.spacing;},[preferences]);
  const path = usePath();
  const patientId = /^\/app\/patients\/([A-Za-z0-9-]+)\/?$/.exec(path)?.[1];
  const reportPatientId = /^\/app\/patients\/([A-Za-z0-9-]+)\/report\/?$/.exec(path)?.[1];
  const page = path === '/app/outlook' || path === '/app/outlook/' ? <SevenDayOutlook/> : path === '/app/recordings' ? <Recordings/> : path === '/evidence' || path === '/evidence/' ? <EvidenceHelp/>
    : path === '/app/settings' || path === '/app/settings/' ? <Settings/>
    : path === '/app/review' || path === '/app/review/' ? <ReviewQueue/>
    : path === '/app/simulator' || path === '/app/simulator/' ? <SyntheticSimulator/>
    : reportPatientId ? <PatientReport key={reportPatientId} patientId={reportPatientId}/>
    : path === '/app/data-quality' || path === '/app/data-quality/' ? <DataDevices/>
    : path === '/app/reports' || path === '/app/reports/' ? <Reports/>
    : patientId ? <PatientWorkspace key={patientId} patientId={patientId} />
    : path === '/patient' || path === '/patient/' ? <PatientPortal />
    : path === '/patient/check-in' || path === '/patient/check-in/' ? <PatientPortal checkIn />
    : path === '/demo' || path === '/demo/' ? <DemoEntry />
    : path === '/app/dashboard' || path === '/app/dashboard/' ? <CommandCentre />
    : path === '/' ? <HomePage />
    : <div className="pulmira-app workspace-loader"><h1>This page isn’t here yet.</h1><p>Head back to the demo to explore the available workspace.</p><AppLink href="/demo" className="ui-button ui-button-primary">Open Pulmira</AppLink></div>;
  return <MotionConfig reducedMotion={preferences.motion==='reduce'?'always':'user'}><PatientProvider>
    <Suspense fallback={<div className="pulmira-app workspace-loader" role="status">Opening Pulmira…</div>}>{page}</Suspense>
  </PatientProvider></MotionConfig>;
}

export default App;
