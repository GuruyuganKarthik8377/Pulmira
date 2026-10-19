import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateOutlook7,outlookCsv,outlookPath,pointRange} from '../src/lib/outlook7.ts';
import {csvText} from '../src/lib/csv-exports.ts';
const f=JSON.parse(readFileSync(new URL('./fixtures/outlook7.json',import.meta.url),'utf8'));
const state={patient_id:'DEMO-SYNTHETIC-002',data_origin:'synthetic' as const,as_of:'2025-01-04T12:05:00Z'};
const copy=()=>structuredClone(f.partial);
test('seven-day formula packet preserves known hand calculations and unknown-input bounds',()=>{
 validateOutlook7(f.partial,state);assert.equal(f.partial.score_min,87);assert.equal(f.partial.score_max,94);assert.equal(f.partial.days[0].score_min,65.25);assert.equal(pointRange(87,94),'87.0–94.0');
});
test('outlook refuses another patient, origin, historical decision or horizon',()=>{
 for(const change of [{patient_id:'GER-001'},{data_origin:'real_open'},{as_of:'2025-01-05T12:05:00Z'},{horizon_days:1}])assert.throws(()=>validateOutlook7({...copy(),...change},state));
});
test('rule-based points cannot silently become a percentage, clinical claim or accuracy number',()=>{
 for(const change of [{is_probability:true},{probability_next_7_days:.87},{clinical_validation:true},{predictive_accuracy:.95},{score_unit:'percent'}])assert.throws(()=>validateOutlook7({...copy(),...change},state));
});
test('future dates, factor arithmetic and source availability are validated',()=>{
 let p=copy();p.days[0].date='2025-01-04';assert.throws(()=>validateOutlook7(p,state));
 p=copy();p.days.pop();assert.throws(()=>validateOutlook7(p,state));
 p=copy();p.days[0].score_min+=1;assert.throws(()=>validateOutlook7(p,state));
 p=copy();p.streams[0].latest_available_at='2025-01-05T00:00:00Z';assert.throws(()=>validateOutlook7(p,state));
 p=copy();p.streams[0].observed_daily_values[0].value=Infinity;assert.throws(()=>validateOutlook7(p,state));
});
test('insufficient history stays unavailable rather than zero',()=>{
 validateOutlook7(f.unavailable,state);assert.equal(pointRange(null,null),'Unavailable');
 assert.throws(()=>validateOutlook7({...structuredClone(f.unavailable),score_min:0,score_max:0},state));
 assert.ok(outlookCsv(f.unavailable).rows.every(r=>r.score_min_points===null&&r.score_max_points===null));
});
test('CSV contains exactly seven projected days with raw point precision and no invented probability',()=>{
 const p=copy(),table=outlookCsv(p);assert.equal(table.rows.length,7);assert.equal(table.rows[0].score_min_points,65.25);assert.equal(table.rows[6].projection_date_utc,'2025-01-11');assert.ok(table.rows.every(r=>r.probability_next_7_days===null&&r.predictive_accuracy===null&&r.score_is_probability===false));assert.ok(csvText(table).startsWith('\ufeff'));assert.ok(outlookPath(state.patient_id,state.as_of).includes('asOf=2025-01-04T12%3A05%3A00Z'));
});
