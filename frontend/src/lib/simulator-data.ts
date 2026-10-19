import { apiJson, apiResponse } from './api.ts';
export const SIM_CHANNELS = { spo2_pct:{name:'SpO₂',unit:'%',digits:1},heart_rate_bpm:{name:'Heart rate',unit:'bpm',digits:1},respiratory_rate_per_min:{name:'Respiratory rate',unit:'/min',digits:1},sleep_hours:{name:'Sleep duration',unit:'h',digits:1},gait_speed_m_per_s:{name:'Gait speed',unit:'m/s',digits:2},aqi_index:{name:'Air quality index',unit:'AQI',digits:1} } as const;
export type SimChannel=keyof typeof SIM_CHANNELS;
export const SIM_REPORT_KEYS=['reported_dyspnea_change','reported_cough_change','reported_symptom_collection_day','reported_symptom_age_days'] as const;
export type SimRow={day:number;date:string}&Record<SimChannel|typeof SIM_REPORT_KEYS[number],number|null>;
export interface Scenario { name:string;role:'default'|'test_only';interpretation:string;overrides:Record<string,unknown> }
export interface TraceEntry { profile:string;scenario:string;file:string;sha256:string;sourceSha256:string }
export interface SimulatorManifest { schemaVersion:string;version:string;origin:string;clinicalValidation:false;liveExecution:false;generationSeed:number;start:string;days:number;profileSelection:string;profiles:string[];scenarios:Scenario[];packageSha256:string;sourcesSha256:Record<string,string>;traces:TraceEntry[];interpretation:string }
export interface SimulatorTrace { schemaVersion:string;version:string;origin:string;clinicalValidation:false;patientId:string;scenario:string;packageSha256:string;sourceSha256:string;rows:SimRow[] }
const HASH=/^[a-f0-9]{64}$/;
export function validateSimulatorManifest(data:unknown):asserts data is SimulatorManifest{
  const m=data as SimulatorManifest;
  if(!m||m.schemaVersion!=='pulmira-simulator-manifest-1.0.0'||m.version!=='synthetic_copd_v2'||m.origin!=='synthetic_v2_engineering'||m.clinicalValidation!==false||m.liveExecution!==false||m.generationSeed!==20261010||m.start!=='2025-02-01'||m.days!==180||!HASH.test(m.packageSha256)||!Array.isArray(m.profiles)||!m.profiles.length||m.profiles.some(id=>!/^SIM-V2-KG-P\d+$/.test(id))||new Set(m.profiles).size!==m.profiles.length||!Array.isArray(m.scenarios)||m.scenarios.length!==16||!Array.isArray(m.traces))throw new Error('The fictional scenario catalogue failed its version or identity checks.');
  if(new Set(m.scenarios.map(s=>s.name)).size!==16||!m.scenarios.some(s=>s.name==='source_reference'&&s.role==='default')||m.scenarios.some(s=>!s||!/^[a-z_]+$/.test(s.name)||!['default','test_only'].includes(s.role)||typeof s.interpretation!=='string'||!s.overrides||typeof s.overrides!=='object'))throw new Error('The scenario catalogue contains invalid assumptions.');
  const keys=new Set<string>();for(const t of m.traces){if(!m.profiles.includes(t.profile)||!m.scenarios.some(s=>s.name===t.scenario)||t.file!==`${t.profile}--${t.scenario}.json`||!HASH.test(t.sha256)||!HASH.test(t.sourceSha256))throw new Error('A trace reference failed its checks.');keys.add(`${t.profile}|${t.scenario}`);}
  if(keys.size!==m.profiles.length*16||m.traces.length!==keys.size)throw new Error('The scenario catalogue is incomplete.');
}
export function validateSimulatorTrace(data:unknown,m:SimulatorManifest,entry:TraceEntry):asserts data is SimulatorTrace{
  const t=data as SimulatorTrace;
  if(!t||t.schemaVersion!=='pulmira-simulator-trace-1.0.0'||t.version!==m.version||t.origin!==m.origin||t.clinicalValidation!==false||t.patientId!==entry.profile||t.scenario!==entry.scenario||t.packageSha256!==m.packageSha256||t.sourceSha256!==entry.sourceSha256||!Array.isArray(t.rows)||t.rows.length!==m.days)throw new Error('This scenario trace does not match the selected fictional profile and version.');
  const allowed=['day','date',...Object.keys(SIM_CHANNELS),...SIM_REPORT_KEYS].sort().join('|');
  for(let i=0;i<t.rows.length;i++){
    const r=t.rows[i],date=new Date(Date.parse(m.start+'T00:00:00Z')+i*86400000).toISOString().slice(0,10);
    if(!r||r.day!==i||r.date!==date||Object.keys(r).sort().join('|')!==allowed||[...Object.keys(SIM_CHANNELS),...SIM_REPORT_KEYS].some(k=>r[k as SimChannel]!==null&&!Number.isFinite(r[k as SimChannel])))throw new Error('The trace has invalid days, values or non-observable fields.');
    const collected=r.reported_symptom_collection_day,age=r.reported_symptom_age_days;
    if((collected===null)!==(age===null)||collected!==null&&(!Number.isInteger(collected)||collected<0||collected>i||age!==i-collected))throw new Error('The trace has inconsistent symptom availability.');
  }
}
export async function fetchManifest(signal:AbortSignal):Promise<SimulatorManifest>{
  const data=await apiJson<unknown>('/frontend/simulator/manifest',{signal});validateSimulatorManifest(data);return data;
}
export async function fetchTrace(m:SimulatorManifest,profile:string,scenario:string,signal:AbortSignal):Promise<SimulatorTrace>{
  const entry=m.traces.find(t=>t.profile===profile&&t.scenario===scenario);if(!entry)throw new Error('This fictional profile or scenario is not in the bundle.');
  const response=await apiResponse(`/frontend/simulator/traces/${encodeURIComponent(profile)}/${encodeURIComponent(scenario)}`,{signal});if(!response.ok||!response.headers.get('content-type')?.includes('application/json'))throw new Error('The selected scenario trace is unavailable. Try again.');
  const bytes=await response.arrayBuffer();const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');if(hash!==entry.sha256)throw new Error('The scenario trace failed its SHA-256 integrity check.');
  const data:unknown=JSON.parse(new TextDecoder().decode(bytes));validateSimulatorTrace(data,m,entry);return data;
}
export function simWindow(trace:SimulatorTrace,day:number,window:number){return trace.rows.filter(row=>row.day<=day&&row.day>day-window);}
export function simStats(rows:SimRow[],channel:SimChannel){const values=rows.map(row=>row[channel]).filter((v):v is number=>v!==null);return {observed:values.length,missing:rows.length-values.length,mean:values.length?values.reduce((a,b)=>a+b,0)/values.length:null};}
export function simSegments(rows:SimRow[],channel:SimChannel){const result:SimRow[][]=[];for(const row of rows){if(row[channel]===null)continue;const last=result.at(-1);if(last?.at(-1)?.day===row.day-1)last.push(row);else result.push([row]);}return result;}
export function simValue(value:number|null,channel:SimChannel){return value===null?'Not observed':`${value.toFixed(SIM_CHANNELS[channel].digits)} ${SIM_CHANNELS[channel].unit}`;}
