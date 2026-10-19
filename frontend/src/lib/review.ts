import type { Channel, PatientState } from './monitoring';
import { CHANNEL_NAMES } from './monitoring.ts';

export const REVIEW_RULES_VERSION = 'pulmira-review-rules-1.0.0';
export const NOTICE_KINDS = { missing:'Missing channels', stale:'Stale observations', invalid:'Invalid observations', baseline:'Baseline unavailable', diary:'Archived self-report' } as const;
export type NoticeKind = keyof typeof NOTICE_KINDS;
export interface ReviewNotice { id:string; kind:NoticeKind; patientId:string; origin:PatientState['data_origin']; asOf:string; title:string; explanation:string; channels:Channel[]; missing:string[]; diary:unknown|null }
export function buildReviewNotices(states:PatientState[]):ReviewNotice[] {
  const result:ReviewNotice[]=[];
  for(const state of states){
    if (!Number.isFinite(Date.parse(state.as_of)) || state.risk.probability_next_7_days!==null || state.risk.status!=='unavailable') throw new Error('The review source failed its timing or forecast checks.');
    const add=(kind:NoticeKind,title:string,explanation:string,channels:Channel[]=[],missing:string[]=[],diary:unknown|null=null)=>result.push({id:`${REVIEW_RULES_VERSION}|${state.data_origin}|${state.patient_id}|${state.as_of}|${kind}`,kind,patientId:state.patient_id,origin:state.data_origin,asOf:state.as_of,title,explanation,channels,missing,diary});
    if(state.missing_channels.length)add('missing',state.channels.length?'Some channel types are not observed':'No channel types are observed',`${state.missing_channels.map(key=>CHANNEL_NAMES[key]||key).join(', ')}. Missing is unknown; it is not a normal reading.`,[],state.missing_channels);
    const stale=state.channels.filter(row=>row.freshness==='stale');
    if(stale.length)add('stale',`${stale.length} stale source ${stale.length===1?'stream':'streams'}`,'The source packet marks these readings stale at this historical decision. Their age does not establish a clinical condition.',stale);
    const invalid=state.channels.filter(row=>row.freshness==='invalid');
    if(invalid.length)add('invalid',`${invalid.length} invalid source ${invalid.length===1?'stream':'streams'}`,'These streams are marked invalid in the source packet; no clinical priority is inferred.',invalid);
    const baseline=state.channels.filter(row=>row.baseline.mean===null);
    if(baseline.length)add('baseline',`${baseline.length} ${baseline.length===1?'stream lacks':'streams lack'} a baseline`,'The original packet has no baseline mean. Review the prior observed-day count rather than substituting a population value.',baseline);
    if(state.symptom_diary.latest){
      const diary=state.symptom_diary.latest as {patient_id?:string;data_origin?:string;available_at?:string;collected_at?:string};
      if(diary.patient_id!==state.patient_id||diary.data_origin!==state.data_origin||!Number.isFinite(Date.parse(diary.available_at||''))||!Number.isFinite(Date.parse(diary.collected_at||''))||Date.parse(diary.available_at!)>Date.parse(state.as_of)||Date.parse(diary.collected_at!)>Date.parse(state.as_of)) throw new Error('A diary notice failed its identity or historical availability checks.');
      add('diary','An archived symptom report is available','Direct self-report available at this decision, not a verified exacerbation. Current browser check-ins are excluded.',[],[],state.symptom_diary.latest);
    }
  }
  if(new Set(result.map(row=>row.id)).size!==result.length)throw new Error('Duplicate notice identities were found.');
  return structuredClone(result);
}
export interface SeenEntry { noticeId:string; seenAtClient:string }
export interface ReviewStore { getItem:(key:string)=>string|null;setItem:(key:string,value:string)=>void;removeItem:(key:string)=>void }
export const REVIEW_STORE_KEY='pulmira-review-seen-v1';
export function readSeen(store:ReviewStore):SeenEntry[]{
  const raw=store.getItem(REVIEW_STORE_KEY);if(raw===null)return [];
  let data:unknown;try{data=JSON.parse(raw);}catch{throw new Error('Saved review marks could not be read. They have not been overwritten.');}
  const value=data as {schema?:string;entries?:SeenEntry[]};
  if(!value||value.schema!=='pulmira-browser-review-1.0.0'||!Array.isArray(value.entries)||value.entries.length>5000||value.entries.some(row=>!row||typeof row.noticeId!=='string'||!row.noticeId.startsWith(REVIEW_RULES_VERSION+'|')||typeof row.seenAtClient!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(row.seenAtClient)||!Number.isFinite(Date.parse(row.seenAtClient)))||new Set(value.entries.map(row=>row.noticeId)).size!==value.entries.length)throw new Error('Saved review marks have an unsupported format. They have not been overwritten.');
  return value.entries;
}
export function setSeen(store:ReviewStore,noticeId:string,seen:boolean,at=new Date().toISOString()):SeenEntry[]{
  if(!noticeId.startsWith(REVIEW_RULES_VERSION+'|')||!Number.isFinite(Date.parse(at)))throw new Error('This review mark has an invalid identity or client time.');
  const entries=readSeen(store).filter(row=>row.noticeId!==noticeId);
  if(seen)entries.push({noticeId,seenAtClient:at});
  store.setItem(REVIEW_STORE_KEY,JSON.stringify({schema:'pulmira-browser-review-1.0.0',delivery:'browser_only',entries}));
  const confirmed=readSeen(store);
  if(JSON.stringify(confirmed)!==JSON.stringify(entries))throw new Error('The browser did not confirm this review mark.');
  return confirmed;
}
