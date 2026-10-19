"""Runnable fictional-only public distribution. No source patient records required."""
import hashlib,json
from datetime import datetime,timezone
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from app.main import create_app
ROOT=Path(__file__).resolve().parents[1]
PID='DEMO-SYNTHETIC-002'
@pytest.fixture(scope='module')
def service(tmp_path_factory):
 return TestClient(create_app(db_path=str(tmp_path_factory.mktemp('public')/'demo.db'),secret='public-distribution-test-only',demo_mode=True))
def grant(c,role='clinician'):
 b={'role':role}
 if role=='patient':b['patient_id']=PID
 r=c.post('/api/v1/auth/demo-session',json=b);assert r.status_code==200
 return {'Authorization':'Bearer '+r.json()['token']}
def test_default_import_contains_no_real_people_and_archive_hashes_are_current(service):
 h=grant(service);db=service.app.state.store.db
 assert db.execute("SELECT COUNT(*) FROM patients WHERE data_origin!='synthetic'").fetchone()[0]==0
 assert db.execute('SELECT COUNT(*) FROM recordings').fetchone()[0]==0
 assert service.get('/api/v1/demo/identities').json()['public_profiles']==[]
 a=service.get('/api/v1/frontend/archive',headers=h).json();assert a['sourceStates']==[]
 assert [x['patient_id'] for x in a['syntheticStates']]==[PID]
 assert a['sourceSha256']==hashlib.sha256((ROOT/'vendor/aiml/latest_patient_states.json').read_bytes()).hexdigest()
 assert service.get('/api/v1/recordings',headers=h).json()['total']==0

def test_history_and_seven_day_formula_share_exact_fictional_identity(service):
 h=grant(service);history=service.get(f'/api/v1/patients/{PID}/history?origin=synthetic',headers=h).json()
 assert history['patientId']==PID and len(history['observations'])==87
 t=history['finalAsOf'];o=service.get(f'/api/v1/patients/{PID}/outlook7',params={'origin':'synthetic','as_of':t},headers=h).json()
 assert o['status']=='partial' and len(o['days'])==7
 assert o['clinical_validation'] is False and o['probability_next_7_days'] is None
 assert o['score_min']==pytest.approx(21.8) and o['score_max']==pytest.approx(28.8)
 assert service.get(f'/api/v1/patients/{PID}/history?origin=synthetic').status_code==401

def test_patient_session_cannot_cross_role_or_identity(service):
 h=grant(service,'patient')
 a=service.get('/api/v1/frontend/archive',headers=h).json();assert a['sourceStates']==[]
 assert service.get('/api/v1/notices',headers=h).status_code==403
 assert service.get('/api/v1/patients/OTHER/history?origin=synthetic',headers=h).status_code==403
 assert service.get('/api/v1/archive',headers=h).status_code==403
 assert service.post('/api/v1/demo/scenarios/source_reference/runs',json={'profile_id':'SIM-V2-KG-P0000007'},headers=h).status_code==403

def test_every_frozen_trace_retains_original_byte_hash_and_only_observations(service):
 h=grant(service);m=service.get('/api/v1/frontend/simulator/manifest',headers=h).json()
 assert len(m['traces'])==32
 for e in m['traces']:
  response=service.get(f"/api/v1/frontend/simulator/traces/{e['profile']}/{e['scenario']}",headers=h)
  assert response.status_code==200 and hashlib.sha256(response.content).hexdigest()==e['sha256']
  assert all('episode_truth' not in row and 'exacerbation_next_7_days' not in row for row in response.json()['rows'])

def test_live_simulator_reproduces_frozen_observations(service):
 h=grant(service);profile='SIM-V2-KG-P0000007'
 for scenario in ['source_reference','denser_assumed_monitoring']:
  response=service.post(f'/api/v1/demo/scenarios/{scenario}/runs',json={'profile_id':profile},headers=h)
  assert response.status_code in (200,201),response.text
  trace=service.get(f'/api/v1/demo/scenarios/{scenario}/trace',params={'profile_id':profile,'scenario_version':'synthetic_copd_v2','from_day':0,'to_day':179},headers=h).json()
  frozen=json.loads((ROOT/f'vendor/frontend/simulator/{profile}--{scenario}.json').read_text())
  for series in trace['series']:
   for point in series['points']:assert point['value']==frozen['rows'][point['day']][series['channel']]

def test_live_simulator_drift_refuses_execution(monkeypatch,tmp_path):
 from app import simulator
 old=simulator._state
 monkeypatch.setattr(simulator,'_state',{})
 prov=json.loads(simulator.PROVENANCE.read_text());prov['sources_sha256']['src/simulate_copd_v2.py']='0'*64
 path=tmp_path/'provenance.json';path.write_text(json.dumps(prov));monkeypatch.setattr(simulator,'PROVENANCE',path)
 with pytest.raises(RuntimeError,match='differs'):simulator.load()

def test_current_checkin_persists_but_does_not_rewrite_archived_outlook(service):
 h=grant(service,'patient');at=datetime.now(timezone.utc).isoformat()
 body={'dyspnea_worse_than_usual':True,'cough_worse_than_usual':False,'sputum_change':None,'collected_at':at,'client_request_id':'public-fixture-checkin'}
 path=f'/api/v1/patients/{PID}/diaries?origin=synthetic'
 response=service.post(path,json=body,headers=h)
 assert response.status_code in (200,201),response.text
 assert response.json()['diary']['sputum_change'] is None
 # Same submitted request is idempotent, not a duplicate new diary.
 again=service.post(path,json=body,headers=h);assert again.status_code in (200,201),again.text
 assert again.json()['idempotent_replay'] is True
 archived=service.get(f'/api/v1/patients/{PID}/outlook7',params={'origin':'synthetic','as_of':'2025-03-01T13:00:00Z'},headers=h).json()
 assert archived['score_min']==pytest.approx(21.8)

def test_spa_deep_links_and_missing_resources(tmp_path,monkeypatch):
 dist=tmp_path/'dist';dist.mkdir();(dist/'index.html').write_text('<html>Pulmira public demo</html>')
 monkeypatch.setenv('PULMIRA_FRONTEND_DIST',str(dist))
 c=TestClient(create_app(db_path=':memory:',secret='test-only',auto_import=False))
 assert c.get('/app/outlook').status_code==200
 assert c.get('/patient/check-in').status_code==200
 assert c.get('/api/v1/does-not-exist').status_code==404
 assert c.get('/assets/missing.js').status_code==404
