"""Past-only inputs and portable inference for the separate fictional 24-hour study.

No event register, hidden state, future observation or research label is accepted here.
"""
import math
import numpy as np
import pandas as pd

SENSORS=['spo2_pct','heart_rate_bpm','respiratory_rate_per_min','sleep_hours','aqi_index','gait_speed_m_per_s']
REPORTS=['reported_dyspnea_change','reported_cough_change']
STATIC=['age_at_simulation_baseline','sex_female','bmi','smoking_current','smoking_former','charlson_index','dx_heart_failure','dx_asthma','dx_type2_diabetes','dx_coronary_artery_disease','historical_copd_adherence_pct','historical_valid_admissions','historical_diagnosis_visits','latest_wbc','latest_hemoglobin','latest_creatinine','latest_glucose_fasting']

def feature_frame(values,report_age,static):
    """Each output row t depends only on static inputs and released measurements <=t."""
    values=np.asarray(values,dtype=float)
    if values.ndim!=2 or values.shape[1]!=8 or len(values)!=len(report_age) or np.isinf(values).any():
        raise ValueError('Invalid observable input matrix')
    out={}
    for j,ch in enumerate(SENSORS):
        s=pd.Series(values[:,j]);known=s.notna();index=pd.Series(np.where(known,np.arange(len(s)),np.nan)).ffill()
        out[ch+'_current']=s
        out[ch+'_last']=s.ffill()
        out[ch+'_age']=pd.Series(np.arange(len(s)))-index
        for width in (3,7,28):
            out[ch+f'_mean{width}']=s.rolling(width,min_periods=1).mean()
            out[ch+f'_count{width}']=s.rolling(width,min_periods=1).count()
        out[ch+'_std7']=s.rolling(7,min_periods=2).std()
        out[ch+'_prior28_mean']=s.shift().rolling(28,min_periods=1).mean()
        out[ch+'_prior28_count']=s.shift().rolling(28,min_periods=1).count().fillna(0)
        out[ch+'_delta_previous']=s-s.ffill().shift()
    for j,ch in enumerate(REPORTS,6):
        s=pd.Series(values[:,j]);known=s.notna();index=pd.Series(np.where(known,np.arange(len(s)),np.nan)).ffill()
        out[ch+'_current']=s;out[ch+'_last']=s.ffill()
        out[ch+'_release_age']=pd.Series(np.arange(len(s)))-index
    out['reported_symptom_collection_age_days']=pd.Series(report_age,dtype=float)
    for name in STATIC:
        value=static.get(name)
        out[name]=np.full(len(values),np.nan if value is None else float(value))
    return pd.DataFrame(out)

def runtime_gate(frame):
    return (np.arange(len(frame))>=28)&frame.spo2_pct_current.notna().to_numpy()&frame.spo2_pct_prior28_count.ge(7).to_numpy()

def transform(raw,artifact):
    x=np.asarray(raw,dtype=float)
    if x.ndim==1:x=x[None,:]
    if x.ndim!=2 or x.shape[1]!=len(artifact['features']) or np.isinf(x).any():raise ValueError('Feature schema mismatch')
    missing=np.isnan(x);x=np.where(missing,np.asarray(artifact['medians']),x)
    return (np.column_stack([x,missing.astype(float)])-np.asarray(artifact['means']))/np.asarray(artifact['scales'])

def portable_predict(raw,artifact):
    x=transform(raw,artifact);model=artifact['model']
    if model['family']=='logistic':
        score=x@np.asarray(model['coefficients'])+model['intercept']
    elif model['family']=='hist_gradient_boosting':
        score=np.full(len(x),model['baseline'],dtype=float)
        for tree in model['trees']:
            for i,row in enumerate(x):
                index=0
                while not tree[index]['is_leaf']:
                    node=tree[index];index=node['left'] if row[node['feature']]<=node['threshold'] else node['right']
                score[i]+=tree[index]['value']
    else:raise ValueError('Unsupported portable model')
    return 1/(1+np.exp(-np.clip(score,-709,709)))

def plain(value):
    if isinstance(value,(float,np.floating)):return float(value) if math.isfinite(value) else None
    if isinstance(value,(int,np.integer)):return int(value)
    return value
