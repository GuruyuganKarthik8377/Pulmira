"""Hand calculations, invariants and access controls for the unvalidated seven-day outlook."""
from copy import deepcopy
from datetime import datetime,timedelta,timezone
import json
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from app.main import create_app
from app.outlook7 import build_outlook
from app import outlook7

PID='DEMO-SYNTHETIC-002';ORIGIN='synthetic';ASOF='2025-01-04T12:05:00Z'
def inputs():
    rows=[]
    for day in range(4):
        clock=f'2025-01-{day+1:02d}T12:00:00Z'
        for ch,unit,value in [('spo2_pct','percent',99-day),('heart_rate_bpm','bpm',80+10*day),('respiratory_rate_per_min','breaths_per_min',16+2*day)]:
            rows.append({'observation_id':f'{ch}-{day}','patient_id':PID,'data_origin':ORIGIN,'channel':ch,'context':'fictional_wristband','device_id':'DEMO','source_series_id':ch,'measurement_start':None,'measurement_end':clock,'available_at':clock,'value':value,'units':unit,'validity':1,'time_evidence':'synthetic_generated','window_evidence':'synthetic_generated'})
    diary={'diary_id':'D1','patient_id':PID,'data_origin':ORIGIN,'collected_at':'2025-01-04T12:00:00Z','available_at':'2025-01-04T12:01:00Z','dyspnea_worse_than_usual':True,'cough_worse_than_usual':False,'sputum_change':None,'reported_symptom_start_at':None,'reporter':'patient_self_report'}
    return rows,[diary]
def calculate(rows=None,diaries=None,as_of=ASOF):
    original,diary=inputs();return build_outlook(PID,ORIGIN,as_of,original if rows is None else rows,diary if diaries is None else diaries)

def test_seven_future_dates_and_independent_hand_calculation():
    p=calculate();assert p['status']=='partial' and p['known_weight']==93
    assert [(d['day'],d['date']) for d in p['days']]==[(i,f'2025-01-{i+4:02d}') for i in range(1,8)]
    # Day 1: SpO2 27.5 + RR 13.75 + HR 12 + dyspnea 12 + unknown sputum [0,7].
    assert p['days'][0]['score_min']==pytest.approx(65.25)
    assert p['days'][0]['score_max']==pytest.approx(72.25)
    assert p['score_min']==87 and p['score_max']==94 and p['score_band']=='elevated_change'
    assert p['probability_next_7_days'] is None and p['predictive_accuracy'] is None
    assert p['is_probability'] is False and p['clinical_validation'] is False
    assert all(s['slope_capped'] for s in p['streams'])

def test_unknowns_have_bounds_and_are_never_reclassified_as_negative():
    rows,diaries=inputs();unknown=calculate(rows,[]);assert unknown['unknown_weight']==25
    assert unknown['days'][0]['score_max']-unknown['days'][0]['score_min']==25
    diaries[0]['sputum_change']=False;known=calculate(rows,diaries);assert known['status']=='available' and known['known_weight']==100
    assert known['score_min']==known['score_max']
    diaries[0]['sputum_change']='false';invalid=calculate(rows,diaries);assert invalid['unknown_weight']==7

def test_missing_core_data_or_stale_measurements_abstain_without_zero_scores():
    rows,_=inputs()
    for filtered in [[],[r for r in rows if r['channel']=='spo2_pct'],[r for r in rows if r['channel']!='spo2_pct'],rows[:3]]:
        p=calculate(filtered);assert p['status']=='unavailable' and p['score_min'] is None and p['score_max'] is None
        assert all(d['score_min'] is None and d['score_max'] is None for d in p['days'])
    stale=calculate(as_of='2025-01-06T12:00:01Z');assert stale['status']=='unavailable'
    boundary=calculate(as_of='2025-01-06T12:00:00Z');assert boundary['status']!='unavailable'

