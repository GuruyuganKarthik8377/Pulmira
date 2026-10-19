"""Independent CSV/statistics verification of parameter package (not a generator)."""
import copy,csv,datetime,json,math,statistics
from pathlib import Path
import numpy as np
from calibrate_simulator_parameters_v2 import PROJECT,OUT,sha
from verify_simulator_spec_v2 import preserve

PARAM=PROJECT/'config/causal_simulator_parameters_v2.json'
PLAN=PROJECT/'config/causal_simulator_calibration_plan_v2.json'

def parameters(package):return {r['id']:r['value'] for r in package['parameter_registry']}

def apply_scenario(base,scenario):
    result=copy.deepcopy(base)
    for path,value in scenario['overrides'].items():
        keys=path.split('.');cur=result
        for key in keys[:-1]:
            if key not in cur:raise ValueError('unknown scenario path')
            cur=cur[key]
        if keys[-1] not in cur:raise ValueError('unknown scenario parameter')
        cur[keys[-1]]=value
    return result

def validate_values(v):
    def req(ok,msg):
        if not ok:raise ValueError(msg)
    def finite_tree(x):
        if isinstance(x,dict):
            for y in x.values():finite_tree(y)
        elif isinstance(x,list):
            for y in x:finite_tree(y)
        elif isinstance(x,(float,int)) and not isinstance(x,bool):
            req(math.isfinite(x),'nonfinite numerical parameter')
    finite_tree(v)
    req(0<=v['burden_persistence']['rho']<1,'unstable burden rho')
    for group in ['infection_arrival_and_duration','abrupt_deterioration_process','benign_and_mimic_process']:
        p=v[group]['arrival_probability_per_day'];req(0<=p<=1,'invalid arrival probability')
        a=v[group]['amplitude_uniform'];req(0<=a[0]<=a[1],'invalid amplitude interval')
        if 'duration_days_inclusive' in v[group]:
            lo,hi=v[group]['duration_days_inclusive'];req(isinstance(lo,int) and isinstance(hi,int) and 1<=lo<=hi,'invalid process duration')
    r=v['sensor_response_and_lags']
    req(0<=r['weak_response_patient_fraction']<=1 and 0<=r['absent_response_patient_fraction']<=1 and r['weak_response_patient_fraction']+r['absent_response_patient_fraction']<=1,'invalid warning-group fractions')
    req(r['event_day_ramps_backfilled'] is False,'future ramp backfill')
    req(all(isinstance(x,int) and x>=0 for x in r['lag_days'].values()),'future signal lag')
    req(v['symptom_onset_rule']['retroactive_predictor_modification'] is False,'past predictor modified')
    req(v['symptom_onset_rule']['confirmation_consecutive_days']==2,'onset confirmation policy changed')
    req(v['episode_resolution_and_recurrence']['fixed_refractory_days']==0,'universal refractory period')
    req(v['spirometry_unit_confirmation']['decision']=='exclude_unconfirmed_channels','unconfirmed units used')
    observed=v['population_and_sensor_transfer']['candidate_observed_inputs']
    req(not set(observed)&{'pef_l_per_min','fev1_l','burden','future_event_date','symptom_onset','future_care_category','episode_truth'},'private or excluded input')
    req(v['exposure_process']['AQI_to_PM25_conversion'] is False,'AQI conversion invented')
    req(v['exposure_process']['separate_intrinsic_observation_noise_applied_to_aqi'] is False,'AQI variance double counted')
    req(v['exposure_burden_effect']['effect_is_identified'] is False,'causal effect claimed')
    req(v['intervention_response']['treatment_benefit_identified'] is False,'clinical benefit claimed')
    req(0<=v['intervention_response']['care_burden_decay_increment']<=v['burden_persistence']['rho'],'invalid care decay')
    dispersion=v['observation_dispersion']
    req(abs(dispersion['intrinsic_AR_rho'])<1,'unstable observation rho')
    size=len(dispersion['shared_innovation_channels']);correlation=dispersion['shared_standardized_innovation_correlation']
    req(size>1 and -1/(size-1)<=correlation<=1,'invalid shared covariance')
    d=v['device_error_and_bias'];req(0<=d['device_variance_fraction']<=1,'negative variance partition')
    for name,bounds in d['bounds'].items():req(bounds[0]<bounds[1],'invalid channel bounds')
    c=v['care_access_delay'];req(0<=c['willingness_probability_per_episode']<=1,'invalid care willingness')
    req(len(c['delay_days'])==len(c['delay_probabilities']) and all(x>=0 for x in c['delay_probabilities']) and abs(sum(c['delay_probabilities'])-1)<1e-12,'invalid care delay distribution')
    req(all(isinstance(x,int) and x>=0 for x in c['delay_days']),'invalid care day')
    m=v['missingness_and_dropout'];req(0<=m['symptom_reporting_probability']<=1,'invalid reporting probability')
    req(len(m['report_delay_values_days'])==len(m['report_delay_probabilities']) and all(x>=0 for x in m['report_delay_probabilities']) and abs(sum(m['report_delay_probabilities'])-1)<1e-12,'invalid report-delay distribution')
    req(all(isinstance(x,int) and x>=0 for x in m['report_delay_values_days']),'future report availability')
    req(m['historical_reports_enter_only_at_release_time'] is True,'late report backfill')
    mature=v['label_maturation_cap']
    req(mature['maximum_required_ascertainment_after_prediction_days']==mature['forecast_horizon_days']+mature['days_after_first_symptom_onset'],'incomplete label maturity')
    req(mature['additional_label_followup_days']>=mature['maximum_required_ascertainment_after_prediction_days'],'incomplete extra followup')
    req(mature['unobserved_cap_category']=='unknown' and mature['unconfirmed_tail_candidate']=='unknown','censored-negative label')
    req(m['default'] in {'source_calendar_reference_Markov','hypothetical_daily_Bernoulli'},'unknown availability process')
    req(0<=m['daily_observation_probability']<=1 and m['illness_missing_odds_multiplier']>=1,'invalid availability parameter')
    req(v['care_category_assignment']['severe_dyspnea_threshold']>v['symptom_onset_rule']['dyspnea_worsening_threshold'],'care-category threshold inconsistent')
    # Stationary event-free residual variance is partitioned, not added twice.
    fraction=d['device_variance_fraction']
    req(abs((1-fraction)+fraction-1)<1e-12,'variance double counting')

