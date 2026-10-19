import { apiJson, identityKey, setApiIdentity } from './api.ts';
import { useEffect, useState, useSyncExternalStore } from 'react';

export type DemoRole = 'clinician' | 'patient';
export type DemoOrigin = 'real_open' | 'synthetic';
export interface DemoSession { role: DemoRole; origin: DemoOrigin; patientId: string }
export interface Channel {
  channel: string; units: string; context: string; value: number | null;
  device_id: string | null; source_series_id: string; measurement_end: string; measurement_start?: string | null; observation_id?: string; reasons?: string[];
  available_at: string; freshness: 'fresh' | 'stale' | 'invalid';
  measurement_age_hours: number; time_evidence: string; window_evidence: string;
  baseline: { mean: number | null; prior_observed_days: number; window_days?: number; timestamp_metadata_verified?: boolean; warmup_complete?: boolean };
}
export interface PatientTrend {
  channel: string; units: string; context: string; device_id: string | null; source_series_id: string;
  prior28_observed_days: number; prior28_median: number | null; recent7_observed_days: number;
  recent7_slope_units_per_day: number | null; change_from_prior28_median: number | null;
}
export interface PatientState {
  schema_version: string; patient_id: string; data_origin: DemoOrigin; as_of: string;
  state_status: string; channels: Channel[]; missing_channels: string[];
  risk: { probability_next_7_days: null; status: 'unavailable'; clinical_validation: false; reasons: string[] };
  symptom_diary: { status: string; latest: unknown | null };
  patient_trends?: PatientTrend[];
}
export interface Archive {
  server_connected?:boolean;
  schemaVersion: string; sourceLabel: string; sourceUrl: string; license: string;
  clockNote: string; sourceSha256: string; syntheticSha256: string;
  sourceStates: PatientState[]; syntheticStates: PatientState[];
}
export const CHANNEL_NAMES: Record<string, string> = {
  spo2_pct: 'SpO₂', heart_rate_bpm: 'Heart rate', respiratory_rate_per_min: 'Respiratory rate',
  sleep_hours: 'Sleep duration', gait_speed_m_per_s: 'Gait speed', aqi_index: 'Air quality index',
};
export const CHANNEL_ORDER = Object.keys(CHANNEL_NAMES);
export const SITE_NAMES: Record<string, string> = { GER: 'Germany', SPA: 'Spain', ITA: 'Italy', DEMO: 'Fictional' };
const SESSION_KEY = 'pulmira-demo-session-v1';
let archivePromise: Promise<Archive> | null = null;
let archiveKey='';
let memorySession: DemoSession | null = null;

function validateArchive(data: unknown): asserts data is Archive {
  if (!data || typeof data !== 'object') throw new Error('The observation archive could not be read.');
  const archive = data as Archive;
  if (archive.schemaVersion !== 'pulmira-frontend-archive-1.0.0' || !Array.isArray(archive.sourceStates) || !Array.isArray(archive.syntheticStates)) throw new Error('This observation archive has an unsupported format.');
  for (const [states, origin] of [[archive.sourceStates, 'real_open'], [archive.syntheticStates, 'synthetic']] as const) {
    for (const state of states) {
      if (state.data_origin !== origin || typeof state.patient_id !== 'string' || !Number.isFinite(Date.parse(state.as_of)) || !Array.isArray(state.channels) || !Array.isArray(state.missing_channels) || state.risk?.status !== 'unavailable' || state.risk?.probability_next_7_days !== null) throw new Error('The observation archive failed its source or forecast checks.');
    }
  }
}

export function loadArchive(): Promise<Archive> {
  readSession();const key=identityKey();
  if(archiveKey!==key){archiveKey=key;archivePromise=null;}
  if(!archivePromise)archivePromise=apiJson<unknown>('/frontend/archive').then(data=>{validateArchive(data);return data;}).catch(error=>{if(archiveKey===key)archivePromise=null;throw error;});
  return archivePromise;
}
export function useArchive() {
  const session=useDemoSession(),scope=session.role==='patient'?`patient:${session.patientId}`:'clinician';
  const [result,setResult]=useState<{scope:string;archive?:Archive;error?:string}|null>(null);
  const [attempt,setAttempt]=useState(0);
  useEffect(()=>{let active=true;loadArchive().then(archive=>{if(active)setResult({scope,archive});}).catch(reason=>{if(active)setResult({scope,error:reason instanceof Error?reason.message:'Unable to load the backend archive.'});});return()=>{active=false;};},[scope,attempt]);
  return {archive:result?.scope===scope?result.archive??null:null,error:result?.scope===scope?result.error??'':'',retry:()=>{archivePromise=null;setResult(null);setAttempt(n=>n+1);}};
}

export function readSession(): DemoSession {
  if (memorySession) {setApiIdentity(memorySession);return memorySession;}
  try {
    const value = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null') as DemoSession | null;
    if (value && ['clinician', 'patient'].includes(value.role) && ['real_open', 'synthetic'].includes(value.origin) && typeof value.patientId === 'string') { memorySession = value.role==='patient'&&value.origin!=='synthetic'?{role:'patient',origin:'synthetic',patientId:'DEMO-SYNTHETIC-002'}:value;setApiIdentity(memorySession);return memorySession; }
  } catch { /* An unavailable browser store must not prevent read-only demo access. */ }
  memorySession = { role: 'clinician', origin: 'synthetic', patientId: 'DEMO-SYNTHETIC-002' };
  setApiIdentity(memorySession);return memorySession;
}
export function saveSession(session: DemoSession) {
  if(session.role==='patient'&&session.origin!=='synthetic')throw new Error('Patient demo sessions require a fictional profile.');
  memorySession = session;setApiIdentity(session);
  let persisted = false;
  try { const encoded=JSON.stringify(session); sessionStorage.setItem(SESSION_KEY,encoded); persisted=sessionStorage.getItem(SESSION_KEY)===encoded; } catch { /* Read-only demo also works without persistence. */ }
  window.dispatchEvent(new Event('pulmira-session-change'));
  return { persisted };
}
export function getStates(archive: Archive, origin: DemoOrigin) {
  return (origin === 'synthetic' ? archive.syntheticStates : archive.sourceStates).slice().sort((a, b) => a.patient_id.localeCompare(b.patient_id));
}
export function siteOf(id: string) { return SITE_NAMES[id.split('-')[0]] || 'Source archive'; }
export function channelCount(state: PatientState) { return new Set(state.channels.map(channel => channel.channel)).size; }
export function formatDate(value: string, long = false) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: long ? 'long' : 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(value));
}
export function formatValue(channel: Pick<Channel,'channel'|'units'|'value'>) {
  if (channel.value === null) return '—';
  const value = new Intl.NumberFormat('en-GB', { maximumFractionDigits: channel.channel === 'gait_speed_m_per_s' ? 2 : 1 }).format(channel.value);
  const units: Record<string, string> = { percent: '%', bpm: ' bpm', breaths_per_min: ' /min', hours: ' h', m_per_s: ' m/s', AQI_index: ' AQI' };
  return value + (units[channel.units] ?? ` ${channel.units}`);
}
export function exportJson(filename: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = filename;
  document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const subscribeSession = (listener: () => void) => { window.addEventListener('pulmira-session-change', listener); return () => window.removeEventListener('pulmira-session-change', listener); };
export const useDemoSession = () => useSyncExternalStore(subscribeSession, readSession, readSession);
