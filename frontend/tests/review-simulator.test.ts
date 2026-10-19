import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {buildReviewNotices,readSeen,REVIEW_STORE_KEY,setSeen} from '../src/lib/review.ts';
import type {ReviewStore} from '../src/lib/review.ts';
import {SIM_CHANNELS,simSegments,simStats,simWindow,validateSimulatorManifest,validateSimulatorTrace} from '../src/lib/simulator-data.ts';
import type {SimulatorManifest,SimulatorTrace} from '../src/lib/simulator-data.ts';
import type {Archive} from '../src/lib/monitoring.ts';
const archive=JSON.parse(readFileSync(new URL('../public/data/pulmira-archive.json',import.meta.url),'utf8')) as Archive;
const multi=JSON.parse(readFileSync(new URL('./fixtures/multi-history.json',import.meta.url),'utf8')),empty=JSON.parse(readFileSync(new URL('./fixtures/empty-history.json',import.meta.url),'utf8'));
const states=[multi.snapshots.at(-1),empty.snapshots[0],...archive.syntheticStates];
const manifest=JSON.parse(readFileSync(new URL('../public/data/simulator/manifest.json',import.meta.url),'utf8')) as SimulatorManifest;
function trace(profile:string,scenario:string){return JSON.parse(readFileSync(new URL(`../public/data/simulator/${profile}--${scenario}.json`,import.meta.url),'utf8')) as SimulatorTrace;}
function store():ReviewStore{const data=new Map<string,string>();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>{data.set(key,value);},removeItem:key=>{data.delete(key);}};}

test('review rules exactly reflect source flags and keep identity, clocks and three HR contexts',()=>{
 const before=JSON.stringify(states),notices=buildReviewNotices(states);
 assert.equal(notices.filter(n=>n.kind==='missing'&&n.origin==='real_open').length,states.filter(s=>s.data_origin==='real_open'&&s.missing_channels.length).length);
 assert.equal(notices.filter(n=>n.kind==='stale').length,states.filter(s=>s.channels.some(c=>c.freshness==='stale')).length);
 const ger=notices.find(n=>n.patientId==='DEMO-SYNTHETIC-003'&&n.kind==='stale')!;
 assert.equal(ger.channels.filter(c=>c.channel==='heart_rate_bpm').length,3);
 assert.equal(notices.find(n=>n.patientId==='DEMO-SYNTHETIC-004'&&n.kind==='missing')?.missing.length,6);
 assert.ok(notices.every(n=>states.some(s=>s.patient_id===n.patientId&&s.data_origin===n.origin&&s.as_of===n.asOf)));
 assert.equal(JSON.stringify(states),before);
});
test('review diary remains source-only, false/null preserved and future diary rejected',()=>{
 const n=buildReviewNotices(states).find(n=>n.kind==='diary')!;const diary=n.diary as {cough_worse_than_usual:boolean;sputum_change:null};
 assert.equal(n.origin,'synthetic');assert.equal(diary.cough_worse_than_usual,false);assert.equal(diary.sputum_change,null);
 const bad=structuredClone(archive.syntheticStates);(bad[0].symptom_diary.latest as {available_at:string}).available_at='2099-01-01T00:00:00Z';assert.throws(()=>buildReviewNotices(bad),/availability/);
});
test('browser seen marks survive reads, undo exactly one notice and never change source notices',()=>{
 const st=store(),notices=buildReviewNotices(states),at='2026-10-17T00:00:00Z';
 setSeen(st,notices[0].id,true,at);setSeen(st,notices[1].id,true,at);assert.equal(readSeen(st).length,2);assert.equal(readSeen(st)[0].seenAtClient,at);
 setSeen(st,notices[0].id,false,at);assert.deepEqual(readSeen(st).map(r=>r.noticeId),[notices[1].id]);assert.ok(st.getItem(REVIEW_STORE_KEY)?.includes('browser_only'));
 assert.deepEqual(buildReviewNotices(states),notices);
});
test('failed, corrupt and silent browser storage cannot confirm review saves',()=>{
 const id=buildReviewNotices(states)[0].id,denied={getItem:()=>null,setItem:()=>{throw new Error('Quota denied');},removeItem:()=>{}};
 assert.throws(()=>setSeen(denied,id,true),/Quota/);
 const corrupt=store();corrupt.setItem(REVIEW_STORE_KEY,'{bad');assert.throws(()=>setSeen(corrupt,id,true),/not been overwritten/);assert.equal(corrupt.getItem(REVIEW_STORE_KEY),'{bad');
 const silent={getItem:()=>null,setItem:()=>{},removeItem:()=>{}};assert.throws(()=>setSeen(silent,id,true),/did not confirm/);
});
test('all 32 fictional traces pass identity, observable-only whitelist, calendar and byte integrity checks',()=>{
 validateSimulatorManifest(manifest);assert.equal(manifest.profiles.length,2);assert.equal(manifest.scenarios.length,16);
 for(const e of manifest.traces){const bytes=readFileSync(new URL('../public/data/simulator/'+e.file,import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),e.sha256);validateSimulatorTrace(JSON.parse(bytes.toString()),manifest,e);}
 const bad=structuredClone(manifest);bad.traces[0].file='../private.csv';assert.throws(()=>validateSimulatorManifest(bad),/reference/);
 const entry=manifest.traces[0],t=trace(entry.profile,entry.scenario);t.patientId=manifest.profiles[1];assert.throws(()=>validateSimulatorTrace(t,manifest,entry),/does not match/);
 const label=trace(entry.profile,entry.scenario);(label.rows[0] as unknown as Record<string,unknown>).episode_truth=1;assert.throws(()=>validateSimulatorTrace(label,manifest,entry),/non-observable/);
});
test('null exposure control exactly matches reference, with no fabricated risk or outcomes',()=>{
 for(const profile of manifest.profiles){const a=trace(profile,'source_reference'),b=trace(profile,'null_exposure_effect');assert.deepEqual(a.rows,b.rows);assert.equal(a.clinicalValidation,false);}
});
test('simulator windows never include later days, gaps break lines and missing values are not zero',()=>{
 const t=trace(manifest.profiles[0],'denser_assumed_monitoring');
 assert.equal(simWindow(t,0,30).length,1);assert.equal(simWindow(t,100,30).length,30);assert.ok(simWindow(t,100,30).every(r=>r.day<=100&&r.day>=71));
 const rows=structuredClone(t.rows.slice(0,4));rows.forEach((r,i)=>{r.spo2_pct=i===1?null:95+i;});
 assert.deepEqual(simSegments(rows,'spo2_pct').map(g=>g.length),[1,2]);assert.equal(simStats(rows,'spo2_pct').observed,3);
 for(const channel of Object.keys(SIM_CHANNELS) as (keyof typeof SIM_CHANNELS)[]){const empty=structuredClone(rows);empty.forEach(r=>{r[channel]=null;});assert.equal(simStats(empty,channel).mean,null);}
});