def validate_package(package,spec):
    if package['clinical_validation'] or package['causal_effects_identified'] or package['accuracy_target_used_for_parameter_selection']:raise ValueError('unsupported claim')
    if package['generation_verified']:raise ValueError('unimplemented generator marked verified')
    if package['calibration_split']!='train' or package['event_labels_used_for_parameterization']:raise ValueError('outcome or heldout calibration')
    if package['target']!=spec['target'] or package['protocol']!=spec['protocol']:raise ValueError('original endpoint/protocol changed')
    expected={r['id'] for r in spec['parameter_registry']};actual={r['id'] for r in package['parameter_registry']}
    if expected!=actual or len(actual)!=len(package['parameter_registry']):raise ValueError('parameter registry coverage')
    for r in package['parameter_registry']:
        if r['status'] not in {'engineering_assumption','descriptive_reference_with_engineering_mapping','excluded'} or r['value'] is None or r['clinically_validated']:raise ValueError('unresolved or clinical parameter')
        if not set(r['evidence_ids'])<=set(spec['source_ids']):raise ValueError('unknown evidence')
    v=parameters(package);validate_values(v)
    if v['exposure_burden_effect']['beta_per_100_AQI_above_100']!=0 or v['intervention_response']['care_burden_decay_increment']!=0:raise ValueError('default intervention benefit invented')
    names=[s['name'] for s in package['scenarios']]
    if len(names)!=len(set(names)) or not set(spec['evaluation']['stress_scenarios'])<=set(names):raise ValueError('missing/duplicate scenario')
    for s in package['scenarios']:
        if s['role'] not in {'default','test_only'}:raise ValueError('scenario can select model')
        validate_values(apply_scenario(v,s))
    if sum(s['role']=='default' for s in package['scenarios'])!=1:raise ValueError('multiple defaults')
    null=next(s for s in package['scenarios'] if s['name']=='null_exposure_effect')
    if apply_scenario(v,null)!=v:raise ValueError('paired null control differs from default')
    return v

