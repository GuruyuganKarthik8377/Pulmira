"""Synthetic-only serving and exact parity with locked research predictions."""
import json,shutil
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from app.main import create_app
from app import forecast24

ROOT=Path(__file__).resolve().parents[1];API='/api/v1/research/forecast24'
@pytest.fixture(scope='module')
def client():return TestClient(create_app(db_path=':memory:',secret='forecast-only-tests',auto_import=False))
@pytest.fixture(scope='module')
def headers(client):
    r=client.post('/api/v1/auth/demo-session',json={'role':'clinician'})
    return {'Authorization':'Bearer '+r.json()['token']}

def test_catalogue_is_authenticated_and_explicitly_not_a_clinical_exacerbation_model(client,headers):
    assert client.get(API).status_code==401
    m=client.get(API,headers=headers).json()
    assert m['domain']=='synthetic_only' and m['clinical_validation'] is False
    assert m['horizon_days']==1 and m['outcome_is_copd_exacerbation'] is False and m['seven_day_prediction_available'] is False
    assert m['evaluation']['selected']['rows']==17442
    assert m['evaluation']['current_not_low_subset']['recall']<.14
    assert m['sparse_stress_evaluation']['runtime_coverage']<.02
    assert len(m['profiles'])==12

def test_every_runtime_fixture_matches_locked_research_prediction_without_future_rows(client,headers):
    expected=json.loads((ROOT/'tests/fixtures/forecast24_expectations.json').read_text())['predictions']
    for item in expected:
        p=client.get(API+f"/profiles/{item['profile_id']}",params={'day':item['day']},headers=headers).json()
        assert p['status']==item['status']
        if item['probability'] is None:assert p['probability_next_day_low_spo2'] is None
        else:assert abs(p['probability_next_day_low_spo2']-item['probability'])<1e-12
        assert p['day']==item['day'] and len(p['available_observations'])==item['day']+1
        assert max(o['day'] for o in p['available_observations'])==item['day']
        assert p['probability_next_7_days'] is None and p['clinical_validation'] is False
        assert not {'future_label','exacerbation_next_7_days','episode_truth','burden','future_event_date'}&set(p)

def test_warmup_missingness_unknown_profiles_and_real_origins_are_not_substituted(client,headers):
    profile=client.get(API,headers=headers).json()['profiles'][0]['profile_id']
    p=client.get(API+f'/profiles/{profile}?day=0',headers=headers).json()
    assert p['status']=='unavailable' and p['warning'] is None and p['probability_next_day_low_spo2'] is None
    assert '28_day_warmup_incomplete' in p['reasons']
    assert client.get(API+'/profiles/GER-002?day=90',headers=headers).status_code==404
    assert client.get(API+f'/profiles/{profile}?day=180',headers=headers).status_code==422
    assert client.get(API+f'/profiles/{profile}?day=90&origin=real_open',headers=headers).status_code==422

def test_changed_model_bytes_refuse_to_load(tmp_path,monkeypatch):
    for p in forecast24.DIRECTORY.iterdir():
        if p.is_file():shutil.copy2(p,tmp_path/p.name)
    with (tmp_path/'model.json').open('a') as f:f.write('\n')
    monkeypatch.setattr(forecast24,'DIRECTORY',tmp_path);monkeypatch.setattr(forecast24,'_loaded',None)
    with pytest.raises(RuntimeError,match='integrity'):forecast24.load()
