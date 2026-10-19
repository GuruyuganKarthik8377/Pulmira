"""Synthetic forecasting integrity checks; these do not assert medical validity."""
import json,sys
from pathlib import Path
import numpy as np
import pandas as pd
import pytest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'src'))
from forecast24_features import feature_frame,runtime_gate,portable_predict,STATIC

def fixture():
    rng=np.random.default_rng(20261017);x=rng.normal(80,5,(50,8));x[::4,0]=np.nan
    return x,np.arange(50,dtype=float),{k:1. for k in STATIC}

def test_future_observations_cannot_change_any_prior_feature_or_eligibility():
    x,age,static=fixture();original=feature_frame(x,age,static);changed=x.copy();changed[33:]=999
    other_age=age.copy();other_age[33:]=-10
    edited=feature_frame(changed,other_age,static)
    pd.testing.assert_frame_equal(original.iloc[:33],edited.iloc[:33]);np.testing.assert_array_equal(runtime_gate(original)[:33],runtime_gate(edited)[:33])

def test_gate_has_warmup_current_reading_and_past_only_baseline_count():
    x,age,static=fixture();f=feature_frame(x,age,static);g=runtime_gate(f)
    assert not g[:28].any();assert not g[28];assert g[29]
    x[:28,0]=np.nan;assert not runtime_gate(feature_frame(x,age,static))[28:35].any()

def test_only_the_declared_ehr_and_observable_channels_are_predictor_inputs():
    x,age,static=fixture();f=feature_frame(x,age,static)
    assert set(STATIC)<=set(f.columns)
    assert not set(f.columns)&{'patient_id','split','day','episode_truth','exacerbation_next_7_days','burden','future_value'}
    x[0,0]=np.inf
    with pytest.raises(ValueError):feature_frame(x,age,static)

def test_portable_inference_requires_matching_schema_and_preserves_missing_indicator():
    artifact={'features':['x'],'medians':[2.],'means':[0.,0.],'scales':[1.,1.],'model':{'family':'logistic','coefficients':[0.,2.],'intercept':0.}}
    p=portable_predict([[1.],[np.nan]],artifact);assert p[0]==.5 and p[1]>.8
    with pytest.raises(ValueError):portable_predict([[1.,2.]],artifact)