def test_future_measurements_delayed_availability_and_future_diaries_do_not_change_past():
    rows,diaries=inputs();expected=calculate(rows,diaries)
    future=deepcopy(rows[-1]);future.update(observation_id='future',measurement_end='2025-01-05T12:00:00Z',available_at='2025-01-05T12:00:00Z',value=40)
    delayed=deepcopy(rows[0]);delayed.update(observation_id='delayed',available_at='2025-01-05T12:00:00Z',value=50)
    diary=deepcopy(diaries[0]);diary.update(diary_id='future-diary',available_at='2025-01-05T12:00:00Z',dyspnea_worse_than_usual=False)
    assert calculate(rows+[future,delayed],diaries+[diary])==expected
    assert calculate(list(reversed(rows)),diaries)==expected

def test_contexts_devices_and_source_series_never_pool_or_choose_by_score():
    rows,diaries=inputs();added=[]
    for row in rows:
        r=deepcopy(row);r.update(observation_id='OTHER-'+r['observation_id'],source_series_id='OTHER-'+r['source_series_id'],context='unrecognized_context',device_id='other',value=60 if r['channel']=='spo2_pct' else 40);added.append(r)
    p=calculate(rows+added,diaries)
    assert len(p['streams'])==6 and sum(s['selected'] for s in p['streams'])==3
    assert p['days']==calculate(rows,diaries)['days']
    mixed=deepcopy(rows);mixed[0]['patient_id']='GER-001'
    with pytest.raises(ValueError,match='Mixed'):calculate(mixed,diaries)

def test_score_is_bounded_and_worsening_a_complete_symptom_does_not_reduce_score():
    rows,diaries=inputs();diaries[0].update(dyspnea_worse_than_usual=False,sputum_change=False)
    low=calculate(rows,diaries);diaries[0]['dyspnea_worse_than_usual']=True;high=calculate(rows,diaries)
    assert high['score_min']-low['score_min']==12
    for day in high['days']:assert 0<=day['score_min']<=day['score_max']<=100
    for row in rows:row['value']=96 if row['channel']=='spo2_pct' else 75 if row['channel']=='heart_rate_bpm' else 15
    diaries[0]['dyspnea_worse_than_usual']=False;stable=calculate(rows,diaries)
    assert stable['status']=='available' and stable['score_min']==stable['score_max']==0
    assert stable['probability_next_7_days'] is None  # Zero change points never become zero event risk.

@pytest.fixture(scope='module')
def client():
    app=create_app(db_path=':memory:',secret='outlook-only-tests',auto_import=False)
    rows,diaries=inputs();app.state.store.add_observations(rows);app.state.store.add_diaries(diaries)
    return TestClient(app)

def token(client,role='clinician'):
    body={'role':role}
    if role=='patient':body['patient_id']=PID
    r=client.post('/api/v1/auth/demo-session',json=body);assert r.status_code==200,r.text
    return {'Authorization':'Bearer '+r.json()['token']}

def test_api_auth_identity_clock_and_formula_parity(client):
    path=f'/api/v1/patients/{PID}/outlook7';params={'origin':ORIGIN,'as_of':ASOF}
    assert client.get(path,params=params).status_code==401
    headers=token(client);response=client.get(path,params=params,headers=headers)
    assert response.status_code==200,response.text
    assert response.json()==calculate()
    assert client.get(path,params={**params,'as_of':'2025-01-04'},headers=headers).status_code==422
    assert client.get(path,params={**params,'origin':'real_open'},headers=headers).status_code==404
    patient=token(client,'patient');assert client.get('/api/v1/patients/GER-001/outlook7',params={'origin':'real_open','as_of':ASOF},headers=patient).status_code==403

def test_original_risk_contract_is_not_overwritten(client):
    p=client.get(f'/api/v1/patients/{PID}/state',params={'origin':ORIGIN,'as_of':ASOF},headers=token(client)).json()
    assert p['risk']['probability_next_7_days'] is None and p['risk']['status']=='unavailable'

def test_altered_formula_configuration_refuses_to_run(tmp_path,monkeypatch):
    changed=tmp_path/'policy.json';changed.write_bytes(outlook7.POLICY_FILE.read_bytes()+b'\n')
    monkeypatch.setattr(outlook7,'POLICY_FILE',changed)
    with pytest.raises(outlook7.PolicyError,match='SHA-256'):calculate()