def independent_calibration(plan,calibration):
    with (PROJECT/plan['membership_table']).open() as f:members={r['patient_id']:r['split'] for r in csv.DictReader(f)}
    per={};rows=0
    with (PROJECT/plan['source_table']).open() as f:
        for r in csv.DictReader(f):
            if members.get(r['patient_id'])!='train':continue
            if r['split']!='train':raise AssertionError('split conflict')
            rows+=1;pid=r['patient_id'];day=datetime.date.fromisoformat(r['date'])
            for ch,meta in plan['channels'].items():
                per.setdefault((pid,ch),[]).append((day,None if r[meta['source']]=='' else float(r[meta['source']])))
    if rows!=calibration['training_calendar_days']:raise AssertionError('calendar denominator')
    summaries={}
    for (pid,ch),records in per.items():
        vals=[v for d,v in records if v is not None];counts={x:0 for x in ['00','01','10','11']}
        for (d0,v0),(d1,v1) in zip(records,records[1:]):
            if (d1-d0).days==1:counts[str(int(v0 is not None))+str(int(v1 is not None))]+=1
        summaries[(pid,ch)]={'calendar_days':len(records),'observed_days':len(vals),'baseline_median':statistics.median(vals) if vals else None,'observed_sd':statistics.stdev(vals) if len(vals)>1 else None,'counts':counts}
    with (OUT/'training_patient_channel_summaries.csv').open() as f:
        stored=list(csv.DictReader(f))
    if len(stored)!=len(summaries):raise AssertionError('summary row count')
    for r in stored:
        s=summaries[(r['patient_id'],r['channel'])]
        for k in ['calendar_days','observed_days']:
            if int(r[k])!=s[k]:raise AssertionError(k)
        for k in ['baseline_median','observed_sd']:
            if s[k] is None:
                if r[k]!='':raise AssertionError('nonempty missing summary')
            elif not math.isclose(float(r[k]),s[k],rel_tol=1e-11,abs_tol=1e-11):raise AssertionError(k)
        for k in ['00','01','10','11']:
            if int(r['count_'+k])!=s['counts'][k]:raise AssertionError('transition count')
    rng=np.random.default_rng(plan['bootstrap_seed'])
    for ch,meta in plan['channels'].items():
        patients=[(pid,s) for (pid,c),s in sorted(summaries.items()) if c==ch]
        enough=[s for pid,s in patients if s['observed_days']>=plan['minimum_observations_per_patient']]
        medians=[s['baseline_median'] for s in enough];sds=[s['observed_sd'] for s in enough];ref=calibration['channels'][ch]
        np.testing.assert_allclose([ref['baseline_median'],ref['total_observed_sd_median']],[statistics.median(medians),statistics.median(sds)],rtol=1e-11,atol=1e-11)
        draws=[];sd_draws=[]
        for _ in range(plan['bootstrap_draws']):
            idx=rng.integers(0,len(enough),size=len(enough))
            draws.append(statistics.median(medians[i] for i in idx));sd_draws.append(statistics.median(sds[i] for i in idx))
        np.testing.assert_allclose(ref['baseline_patient_bootstrap_95pct'],np.percentile(draws,plan['percentile_interval']),rtol=1e-11,atol=1e-11)
        np.testing.assert_allclose(ref['total_sd_patient_bootstrap_95pct'],np.percentile(sd_draws,plan['percentile_interval']),rtol=1e-11,atol=1e-11)
        counts={k:sum(s['counts'][k] for pid,s in patients) for k in ['00','01','10','11']}
        if counts!=ref['transition_counts']:raise AssertionError('channel transition sum')
        p01=(counts['01']+1)/(counts['00']+counts['01']+2);p10=(counts['10']+1)/(counts['10']+counts['11']+2)
        np.testing.assert_allclose([p01,p10,p01/(p01+p10)],[ref['p_observed_after_missing'],ref['p_missing_after_observed'],ref['stationary_observation_fraction_of_assumed_markov_model']],rtol=1e-12)
        if sorted(medians)!=ref['between_patient_baseline_pool']:raise AssertionError('baseline sampling pool')
    # Shared spot-measurement masks are justified by exact date availability equality.
    for pid in {pid for pid,c in per}:
        if [(d,v is not None) for d,v in per[(pid,'spo2_pct')]]!=[(d,v is not None) for d,v in per[(pid,'heart_rate_bpm')]]:raise AssertionError('shared masks not equal')
    return {'training_patients':len({pid for pid,c in summaries}),'training_calendar_days':rows,'patient_channel_summaries':len(summaries),'bootstrap_draws_per_channel':plan['bootstrap_draws'],'raw_csv_medians_sd_transitions_and_bootstrap_independently_verified':True,'shared_spot_sensor_availability_verified':True}

