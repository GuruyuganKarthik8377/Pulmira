"""Verify a proposed specification and train-only descriptive feasibility.

This does not execute a v2 simulator or certify clinical/causal correctness.
"""
import csv,hashlib,json
from pathlib import Path
import numpy as np
import pandas as pd

PROJECT=Path(__file__).resolve().parents[1]
SPEC=PROJECT/'config/causal_simulator_spec_v2.json'
OUT=PROJECT/'reports/simulator_spec_v2'

def sha(path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for block in iter(lambda:f.read(1024*1024),b''):h.update(block)
    return h.hexdigest()

def validate_spec(s,evidence):
    def require(ok,message):
        if not ok:raise ValueError(message)
    ids={r['id'] for r in evidence}
    require(len(ids)==len(evidence),'duplicate evidence ID')
    require(ids==set(s['source_ids']),'evidence reference mismatch')
    require(s['clinical_validation'] is False and s['causal_effects_identified'] is False,'unsupported validation claim')
    require(s['accuracy_target_used_for_parameter_selection'] is False,'accuracy-directed simulation selection')
    target=s['target']
    require(target['primary']=='symptom_onset_of_episode_later_classified_moderate_or_severe_care_proxy','primary endpoint changed')
    require(target['horizon_days']==7 and target['interval']=='(t,t+7]','forecast boundary changed')
    require(target['secondary_can_replace_primary'] is False,'care endpoint silently replaces onset')
    require(target['unknown_followup_label']=='unknown' and target['unknown_severity_label']=='unknown','censoring mislabeled negative')
    require(target['requires_label_maturation'] is True,'future care-based severity not ascertained')
    require(target['severity_scheme']=='historical_care_proxy_not_Rome','unsupported severity scheme')
    require(not set(s['candidate_observed_inputs'])&set(s['private_fields']),'private truth in model input')
    require(s['datasets']['calibration_split']=='train','nontraining calibration')
    require(s['datasets']['old_test_role']=='already_examined_development_reference_never_fresh_external_validation','old test relabelled independent')
    graph=s['causal_graph'];nodes=graph['nodes']
    require(graph['future_event_backfill_permitted'] is False and graph['event_dates_are_scheduled_inputs'] is False,'future-event templates permitted')
    require(graph['rng_streams_independent'] is True,'shared future RNG permitted')
    for edge in graph['edges']:
        a,b,lag=edge['parent'],edge['child'],edge['lag']
        require(a in nodes and b in nodes,'unknown graph node')
        require(isinstance(lag,int) and lag<=0,'future parent in causal graph')
        require(lag<0 or nodes[a]<nodes[b],'within-day graph cycle or reversed order')
    ev=s['evaluation']
    require(ev['test_used_for_selection'] is False and ev['publish_all_predeclared_scenarios'] is True,'test/scenario selection permitted')
    require(ev['test_seeds_new'] is True and ev['mechanism_shift_required'] is True,'no independent simulated challenge')
    require(ev['simulated_test_is_clinical_validation'] is False,'synthetic test called clinical validation')
    require(ev['predictability_audit_before_training'] is True,'training before predictability check')
    required={'weak_or_absent_warning','null_exposure_effect','stronger_benign_or_mimic_variation','illness_related_missingness'}
    require(required<=set(ev['stress_scenarios']),'required hard scenario missing')
    params=s['parameter_registry'];require(len({p['id'] for p in params})==len(params),'duplicate parameter')
    for p in params:
        require(set(p['evidence_ids'])<=ids and bool(p['evidence_ids']),'parameter lacks evidence reference')
        require(p['status'] in {'unresolved','engineering_assumption','descriptive_estimate'},'unsupported clinical parameter status')
        require(p['status']!='unresolved' or p['value'] is None,'unresolved parameter has hidden default')
    unresolved=[p['id'] for p in params if p['release_required'] and p['status']=='unresolved']
    require(not unresolved or s['generation_ready'] is False,'generation enabled with unresolved parameters')
    return unresolved

def training_descriptions():
    cols=['pei_spo2','pei_hr','bri_rf_mean','shri_hr_mean','prvi_mean_hr','pei_mean_pef','pei_mean_fev1','sqi_sleep_duration','ei_mean_aqi','mi_gs_mean']
    data_path=PROJECT/'data/processed/tolife_patient_day_full.csv'
    split_path=PROJECT/'data/processed/tolife_patient_split.csv'
    # CSV metadata need reading to filter; values outside training never enter summaries.
    x=pd.read_csv(data_path,usecols=['patient_id','date','split']+cols,parse_dates=['date'])
    split=pd.read_csv(split_path,usecols=['patient_id','split'])
    train_ids=set(split.loc[split.split.eq('train'),'patient_id'])
    x=x.loc[x.patient_id.isin(train_ids)].sort_values(['patient_id','date']).reset_index(drop=True)
    if not x.split.eq('train').all():raise AssertionError('Training membership mismatch')
    if x.duplicated(['patient_id','date']).any():raise AssertionError('Duplicate calibration day')
    # Independence check: streaming accumulation over only training CSV records.
    counts={c:0 for c in cols};sums={c:0. for c in cols};rows=0;ids=set()
    with data_path.open() as f:
        for row in csv.DictReader(f):
            if row['patient_id'] not in train_ids:continue
            rows+=1;ids.add(row['patient_id'])
            for c in cols:
                if row[c]!='':counts[c]+=1;sums[c]+=float(row[c])
    if rows!=len(x) or ids!=set(x.patient_id):raise AssertionError('Independent train filter mismatch')
    result=[]
    for c in cols:
        obs=x[c].dropna();patient_sd=x.groupby('patient_id')[c].std()
        prior=x.groupby('patient_id')[c].shift()
        prevdate=x.groupby('patient_id').date.shift()
        pairs=x[c].notna()&prior.notna()&x.date.sub(prevdate).dt.days.eq(1)
        if len(obs)!=counts[c]:raise AssertionError('Independent observed count mismatch')
        np.testing.assert_allclose(obs.sum(),sums[c],rtol=1e-11,atol=1e-8)
        result.append({'source_feature':c,'training_calendar_days':len(x),'observed_days':len(obs),
          'patients_with_observation':int(x.loc[x[c].notna(),'patient_id'].nunique()),
          'missing_fraction':float(x[c].isna().mean()),'raw_median':float(obs.median()),
          'raw_q25':float(obs.quantile(.25)),'raw_q75':float(obs.quantile(.75)),
          'median_patient_observed_sd':float(patient_sd.median()),'consecutive_observed_day_pairs':int(pairs.sum())})
    pd.DataFrame(result).to_csv(OUT/'training_channel_feasibility.csv',index=False)
    return {'patients':len(ids),'calendar_days':rows,'channels':len(cols),'independent_counts_and_sums_verified':True,
      'event_aligned_parameters_fitted':False,'device_noise_identified':False,'units_converted':False,
      'inputs':{str(data_path.relative_to(PROJECT)):sha(data_path),str(split_path.relative_to(PROJECT)):sha(split_path)},
      'interpretation':'All training calendar days, not verified stable days; descriptive coverage/dispersion only. No event curves or causal effects estimated.'}

def preserve():
    from evaluate_synthetic_model import check_locks
    check_locks();checks={'synthetic_model_locks':True}
    lock=json.loads((PROJECT/'models/task3/selection_lock.json').read_text())
    paths={'data_sha256':'data/processed/tolife_ml_safe.csv','features_sha256':'config/features.json','plan_sha256':'config/task3/training_plan.json','artifact_sha256':'models/task3/pulmira_risk_model.joblib','training_source_sha256':'src/train_task3.py','model_source_sha256':'src/pulmira_model.py'}
    for key,path in paths.items():checks[path]=sha(PROJECT/path)==lock[key]
    test=json.loads((PROJECT/'reports/task3/test_evaluation_lock.json').read_text())
    checks['reports/task3/test_predictions.csv']=sha(PROJECT/'reports/task3/test_predictions.csv')==test['predictions_sha256']
    cache=json.loads((PROJECT/'reports/synthetic_model_v1/test_prediction_lock.json').read_text())
    for name,value in cache['prediction_hashes'].items():checks['synthetic_cached_'+name]=sha(PROJECT/'reports/synthetic_model_v1'/name)==value
    folder=PROJECT/'data/processed/synthetic_copd_v1';prov=json.loads((folder/'provenance.json').read_text())
    for name,value in prov['output_hashes'].items():checks['simulation_'+name]=sha(folder/name)==value
    out=PROJECT/'reports/predictability_audit_v1';a=json.loads((out/'audit.json').read_text())
    for path,key in [('src/audit_predictability.py','source_sha256'),('src/predictability_math.py','math_source_sha256'),('config/predictability_audit_v1.json','plan_sha256')]:checks[path]=sha(PROJECT/path)==a[key]
    for name,value in json.loads((out/'output_hashes.json').read_text()).items():checks['audit_'+name]=sha(out/name)==value
    if not all(checks.values()):raise AssertionError(checks)
    return checks

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    with (OUT/'evidence.csv').open() as f:evidence=list(csv.DictReader(f))
    spec=json.loads(SPEC.read_text());unresolved=validate_spec(spec,evidence)
    feasibility=training_descriptions();checks=preserve()
    result={'specification_checks_passed':True,'clinical_validation':False,'causal_effects_identified':False,
      'generation_ready':False,'unresolved_required_parameters':unresolved,'training_feasibility':feasibility,
      'original_artifact_checks':checks,'verification_scope':'Specification constraints, independent train-only descriptive counts/sums and original artifact integrity. No v2 simulator has been run.'}
    (OUT/'verification.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps({k:v for k,v in result.items() if k not in ['original_artifact_checks','training_feasibility']},indent=2))
    print(json.dumps(feasibility,indent=2))

if __name__=='__main__':main()
