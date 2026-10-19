"""Independent audit of the locked experiment's split, labels, metrics and deployable model."""
from pathlib import Path
import hashlib,json,sys
import numpy as np
import pandas as pd
from forecast24_features import feature_frame,runtime_gate,portable_predict

ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'reports/forecast24_v1';DATA=ROOT/'data/processed/forecast24_v1';MODELS=ROOT/'models/forecast24_v1'
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def ap(y,p):
    order=np.argsort(-p,kind='stable');y=y[order];p=p[order];ends=np.r_[p[:-1]!=p[1:],True];tp=np.cumsum(y)[ends];n=np.arange(1,len(y)+1)[ends]
    return float(np.sum(np.diff(np.r_[0,tp])/sum(y)*tp/n))
def auc(y,p):
    order=np.argsort(p,kind='stable');s=p[order];ends=np.r_[np.flatnonzero(s[:-1]!=s[1:])+1,len(s)];starts=np.r_[0,ends[:-1]];ranks=np.empty(len(s))
    for a,b in zip(starts,ends):ranks[order[a:b]]=(a+1+b)/2
    n1=y.sum();n0=len(y)-n1
    return float((ranks[y==1].sum()-n1*(n1+1)/2)/(n1*n0))

def main():
    plan=json.loads((ROOT/'config/forecast24_v1.json').read_text());lock=json.loads((OUT/'model_selection_lock.json').read_text());evaluation=json.loads((OUT/'test_evaluation.json').read_text());artifact=json.loads((MODELS/'model.json').read_text())
    assert sha(ROOT/'config/forecast24_v1.json')==lock['plan_sha256']==evaluation['plan_sha256'];assert sha(MODELS/'model.json')==lock['model_sha256']==evaluation['model_sha256']
    for name,want in {**plan['simulation']['sources_sha256'],**lock['code_sha256']}.items():assert sha(ROOT/name)==want,name
    members=pd.read_csv(OUT/'membership.csv');assert len(members)==800 and not members.source_patient_id.duplicated().any();assert members.groupby('split').size().to_dict()=={'test':160,'train':480,'validation':160}
    pools={s:set(members.loc[members.split.eq(s),'source_patient_id']) for s in ['train','validation','test']};assert all(not pools[a]&pools[b] for a,b in [('train','validation'),('train','test'),('validation','test')])
    rng=np.random.default_rng(24);checks={}
    for scenario,record in evaluation['results'].items():
        data=np.load(DATA/(scenario+'_test_audit.npz'));meta=pd.read_csv(DATA/(scenario+'_test_metadata.csv'));y=data['y'];p=data['probability'];gate=data['gate'];valid=gate&np.isfinite(y);expected=record['selected'];truth=y[valid];prob=p[valid];warning=prob>=artifact['threshold']
        assert set(meta.source_patient_id)==pools['test'];assert np.isnan(p[~gate]).all();assert int(valid.sum())==expected['rows'];assert int(np.sum(gate&~np.isfinite(y)))==record['unknown_future_labels']
        actual={'tp':int(np.sum(warning&(truth==1))),'tn':int(np.sum(~warning&(truth==0))),'fp':int(np.sum(warning&(truth==0))),'fn':int(np.sum(~warning&(truth==1))),'average_precision':ap(truth,prob),'roc_auc':auc(truth,prob),'accuracy':float((warning==truth).mean()),'brier':float(np.mean((truth-prob)**2))}
        for key,value in actual.items():assert abs(value-expected[key])<1e-12,(scenario,key,value,expected[key])
        idx=rng.choice(np.flatnonzero(gate),size=min(1000,int(gate.sum())),replace=False);assert np.max(np.abs(portable_predict(data['x'][idx],artifact)-p[idx]))<1e-12
        checks[scenario]={'independent_numpy_metrics':True,'portable_probability_sample_rows':len(idx),'evaluated_rows':int(valid.sum()),'unknown_future_labels_kept_unknown':True}
    # Reconstruct every UI example through the same source-only inputs, compare to held-out audit.
    examples=json.loads((DATA/'observable_demo_profiles.json').read_text())['profiles'];audit=np.load(DATA/'denser_assumed_monitoring_test_audit.npz');meta=pd.read_csv(DATA/'denser_assumed_monitoring_test_metadata.csv');points=0
    for example in examples:
        rows=example['observations'];assert len(rows)==180 and all(r['day']==i for i,r in enumerate(rows));assert example['source_profile_id'] in pools['test']
        columns=['spo2_pct','heart_rate_bpm','respiratory_rate_per_min','sleep_hours','aqi_index','gait_speed_m_per_s','reported_dyspnea_change','reported_cough_change'];x=np.array([[np.nan if r[k] is None else r[k] for k in columns] for r in rows]);age=np.array([np.nan if r['reported_symptom_age_days'] is None else r['reported_symptom_age_days'] for r in rows]);f=feature_frame(x,age,example['static']);index=np.flatnonzero(meta.patient_id.eq(example['profile_id']).to_numpy())
        np.testing.assert_allclose(f.iloc[28:180].to_numpy(),audit['x'][index],rtol=0,atol=0,equal_nan=True)
        future=x[29:180,0];labels=np.where(np.isfinite(future),(future<90).astype(float),np.nan);np.testing.assert_equal(labels,audit['y'][index[:-1]])
        # Source-prefix reconstruction equals full-history prefix for all supported decisions.
        for day in [0,27,28,60,90,179]:
            truncated=feature_frame(x[:day+1],age[:day+1],example['static']);np.testing.assert_allclose(f.iloc[day].to_numpy(),truncated.iloc[-1].to_numpy(),rtol=0,atol=0,equal_nan=True)
        points+=len(index)
    result={'passed':True,'source_hashes_unchanged':True,'base_profiles_disjoint':True,'independent_metrics':checks,'example_profiles':len(examples),'example_feature_rows_exactly_reconstructed':points,'future_labels_verified_from_next_observed_day':True,'future_truncation_checks':len(examples)*6,'no_retraining_or_threshold_change':True}
    (OUT/'independent_verification.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))

if __name__=='__main__':main()