def main():
    lock_path=OUT/'parameterization_lock.json'
    if lock_path.exists():
        lock=json.loads(lock_path.read_text())
        for path,expected in lock['frozen_files_sha256'].items():
            if sha(PROJECT/path)!=expected:raise AssertionError('frozen parameter deliverable changed: '+path)
    package=json.loads(PARAM.read_text());spec_path=PROJECT/'config/causal_simulator_spec_v2.json';spec=json.loads(spec_path.read_text())
    plan=json.loads(PLAN.read_text());calibration=json.loads((OUT/'calibration.json').read_text())
    validate_package(package,spec)
    for path,expected in calibration['inputs_sha256'].items():
        if sha(PROJECT/path)!=expected:raise AssertionError('calibration input changed')
    pairs=[(spec_path,package['specification_sha256']),(PLAN,package['calibration_plan_sha256']),(OUT/'calibration.json',package['calibration_sha256']),(PROJECT/'src/calibrate_simulator_parameters_v2.py',package['source_calibrator_sha256']),(PROJECT/'src/build_simulator_parameters_v2.py',package['source_builder_sha256']),(PROJECT/'data/processed/synthetic_copd_v1/patients.csv',package['profile_sha256'])]
    for path,expected in pairs:
        if sha(path)!=expected:raise AssertionError('package dependency changed: '+str(path))
    if package['descriptive_references']!=calibration['channels']:raise AssertionError('reference copied incorrectly')
    feasibility=independent_calibration(plan,calibration);old=preserve()
    prior=json.loads((PROJECT/'reports/simulator_spec_v2/deliverable_manifest.json').read_text())
    # README is deliberately updated as a status index; frozen prior artifacts remain fixed.
    for path,expected in prior['sha256'].items():
        if path!='README.md' and sha(PROJECT/path)!=expected:raise AssertionError('frozen specification artifact changed')
    result={'passed':True,'parameterization_complete':True,'parameters_resolved_or_excluded':len(package['parameter_registry']),'predeclared_scenarios':len(package['scenarios']),
      'clinical_validation':False,'causal_effects_identified':False,'generation_verified':False,'outcome_labels_used':False,
      'calibration_verification':feasibility,'old_artifact_checks':old,
      'verification_scope':'Descriptive reference calculation, engineering constraints and frozen artifact integrity. No v2 trajectory or model has been generated.'}
    (OUT/'verification.json').write_text(json.dumps(result,indent=2,allow_nan=False)+'\n')
    print(json.dumps({k:v for k,v in result.items() if k!='old_artifact_checks'},indent=2))

if __name__=='__main__':main()
