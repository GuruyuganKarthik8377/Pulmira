"""Fit descriptive training-only references, never outcome mechanisms."""
import csv,gzip,hashlib,json
from pathlib import Path
import numpy as np
import pandas as pd

PROJECT=Path(__file__).resolve().parents[1]
OUT=PROJECT/'reports/simulator_parameters_v2'
PLAN=PROJECT/'config/causal_simulator_calibration_plan_v2.json'

def sha(path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for b in iter(lambda:f.read(1024*1024),b''):h.update(b)
    return h.hexdigest()

def load_training(plan):
    split=pd.read_csv(PROJECT/plan['membership_table'],usecols=['patient_id','split'])
    if split.patient_id.duplicated().any():raise ValueError('duplicate membership')
    allowed=set(split.loc[split.split.eq('train'),'patient_id'])
    columns=['patient_id','date','split']+[v['source'] for v in plan['channels'].values()]
    x=pd.read_csv(PROJECT/plan['source_table'],usecols=columns,parse_dates=['date'],float_precision='round_trip')
    x=x.loc[x.patient_id.isin(allowed)].sort_values(['patient_id','date']).reset_index(drop=True)
    if not x.split.eq('train').all():raise ValueError('train membership disagreement')
    if x.duplicated(['patient_id','date']).any():raise ValueError('duplicate patient date')
    return x

def channel_summaries(x,plan):
    rows=[]
    for pid,g in x.groupby('patient_id',sort=True):
        for channel,meta in plan['channels'].items():
            vals=g[meta['source']].to_numpy(dtype=float);valid=np.isfinite(vals)
            if np.isinf(vals).any():raise ValueError('infinite observation')
            observed=vals[valid];mask=valid.astype(int)
            adjacent=g.date.diff().dt.days.eq(1).to_numpy()[1:]
            counts=np.zeros((2,2),dtype=int)
            np.add.at(counts,(mask[:-1][adjacent],mask[1:][adjacent]),1)
            rows.append({'patient_id':pid,'channel':channel,'calendar_days':len(g),'observed_days':len(observed),
                'baseline_median':float(np.median(observed)) if len(observed) else None,
                'observed_sd':float(np.std(observed,ddof=1)) if len(observed)>1 else None,
                'count_00':int(counts[0,0]),'count_01':int(counts[0,1]),'count_10':int(counts[1,0]),'count_11':int(counts[1,1])})
    return pd.DataFrame(rows)

def reference_from_summaries(s,plan):
    rng=np.random.default_rng(plan['bootstrap_seed']);refs={}
    for channel,meta in plan['channels'].items():
        c=s.loc[s.channel.eq(channel)];enough=c.loc[c.observed_days.ge(plan['minimum_observations_per_patient'])]
        if len(enough)<5:raise ValueError('insufficient reference patients')
        a=enough.baseline_median.to_numpy();d=enough.observed_sd.to_numpy();n=len(a)
        idx=rng.integers(0,n,size=(plan['bootstrap_draws'],n))
        # Each sampled row is one patient, rather than one observation day.
        bci=np.percentile(np.median(a[idx],axis=1),plan['percentile_interval'])
        dci=np.percentile(np.median(d[idx],axis=1),plan['percentile_interval'])
        c00,c01,c10,c11=[int(c[k].sum()) for k in ['count_00','count_01','count_10','count_11']]
        # Binary state 1 = reading observed, 0 = no reading in this calendar.
        p01=(c01+1)/(c00+c01+2);p10=(c10+1)/(c10+c11+2)
        refs[channel]={'source_feature':meta['source'],'units':meta['units'],'collection_context':meta['context'],
          'training_patients_total':len(c),'reference_patients_at_least_7_readings':n,
          'observed_days':int(c.observed_days.sum()),'calendar_days':int(c.calendar_days.sum()),
          'baseline_median':float(np.median(a)),'baseline_patient_bootstrap_95pct':bci.tolist(),
          'total_observed_sd_median':float(np.median(d)),'total_sd_patient_bootstrap_95pct':dci.tolist(),
          'reference_sd_used':float(max(np.median(d),meta['minimum_reference_sd'])),
          'sd_floor_is_engineering_choice':meta['minimum_reference_sd'],
          'between_patient_baseline_pool':sorted(a.tolist()),
          'transition_counts':{'00':c00,'01':c01,'10':c10,'11':c11},
          'p_observed_after_missing':p01,'p_missing_after_observed':p10,
          'stationary_observation_fraction_of_assumed_markov_model':p01/(p01+p10),
          'empirical_observation_fraction':float(c.observed_days.sum()/c.calendar_days.sum())}
    return refs

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    plan=json.loads(PLAN.read_text());x=load_training(plan);s=channel_summaries(x,plan)
    s.to_csv(OUT/'training_patient_channel_summaries.csv',index=False,float_format='%.17g')
    refs=reference_from_summaries(s,plan)
    result={'version':'2.0.0','created':'2026-10-11','clinical_validation':False,'calibration_split':'train',
      'training_patients':int(x.patient_id.nunique()),'training_calendar_days':len(x),
      'outcomes_used_for_calibration':False,'stable_days_identified':False,'device_error_identified':False,
      'channels':refs,'inputs_sha256':{plan['source_table']:sha(PROJECT/plan['source_table']),plan['membership_table']:sha(PROJECT/plan['membership_table'])},
      'plan_sha256':sha(PLAN),'source_sha256':sha(Path(__file__)),
      'limitations':'All calendar observations include illness and biological variation. Bootstrap intervals are descriptive; neither causal effects nor clinical sensor-error parameters. Markov mapping is an engineering approximation, not verified device availability.'}
    (OUT/'calibration.json').write_text(json.dumps(result,indent=2,allow_nan=False)+'\n')
    print(json.dumps({'patients':result['training_patients'],'calendar_days':len(x),'channels':len(refs),'outcomes_used':False},indent=2))

if __name__=='__main__':main()
