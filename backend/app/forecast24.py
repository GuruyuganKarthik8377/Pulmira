"""Fictional next-day measured-value forecast. Isolated from real-patient state/risk APIs."""
import hashlib
import importlib.util
import json
from pathlib import Path
import threading
import numpy as np

DIRECTORY=Path(__file__).resolve().parents[1]/'vendor/forecast24'
_lock=threading.Lock()
_loaded=None

class UnknownProfile(LookupError):
    """A requested ID is outside the frozen fictional catalogue."""

def load():
    global _loaded
    with _lock:
        if _loaded is not None:return _loaded
        manifest=json.loads((DIRECTORY/'manifest.json').read_text())
        if manifest['clinical_validation'] is not False or manifest['domain']!='synthetic_only' or manifest['horizon_days']!=1 or manifest['seven_day_prediction_available'] is not False:
            raise RuntimeError('Forecast domain/version boundary failed')
        for name,want in manifest['files_sha256'].items():
            if name not in ('model.json','profiles.json','forecast24_features.py') or hashlib.sha256((DIRECTORY/name).read_bytes()).hexdigest()!=want:
                raise RuntimeError('Forecast package integrity check failed')
        model=json.loads((DIRECTORY/'model.json').read_text());profiles=json.loads((DIRECTORY/'profiles.json').read_text())['profiles']
        if model['clinical_validation'] is not False or model['domain']!='synthetic_only' or len(model['features'])!=102 or not manifest['evaluation']['demo_accepted'] or model['plan_sha256']!=manifest['plan_sha256'] or manifest['model_sha256']!=manifest['files_sha256']['model.json'] or model['threshold']!=manifest['threshold']:
            raise RuntimeError('The experimental model did not pass its declared checks')
        spec=importlib.util.spec_from_file_location('pulmira_forecast24_features',DIRECTORY/'forecast24_features.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
        _loaded=(manifest,model,{p['profile_id']:p for p in profiles},module)
        return _loaded

def catalogue():
    manifest,_,profiles,_=load()
    return {**manifest,'profiles':[{'profile_id':p['profile_id'],'data_origin':'synthetic_forecast24','fictional':True,'split':'heldout_test'} for p in profiles.values()],'supported_day_range':[0,179]}

def predict(profile_id,day):
    manifest,model,profiles,module=load()
    if profile_id not in profiles:raise UnknownProfile(profile_id)
    if not isinstance(day,int) or isinstance(day,bool) or not 0<=day<=179:raise ValueError('day must be 0..179')
    profile=profiles[profile_id];rows=profile['observations'][:day+1]
    channels=module.SENSORS+module.REPORTS
    x=np.array([[np.nan if r[k] is None else r[k] for k in channels] for r in rows],dtype=float)
    age=np.array([np.nan if r['reported_symptom_age_days'] is None else r['reported_symptom_age_days'] for r in rows])
    frame=module.feature_frame(x,age,profile['static']);current=frame.iloc[-1]
    reasons=[]
    if day<28:reasons.append('28_day_warmup_incomplete')
    if rows[-1]['spo2_pct'] is None:reasons.append('current_spo2_not_observed')
    if current.spo2_pct_prior28_count<7:reasons.append('insufficient_prior_spo2_readings')
    eligible=bool(module.runtime_gate(frame)[-1]);probability=float(module.portable_predict(current.to_numpy(),model)[0]) if eligible else None
    if probability is not None and (not np.isfinite(probability) or not 0<=probability<=1):raise RuntimeError('Nonfinite forecast rejected')
    from datetime import date,timedelta
    return {'schema_version':'pulmira-forecast24-response-1.0.0','experiment_version':'forecast24_v1','profile_id':profile_id,'data_origin':'synthetic_forecast24','fictional':True,'clinical_validation':False,'day':day,'date':rows[-1]['date'],'target_date':(date.fromisoformat(rows[-1]['date'])+timedelta(days=1)).isoformat(),'horizon_days':1,'outcome':manifest['outcome'],'status':'available' if eligible else 'unavailable','probability_next_day_low_spo2':probability,'warning':probability>=model['threshold'] if eligible else None,'threshold':model['threshold'],'reasons':reasons,'probability_next_7_days':None,'current_reading':rows[-1]['spo2_pct'],'prior28_spo2_mean':module.plain(current.spo2_pct_prior28_mean),'prior28_spo2_count':int(current.spo2_pct_prior28_count),'current_already_low':rows[-1]['spo2_pct']<90 if rows[-1]['spo2_pct'] is not None else None,'static_ehr':profile['static'],'available_observations':rows,'input_feature_values':{k:module.plain(current[k]) for k in model['features']},'model_sha256':manifest['model_sha256'],'plan_sha256':manifest['plan_sha256'],'interpretation':'Conditional synthetic next-day measurement forecast. Ongoing low readings included; not a COPD exacerbation or clinically validated early-warning probability.'}
