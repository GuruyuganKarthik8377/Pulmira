import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateForecastCatalogue,validateForecastPacket} from '../src/lib/forecast24.ts';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/forecast24.json',import.meta.url),'utf8'));
const copy=(key:string)=>structuredClone(fixture[key]);
const check=(p:any)=>validateForecastPacket(p,fixture.catalogue,p.profile_id,p.day);

test('forecast accepts the verified synthetic catalogue and actual selected-day response',()=>{
 validateForecastCatalogue(fixture.catalogue);check(fixture.available);
 assert.equal(fixture.available.status,'available');
 assert.equal(fixture.catalogue.evaluation.selected.rows,17442);
 assert.ok(fixture.catalogue.evaluation.current_not_low_subset.recall<.14);
});
test('forecast rejects clinical, real-source and seven-day claims',()=>{
 for(const change of [{domain:'real_open'},{clinical_validation:true},{horizon_days:7},{seven_day_prediction_available:true}])assert.throws(()=>validateForecastCatalogue({...copy('catalogue'),...change}));
 for(const change of [{data_origin:'real_open'},{clinical_validation:true},{probability_next_7_days:.25}])assert.throws(()=>check({...copy('available'),...change}));
});
test('forecast rejects mismatched profile, decision and frozen model',()=>{
 const p=copy('available');
 assert.throws(()=>validateForecastPacket(p,fixture.catalogue,'GER-002',90));
 assert.throws(()=>validateForecastPacket(p,fixture.catalogue,p.profile_id,91));
 assert.throws(()=>check({...p,model_sha256:'0'.repeat(64)}));
 assert.throws(()=>check({...p,plan_sha256:'0'.repeat(64)}));
});
test('forecast cannot export a future observation, hidden label or nonfinite input',()=>{
 const p=copy('available');p.available_observations.push({...p.available_observations.at(-1),day:91});assert.throws(()=>check(p));
 const hidden=copy('available');hidden.available_observations[0].future_label=1;assert.throws(()=>check(hidden));
 assert.throws(()=>check({...copy('available'),future_label:1}));
 const bad=copy('available');bad.input_feature_values.spo2_pct_current=Infinity;assert.throws(()=>check(bad));
});
test('warmup and missing-current days remain unknown, never zero-probability defaults',()=>{
 for(const key of ['warmup','missing']){const p=copy(key);check(p);assert.equal(p.status,'unavailable');assert.equal(p.probability_next_day_low_spo2,null);assert.equal(p.warning,null);assert.throws(()=>check({...p,probability_next_day_low_spo2:0}));}
});
