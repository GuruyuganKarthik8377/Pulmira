import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {checkInsCsv,comparisonCsv,csvText,qualityCsv,reviewCsv,snapshotsCsv} from '../src/lib/csv-exports.ts';
import {qualityRows} from '../src/lib/quality.ts';
import {buildReviewNotices} from '../src/lib/review.ts';
import {createCheckIn} from '../src/lib/checkins.ts';
const read=(file:string)=>JSON.parse(readFileSync(new URL('../public/data/'+file,import.meta.url),'utf8'));
const real=JSON.parse(readFileSync(new URL('./fixtures/multi-history.json',import.meta.url),'utf8')),empty=JSON.parse(readFileSync(new URL('./fixtures/empty-history.json',import.meta.url),'utf8')),fictional=read('patients/DEMO-SYNTHETIC-002.json'),archive=read('pulmira-archive.json'),manifest=read('simulator/manifest.json');
const at='2026-10-17T00:00:00Z';
// Independent small RFC 4180 reader for round-trip assertions; not used by export implementation.
function parse(text:string){const rows:string[][]=[];let row:string[]=[],field='',quoted=false;for(let i=text.charCodeAt(0)===0xfeff?1:0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(field);field='';}else if(c==='\r'&&!quoted&&text[i+1]==='\n'){row.push(field);rows.push(row);row=[];field='';i++;}else field+=c;}return rows;}

test('CSV quoting round-trips commas, embedded quotes/newlines, unicode and booleans with BOM/CRLF',()=>{
 const table={columns:['text','number','unknown','flag'],rows:[{text:'SpO₂, "wrist"\ncontext',number:0,unknown:null,flag:false}]};
 const text=csvText(table);assert.equal(text.charCodeAt(0),0xfeff);assert.ok(text.endsWith('\r\n'));assert.deepEqual(parse(text),[table.columns,['SpO₂, "wrist"\ncontext','0','','false']]);
 assert.throws(()=>csvText({columns:['x'],rows:[{x:NaN}]}),/finite/);assert.throws(()=>csvText({columns:['x','x'],rows:[]}),/unique/);
});
test('formula-like string cells are neutralized while negative numeric values retain numeric meaning',()=>{
 const text=csvText({columns:['formula','spaced','number'],rows:[{formula:'=1+1',spaced:'\t@SUM(1)',number:-1.25}]});assert.deepEqual(parse(text)[1],["'=1+1","'\t@SUM(1)",'-1.25']);
});
test('quality CSV preserves all separate HR streams, raw values, UTC times and explicit missing/unknown fields',()=>{
 const state=real.snapshots.at(-1),table=qualityCsv(state,qualityRows(state,real.observations),at);
 const hr=table.rows.filter(row=>row.channel==='heart_rate_bpm');assert.equal(hr.length,3);assert.equal(new Set(hr.map(row=>row.context)).size,3);
 for(const row of table.rows){assert.equal(row.as_of_utc,state.as_of);assert.equal(row.clinical_validation,false);assert.equal(row.device_identity_status,'not_established');}
 const missing=qualityCsv(empty.snapshots[0],qualityRows(empty.snapshots[0],empty.observations),at);assert.equal(missing.rows.length,6);assert.ok(missing.rows.every(row=>row.value===null&&row.value_status==='unknown'&&row.freshness_at_decision==='missing'));
 assert.ok(parse(csvText(missing)).every(row=>row.length===missing.columns.length));
});
test('snapshot CSV retains full numerical precision and never substitutes a forecast probability',()=>{
 const state=fictional.snapshots.at(-1),before=JSON.stringify(state),table=snapshotsCsv([state],'selected_snapshot',at);
 assert.equal(table.rows.find(row=>row.channel==='heart_rate_bpm')?.value,state.channels.find((row:{channel:string})=>row.channel==='heart_rate_bpm').value);
 assert.ok(table.rows.every(row=>row.forecast_probability_next_7_days===null&&row.forecast_status==='unavailable'));assert.equal(JSON.stringify(state),before);
});
test('review CSV flattens affected streams without dropping identity or confusing diary No with Unknown',()=>{
 const notices=buildReviewNotices([real.snapshots.at(-1),...archive.syntheticStates]);
 const chosen=notices.filter(n=>n.patientId==='DEMO-SYNTHETIC-003'&&n.kind==='stale'||n.kind==='diary').map(n=>({...n,seen_at_client:null,seen_state_available:false}));
 const table=reviewCsv(chosen,{query:'GER-002',origin:'all'},at);assert.equal(table.rows.filter(row=>row.channel==='heart_rate_bpm').length,3);
 const diary=table.rows.find(row=>row.row_type==='archived_diary')!;assert.equal(diary.dyspnea_worse_than_usual_answer,'Yes');assert.equal(diary.cough_worse_than_usual_answer,'No');assert.equal(diary.sputum_change_answer,'Unknown');assert.equal(diary.local_review_state,'unknown');assert.equal(diary.backend_acknowledged,false);assert.equal(diary.channel,null);
 assert.ok(parse(csvText(table)).every(row=>row.length===table.columns.length));
});
test('simulator CSV exports only the selected channel/window with matched dates, exact values and declared assumptions',()=>{
 const profile=manifest.profiles[0],reference=read(`simulator/${profile}--source_reference.json`),variant=read(`simulator/${profile}--denser_assumed_monitoring.json`);
 const table=comparisonCsv(manifest,reference,variant,'heart_rate_bpm',99,30,at);assert.equal(table.rows.length,30);assert.equal(table.rows[0].simulation_day_1_based,71);assert.equal(table.rows.at(-1)?.simulation_day_1_based,100);
 for(const row of table.rows){const i=Number(row.simulation_day_1_based)-1;assert.equal(row.reference_value,reference.rows[i].heart_rate_bpm);assert.equal(row.variant_value,variant.rows[i].heart_rate_bpm);assert.equal(row.date_utc,reference.rows[i].date);assert.equal(row.clinical_validation,false);assert.equal(row.live_execution,false);assert.match(String(row.variant_override_summary),/0.85/);}
 const first=comparisonCsv(manifest,reference,variant,'spo2_pct',0,180,at);assert.equal(first.rows.length,1);assert.equal(first.rows[0].reference_value_status,'not_observed');assert.equal(first.rows[0].reference_value,null);
 const wrong=structuredClone(variant);wrong.patientId='other';assert.throws(()=>comparisonCsv(manifest,reference,wrong,'spo2_pct',99,30,at),/profile/);
 assert.ok(parse(csvText(table)).every(row=>row.length===table.columns.length));
});
test('check-in CSV retains Yes/No/Unknown, unknown onset and absent server receipt',()=>{
 const entry=createCheckIn('DEMO-SYNTHETIC-002','synthetic',{dyspnea_worse_than_usual:'yes',cough_worse_than_usual:'no',sputum_change:'unsure'},'','+00:00',at,'CSV-QA');
 const row=checkInsCsv([entry],at).rows[0];assert.equal(row.dyspnea_worse_than_usual_answer,'Yes');assert.equal(row.cough_worse_than_usual_answer,'No');assert.equal(row.sputum_change_answer,'Unknown');assert.equal(row.reported_symptom_start_status,'unknown');assert.equal(row.server_received_at_utc,null);assert.equal(row.delivery_status,'browser_only');assert.equal(row.clinical_validation,false);
});
