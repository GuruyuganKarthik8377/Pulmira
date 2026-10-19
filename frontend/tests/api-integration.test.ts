import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {apiJson,setApiIdentity} from '../src/lib/api.ts';
import {receivedCheckIn} from '../src/lib/server-checkins.ts';
import {checkInsCsv} from '../src/lib/csv-exports.ts';
import {simulationRows} from '../src/lib/live-simulation.ts';

test('API retries an expired demo grant once and never falls back to bundled files',async()=>{
 const original=globalThis.fetch;const calls:string[]=[];let auth=0,reads=0;
 globalThis.fetch=async(input,options)=>{const path=String(input);calls.push(path);if(path.endsWith('/auth/demo-session')){auth++;assert.deepEqual(JSON.parse(String(options?.body)),{role:'patient',patient_id:'DEMO-SYNTHETIC-002'});return Response.json({token:'test-token',expires_at:new Date(Date.now()+60000).toISOString()});}reads++;return reads===1?Response.json({error:{message:'Expired',code:'unauthorized'}},{status:401}):Response.json({ok:true});};
 try{setApiIdentity({role:'patient',patientId:'DEMO-SYNTHETIC-002'});assert.deepEqual(await apiJson('/test'),{ok:true});assert.equal(auth,2);assert.equal(reads,2);assert.ok(calls.every(p=>p.startsWith('/api/v1/')));
  globalThis.fetch=async()=>Response.json({error:{message:'Role denied',code:'forbidden'}},{status:403});await assert.rejects(apiJson('/patients/GER-001/state'),/Role denied/);
 }finally{globalThis.fetch=original;setApiIdentity({role:'clinician',patientId:'GER-001'});}
});
test('a response from the previous role cannot populate the new role view',async()=>{
 const original=globalThis.fetch;let release:(r:Response)=>void=()=>{};let entered:()=>void=()=>{};const ready=new Promise<void>(r=>{entered=r;});
 globalThis.fetch=async(input)=>{if(String(input).endsWith('/auth/demo-session'))return Response.json({token:'test',expires_at:new Date(Date.now()+60000).toISOString()});entered();return new Promise<Response>(r=>{release=r;});};
 try{setApiIdentity({role:'patient',patientId:'DEMO-SYNTHETIC-002'});const pending=apiJson('/archive');await ready;setApiIdentity({role:'clinician',patientId:'GER-001'});release(Response.json({private:'old'}));await assert.rejects(pending,/perspective changed/);}finally{globalThis.fetch=original;}
});
test('server check-in receipts keep Yes, No, Unknown and separate local/server clocks in CSV',()=>{
 const d={diary_id:'D1',patient_id:'DEMO-SYNTHETIC-002',data_origin:'synthetic' as const,collected_at:'2026-10-17T10:00:00Z',available_at:'2026-10-17T10:00:01Z',dyspnea_worse_than_usual:true,cough_worse_than_usual:false,sputum_change:null,reported_symptom_start_at:null,reporter:'patient_self_report'};
 const row=checkInsCsv([receivedCheckIn(d,d.patient_id)]).rows[0];assert.equal(row.dyspnea_worse_than_usual_answer,'Yes');assert.equal(row.cough_worse_than_usual_answer,'No');assert.equal(row.sputum_change_answer,'Unknown');assert.equal(row.server_received_at_utc,d.available_at);assert.equal(row.stored_locally_at_utc,null);assert.equal(row.stored_at_server_utc,d.available_at);assert.equal(row.server_receipt_status,'server_utc');assert.throws(()=>receivedCheckIn({...d,patient_id:'GER-001'},d.patient_id),/identity/);
});
test('on-demand adapter preserves every observable cell and rejects hidden channels, false zeros and wrong identities',()=>{
 const source=JSON.parse(readFileSync(new URL('../public/data/simulator/SIM-V2-KG-P0000007--denser_assumed_monitoring.json',import.meta.url),'utf8'));
 const trace={synthetic_profile_id:source.patientId,scenario_id:source.scenario,scenario_version:source.version,clinical_validation:false as const,fictional:true as const,series:Object.keys(source.rows[0]).filter(k=>!['day','date'].includes(k)).map(channel=>({channel,points:source.rows.map((r:Record<string,unknown>)=>({day:r.day as number,simulated_date:r.date as string,value:r[channel] as number|null,observed:r[channel]!==null}))}))};
 assert.deepEqual(simulationRows(trace,source.patientId,source.scenario),source.rows);
 assert.throws(()=>simulationRows({...trace,synthetic_profile_id:'GER-001'},source.patientId,source.scenario),/match/);
 assert.throws(()=>simulationRows({...trace,series:[...trace.series,{channel:'episode_truth',points:[]}]},source.patientId,source.scenario),/non-observable/);
 const bad=structuredClone(trace);const missing=bad.series.flatMap(s=>s.points).find(p=>p.value===null)!;missing.value=0;assert.throws(()=>simulationRows(bad,source.patientId,source.scenario),/flags/);
});
