"""Pulmira backend: HTTP wrapper over the vendored monitoring-support engine.

Every patient response echoes patient_id / data_origin / as_of so the frontend can drop late responses
from a previous selection. Engine packets are returned unmodified; nulls are never replaced.
"""
import hashlib
import json
import os
import secrets
import sqlite3
import sys
import uuid
from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import Depends, FastAPI, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, ConfigDict, Field, StrictBool, StrictInt, StrictStr

from . import auth, features, simulator
from .sources import TRACE_SCHEMA, recording_state
from .store import (AIML_DIR, BIDMC, ENGINE_DIR, ENGINE_VERSIONS, REFERENCE_STATES_FILE, SYNTHETIC, SYNTHETIC_FILE,
                    SYNTHETIC_STATE_FILE, TOLIFE, TOLIFE_FILE, Conflict, Store, import_all, iso_now, now, sha256_file, ts,
                    utc)

API = '/api/v1'
ORIGINS = ('real_open', 'real_controlled', 'synthetic')
MAX_SNAPSHOTS = 400


class ApiError(Exception):
    def __init__(self, status, code, message, reasons=None):
        self.status, self.code, self.message, self.reasons = status, code, message, reasons or []


def err(status, code, message, reasons=None):
    return JSONResponse({'error': {'code': code, 'message': message, 'reasons': reasons or []}}, status_code=status)


# ---------- request bodies ----------
class Login(BaseModel):
    model_config = ConfigDict(extra='forbid')
    username: StrictStr
    password: StrictStr


class DemoSession(BaseModel):
    model_config = ConfigDict(extra='forbid')
    role: Literal['clinician', 'patient']
    patient_id: StrictStr | None = None


class ObservationIn(BaseModel):
    """Exact engine observation contract (config/observed_twin_api_v1.json). Nullable fields are still required."""
    model_config = ConfigDict(extra='forbid')
    observation_id: StrictStr
    patient_id: StrictStr
    channel: StrictStr
    value: float | None = Field(..., strict=False)
    units: StrictStr
    device_id: StrictStr | None
    source_series_id: StrictStr
    context: StrictStr
    measurement_start: StrictStr | None
    measurement_end: StrictStr
    available_at: StrictStr
    validity: StrictInt
    data_origin: Literal['real_open', 'real_controlled', 'synthetic']
    time_evidence: Literal['measured', 'custodian_verified_bound', 'assumed_source_clock', 'synthetic_generated']
    window_evidence: Literal['measured', 'custodian_verified_bound', 'assumed_source_clock', 'synthetic_generated']


class ObservationBatch(BaseModel):
    model_config = ConfigDict(extra='forbid')
    observations: list[ObservationIn] = Field(..., min_length=1, max_length=5000)


class DiaryIn(BaseModel):
    """Yes/No/Unsure = true/false/null; every answer must be sent explicitly. Receipt time, IDs, origin and
    reporter are assigned by the server and cannot be supplied."""
    model_config = ConfigDict(extra='forbid')
    dyspnea_worse_than_usual: StrictBool | None
    cough_worse_than_usual: StrictBool | None
    sputum_change: StrictBool | None
    collected_at: StrictStr
    reported_symptom_start_at: StrictStr | None = None
    client_request_id: StrictStr | None = Field(None, max_length=100)


class RunIn(BaseModel):
    model_config = ConfigDict(extra='forbid')
    profile_id: StrictStr = Field(..., max_length=80)


class AckIn(BaseModel):
    """The notice ID encodes rules version, origin, patient, decision time and kind."""
    model_config = ConfigDict(extra='forbid')
    action: Literal['acknowledged', 'reopened']
    note: StrictStr | None = Field(None, max_length=1000)


# ---------- helpers ----------
def parse_time(value, name):
    try:
        return utc(value)
    except (ValueError, TypeError):
        raise ApiError(422, 'validation_failed', f'{name} must be an ISO-8601 timestamp with an explicit timezone',
                       [f'{name}_timezone_required'])


def iso(dt):
    return dt.isoformat().replace('+00:00', 'Z')


def from_ts(value):
    return None if value is None else iso(datetime.fromtimestamp(value, timezone.utc))


def check_origin(origin):
    if origin not in ORIGINS:
        raise ApiError(422, 'validation_failed', f'origin must be one of {ORIGINS}', ['unknown_origin'])


def page(limit, offset):
    return min(max(limit, 1), 500), max(offset, 0)


SOURCES = {'real_open': [TOLIFE], 'synthetic': [SYNTHETIC], 'real_controlled': []}


def create_app(db_path=None, secret=None, demo_mode=None, auto_import=None, cors_origins=None):
    db_path = db_path or os.environ.get('PULMIRA_DB', 'data/pulmira.db')
    if db_path != ':memory:':
        os.makedirs(os.path.dirname(os.path.abspath(db_path)), exist_ok=True)
    secret = (secret or os.environ.get('PULMIRA_SECRET') or '').encode()
    if not secret:
        secret = secrets.token_bytes(32)
        print('PULMIRA_SECRET not set: using a random per-process secret; tokens reset on restart.', file=sys.stderr)
    demo_mode = os.environ.get('PULMIRA_DEMO_MODE', '1') == '1' if demo_mode is None else demo_mode
    auto_import = os.environ.get('PULMIRA_AUTO_IMPORT', '1') == '1' if auto_import is None else auto_import
    ttl = int(os.environ.get('PULMIRA_TOKEN_TTL_SECONDS', 8 * 3600))
    max_runs = int(os.environ.get('PULMIRA_MAX_SIMULATION_RUNS', 2000))
    cors = cors_origins if cors_origins is not None else [
        o.strip() for o in os.environ.get('PULMIRA_CORS_ORIGINS', 'http://localhost:5173,http://localhost:3000').split(',') if o.strip()]

    store = Store(db_path)
    if auto_import:
        import_all(store, log=lambda m: print('import ' + m, file=sys.stderr))
        try:
            simulator.backfill_runs(store, log=lambda m: print(m, file=sys.stderr))
        except Exception as exc:  # simulator unavailable: runs keep their stored channels
            print(f'simulator backfill skipped: {exc}', file=sys.stderr)

    app = FastAPI(title='Pulmira backend', version='1.0.0',
                  description='Observation-based COPD monitoring Twin (research prototype). Seven-day clinical '
                              'risk is unavailable; no endpoint estimates it.')
    app.state.store = store
    app.add_middleware(CORSMiddleware, allow_origins=cors, allow_methods=['GET', 'POST'],
                       allow_headers=['Authorization', 'Content-Type'])

    @app.middleware('http')
    async def revision_header(request: Request, call_next):
        response = await call_next(request)
        response.headers['X-Pulmira-Ledger-Revision'] = str(store.revision)
        return response

    @app.exception_handler(ApiError)
    async def _api(_, exc: ApiError):
        return err(exc.status, exc.code, exc.message, exc.reasons)

    @app.exception_handler(RequestValidationError)
    async def _validation(_, exc: RequestValidationError):
        reasons = [{'loc': list(e['loc']), 'msg': e['msg'], 'type': e['type']} for e in exc.errors()]
        return err(422, 'validation_failed', 'Request failed validation', reasons)

    @app.exception_handler(Conflict)
    async def _conflict(_, exc: Conflict):
        return err(409, 'conflict', 'Duplicate or conflicting record', [str(exc)])

    @app.exception_handler(ValueError)
    async def _value(_, exc: ValueError):
        return err(422, 'validation_failed', str(exc), [str(exc)])

    @app.exception_handler(Exception)
    async def _internal(_, exc: Exception):
        print(f'internal error: {exc!r}', file=sys.stderr)
        return err(500, 'internal_error', 'Internal server error')

    # ---------- auth ----------
    bearer = HTTPBearer(auto_error=False, description='Token from /auth/demo-session or /auth/login')

    def current(creds: HTTPAuthorizationCredentials | None = Depends(bearer)):
        claims = auth.verify(secret, creds.credentials) if creds else None
        if claims is None:
            raise ApiError(401, 'unauthorized', 'Missing, invalid or expired bearer token')
        return claims

    def clinician(claims=Depends(current)):
        if claims['role'] != 'clinician':
            raise ApiError(403, 'forbidden', 'Clinician role required')
        return claims

    def patient_row(claims, patient_id, origin):
        check_origin(origin)
        if not auth.can_read_patient(claims, patient_id, origin):
            raise ApiError(403, 'forbidden', 'This session cannot access that patient/origin')
        row = store.patient(patient_id, origin)
        if row is None:
            raise ApiError(404, 'unknown_patient', f'No registered patient {patient_id!r} with origin {origin!r}')
        return row

    def state_for(claims, patient_id, origin, as_of):
        row = patient_row(claims, patient_id, origin)
        return row, store.state(patient_id, iso(parse_time(as_of, 'as_of')), origin)

    def token_response(claims):
        token, body = auth.issue(secret, claims, ttl)
        return {'token': token, 'token_type': 'bearer', 'expires_at': from_ts(body['exp']), 'claims': body}

    @app.post(API + '/auth/login', tags=['auth'])
    def login(body: Login):
        row = store.db.execute('SELECT * FROM users WHERE username=?', (body.username,)).fetchone()
        if row is None or not auth.check_password(body.password, row['password_hash']):
            raise ApiError(401, 'unauthorized', 'Invalid username or password')
        claims = {'sub': row['username'], 'role': row['role'], 'demo': False}
        if row['role'] == 'clinician':
            claims |= {'read_origins': list(ORIGINS), 'ingest_origins': [row['data_origin']] if row['data_origin'] else []}
        elif row['role'] == 'patient':
            claims |= {'patient_id': row['patient_id'], 'data_origin': row['data_origin']}
        else:
            claims |= {'ingest_origins': [row['data_origin']]}
        return token_response(claims)

    @app.get(API + '/demo/identities', tags=['auth'])
    def demo_identities():
        if not demo_mode:
            raise ApiError(404, 'demo_disabled', 'Demo mode is disabled')
        rows = store.db.execute("SELECT patient_id FROM patients WHERE data_origin='synthetic' ORDER BY patient_id").fetchall()
        return {'demo_mode': True,
                'public_profiles':[{'patient_id':r[0],'data_origin':'real_open'} for r in store.db.execute("SELECT patient_id FROM patients WHERE data_origin='real_open' ORDER BY patient_id")],
                'clinician': {'role': 'clinician', 'read_origins': ['real_open', 'synthetic'], 'ingest_origins': ['synthetic']},
                'patients': [{'role': 'patient', 'patient_id': r[0], 'data_origin': 'synthetic', 'fictional': True} for r in rows],
                'note': 'Demo identities are fictional (patient) or read public research data (clinician). '
                        'Real patient check-in is not offered.'}

    @app.post(API + '/auth/demo-session', tags=['auth'])
    def demo_session(body: DemoSession):
        if not demo_mode:
            raise ApiError(404, 'demo_disabled', 'Demo mode is disabled')
        if body.role == 'clinician':
            return token_response({'sub': 'demo-clinician', 'role': 'clinician', 'demo': True,
                                   'read_origins': ['real_open', 'synthetic'], 'ingest_origins': ['synthetic']})
        if not body.patient_id or store.patient(body.patient_id, 'synthetic') is None:
            raise ApiError(422, 'validation_failed', 'Demo patient sessions require an existing synthetic patient_id',
                           ['demo_patient_must_be_synthetic'])
        return token_response({'sub': 'demo-patient:' + body.patient_id, 'role': 'patient', 'demo': True,
                               'patient_id': body.patient_id, 'data_origin': 'synthetic'})

    @app.get(API + '/auth/me', tags=['auth'])
    def me(claims=Depends(current)):
        return claims

    # ---------- service ----------
    @app.get(API + '/health', tags=['service'])
    def health():
        imports = [dict(r) for r in store.db.execute('SELECT * FROM dataset_imports ORDER BY imported_at')]
        return {'status': 'ok', 'api_version': 'v1', 'engine_versions': ENGINE_VERSIONS,
                'ledger_revision': store.revision, 'counts': store.counts(), 'imports': imports,
                'demo_mode': demo_mode, 'clinical_prediction_available': False, 'server_time': iso_now()}

    @app.get(API + '/datasets', tags=['service'])
    def datasets(claims=Depends(current)):
        return {'items': [dict(r) for r in store.db.execute('SELECT * FROM dataset_imports ORDER BY imported_at')],
                'sources': [TOLIFE, SYNTHETIC, BIDMC]}

    # ---------- patients ----------
    LIST_SQL = """
      SELECT p.patient_id, p.data_origin, p.source_dataset, p.source_site, p.registered_at,
             COUNT(o.observation_id) AS observation_count, MIN(o.measurement_end_ts) AS first_ts,
             MAX(o.measurement_end_ts) AS last_ts, MAX(o.available_at_ts) AS last_avail_ts,
             GROUP_CONCAT(DISTINCT o.channel) AS channels,
             (SELECT COUNT(*) FROM diaries d WHERE d.patient_id=p.patient_id AND d.data_origin=p.data_origin) AS diary_count,
             (SELECT as_of FROM reference_decisions r WHERE r.patient_id=p.patient_id AND r.data_origin=p.data_origin) AS reference_as_of
      FROM patients p LEFT JOIN observations o ON o.patient_id=p.patient_id AND o.data_origin=p.data_origin
      WHERE {where} GROUP BY p.patient_id, p.data_origin ORDER BY p.data_origin, p.patient_id"""

    def patient_item(r):
        return {'patient_id': r['patient_id'], 'data_origin': r['data_origin'], 'fictional': r['data_origin'] == 'synthetic',
                'source_dataset': r['source_dataset'], 'source_site': r['source_site'], 'demographics': None,
                'observation_count': r['observation_count'], 'diary_count': r['diary_count'],
                'channels': sorted((r['channels'] or '').split(',')) if r['channels'] else [],
                'first_measurement_end': from_ts(r['first_ts']), 'last_measurement_end': from_ts(r['last_ts']),
                'last_available_at': from_ts(r['last_avail_ts']),
                # Never "now": Member 2's saved final decision time, else when every stored record is visible.
                'suggested_as_of': r['reference_as_of'] or from_ts(r['last_avail_ts']),
                'suggested_as_of_source': 'aiml_saved_final_decision' if r['reference_as_of'] else (
                    'last_available_at' if r['last_avail_ts'] else None)}

    @app.get(API + '/patients', tags=['patients'])
    def list_patients(origin: str | None = None, q: str | None = None, limit: int = 50, offset: int = 0,
                      claims=Depends(current)):
        limit, offset = page(limit, offset)
        where, args = ['1=1'], []
        if origin:
            check_origin(origin)
            where.append('p.data_origin=?'); args.append(origin)
        if claims['role'] == 'patient':
            where.append('p.patient_id=? AND p.data_origin=?'); args += [claims['patient_id'], claims['data_origin']]
        elif claims['role'] == 'clinician':
            where.append('p.data_origin IN (%s)' % ','.join('?' * len(claims['read_origins']))); args += claims['read_origins']
        else:
            raise ApiError(403, 'forbidden', 'Ingest accounts cannot list patients')
        if q:
            where.append("p.patient_id LIKE ? ESCAPE '\\'")
            args.append('%' + q.replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_') + '%')
        rows = store.db.execute(LIST_SQL.format(where=' AND '.join(where)), args).fetchall()
        return {'items': [patient_item(r) for r in rows[offset:offset + limit]], 'total': len(rows),
                'limit': limit, 'offset': offset}

    @app.get(API + '/patients/{patient_id}', tags=['patients'])
    def get_patient(patient_id: str, origin: str, claims=Depends(current)):
        patient_row(claims, patient_id, origin)
        r = store.db.execute(LIST_SQL.format(where='p.patient_id=? AND p.data_origin=?'), (patient_id, origin)).fetchone()
        return patient_item(r)

    package_file = AIML_DIR / 'simulator/config/causal_simulator_parameters_v2.json'
    package_scenarios = ({x['name']: x for x in json.loads(package_file.read_text())['scenarios']}
                         if package_file.exists() else {})
    clock_note = ('Each participant is shown at their own final historical snapshot; these are not simultaneous '
                  'or live readings.')
    history_inputs = {rel: sha256_file(path) for rel, path in [
        ('data/processed/observed_twin_v1/source_observations.jsonl.gz', TOLIFE_FILE),
        ('data/processed/monitoring_support_v1/example_synthetic_input.json', SYNTHETIC_FILE),
        *[(rel, ENGINE_DIR / rel) for rel in ('src/observed_twin.py', 'src/pulmira_monitoring_support.py',
                                              'config/observed_twin_v1.json', 'config/pulmira_improvement_v1.json')]]}

    @app.get(API + '/archive', tags=['patients'],
             summary="Every readable patient's final historical snapshot (frontend archive shape)")
    def archive(claims=Depends(current)):
        if claims['role'] != 'clinician':
            raise ApiError(403, 'forbidden', 'Clinician role required')
        states = {'real_open': [], 'synthetic': []}
        for pid, origin, as_of in final_decisions(claims):
            states[origin].append(store.state(pid, as_of, origin))
        return {'schemaVersion': 'pulmira-frontend-archive-1.0.0', 'sourceLabel': TOLIFE['source'],
                'sourceUrl': TOLIFE['url'], 'license': TOLIFE['licence'], 'clockNote': clock_note,
                'sourceSha256': sha256_file(REFERENCE_STATES_FILE), 'syntheticSha256': sha256_file(SYNTHETIC_STATE_FILE),
                'sourceStates': states['real_open'], 'syntheticStates': states['synthetic'], 'server_connected': True}

    @app.get(API + '/patients/{patient_id}/history', tags=['patients'],
             summary='Observations and up to 20 sampled availability-time snapshots plus the final snapshot')
    def history(patient_id: str, origin: str, claims=Depends(current)):
        patient_row(claims, patient_id, origin)
        final = store.db.execute('SELECT as_of FROM reference_decisions WHERE patient_id=? AND data_origin=?',
                                 (patient_id, origin)).fetchone()
        if final is None:
            raise ApiError(404, 'no_final_snapshot', 'This patient has no saved final historical decision')
        final_as_of, final_ts = final[0], ts(final[0])
        rows = [json.loads(r[0]) for r in store.db.execute(
            'SELECT observation_json FROM observations WHERE patient_id=? AND data_origin=? AND measurement_end_ts<=? '
            'AND available_at_ts<=? ORDER BY measurement_end, available_at, observation_id',
            (patient_id, origin, final_ts, final_ts))]
        # Same rule as the frontend's original bundles: actual availability times, at most 20, plus the final one.
        decisions = sorted({r['available_at'] for r in rows}, key=utc)
        if len(decisions) > 20:
            decisions = [decisions[round(i * (len(decisions) - 1) / 19)] for i in range(20)]
        decisions = [t for t in decisions if utc(t) < utc(final_as_of)] + [final_as_of]
        return {'schemaVersion': 'pulmira-patient-history-1.0.0', 'patientId': patient_id, 'origin': origin,
                'finalAsOf': final_as_of, 'clockNote': clock_note,
                'samplingNote': 'Up to 20 sampled source availability times plus the final archive snapshot. '
                                'Spacing is irregular; this is not a continuous daily recording.',
                'provenance': history_inputs, 'observations': rows,
                'snapshots': [store.state(patient_id, t, origin) for t in decisions]}

    @app.get(API + '/patients/{patient_id}/state', tags=['patients'],
             summary='Unmodified pulmira-monitoring-support-2.0.0 packet at an explicit as_of')
    def get_state(patient_id: str, origin: str, as_of: str, claims=Depends(current)):
        return state_for(claims, patient_id, origin, as_of)[1]

    @app.get(API + '/patients/{patient_id}/outlook7', tags=['patients'],
             summary='Unvalidated formula-based seven-day change outlook; never an event probability')
    def get_outlook7(patient_id: str, origin: str, as_of: str, claims=Depends(current)):
        from .outlook7 import build_outlook, PolicyError
        patient_row(claims, patient_id, origin)
        decision=iso(parse_time(as_of, 'as_of'));cutoff=ts(decision)
        with store.lock:
            observations=[json.loads(r[0]) for r in store.db.execute(
                'SELECT observation_json FROM observations WHERE patient_id=? AND data_origin=? '
                'AND measurement_end_ts<=? AND available_at_ts<=?',(patient_id,origin,cutoff,cutoff))]
            diaries=[json.loads(r[0]) for r in store.db.execute(
                'SELECT diary_json FROM diaries WHERE patient_id=? AND data_origin=? '
                'AND collected_at_ts<=? AND available_at_ts<=?',(patient_id,origin,cutoff,cutoff))]
        try:
            return build_outlook(patient_id,origin,decision,observations,diaries)
        except (PolicyError,FileNotFoundError):
            raise ApiError(503,'outlook_policy_unavailable','The versioned seven-day formula package could not be verified')

    @app.get(API + '/patients/{patient_id}/observations', tags=['patients'])
    def get_observations(patient_id: str, origin: str, as_of: str, from_: str | None = Query(None, alias='from'),
                         to: str | None = None, channel: str | None = None, context: str | None = None,
                         limit: int = 200, offset: int = 0, claims=Depends(current)):
        patient_row(claims, patient_id, origin)
        decision = ts(parse_time(as_of, 'as_of'))
        limit, offset = page(limit, offset)
        # Visible only if both measured and available by as_of (late arrivals stay invisible).
        where = ['patient_id=?', 'data_origin=?', 'measurement_end_ts<=?', 'available_at_ts<=?']
        args = [patient_id, origin, decision, decision]
        if from_:
            where.append('measurement_end_ts>=?'); args.append(ts(parse_time(from_, 'from')))
        if to:
            where.append('measurement_end_ts<=?'); args.append(ts(parse_time(to, 'to')))
        if channel:
            where.append('channel=?'); args.append(channel)
        if context:
            where.append('context=?'); args.append(context)
        w = ' AND '.join(where)
        total = store.db.execute(f'SELECT COUNT(*) FROM observations WHERE {w}', args).fetchone()[0]
        rows = store.db.execute(f'SELECT observation_json, lineage_json, import_id, ingested_by, inserted_at FROM observations '
                                f'WHERE {w} ORDER BY measurement_end_ts, available_at_ts, observation_id LIMIT ? OFFSET ?',
                                args + [limit, offset]).fetchall()
        return {'patient_id': patient_id, 'data_origin': origin, 'as_of': iso(parse_time(as_of, 'as_of')),
                'total': total, 'limit': limit, 'offset': offset,
                'items': [{'observation': json.loads(r[0]), 'lineage': json.loads(r[1]) if r[1] else None,
                           'import_id': r[2], 'ingested_by': r[3], 'stored_at': r[4]} for r in rows],
                'note': 'Gaps are preserved: no interpolation or forward fill.'}

    @app.get(API + '/patients/{patient_id}/timeline', tags=['patients'],
             summary='Snapshots reconstructed independently at each decision time')
    def get_timeline(patient_id: str, origin: str, from_: str = Query(..., alias='from'), to: str = Query(...),
                     step_hours: float = 24, detail: Literal['compact', 'full'] = 'compact', claims=Depends(current)):
        patient_row(claims, patient_id, origin)
        start, end = parse_time(from_, 'from'), parse_time(to, 'to')
        if end < start or not 1 <= step_hours <= 24 * 31:
            raise ApiError(422, 'validation_failed', 'Require from <= to and 1 <= step_hours <= 744')
        count = int((end - start) / timedelta(hours=step_hours)) + 1
        if count > MAX_SNAPSHOTS:
            raise ApiError(422, 'range_too_large', f'{count} snapshots requested; max {MAX_SNAPSHOTS}')
        snaps = []
        for i in range(count):
            s = store.state(patient_id, iso(start + timedelta(hours=step_hours * i)), origin)
            snaps.append(s if detail == 'full' else features.snapshot(s))
        return {'patient_id': patient_id, 'data_origin': origin, 'from': iso(start), 'to': iso(end),
                'step_hours': step_hours, 'detail': detail, 'snapshots': snaps}

    @app.get(API + '/patients/{patient_id}/data-quality', tags=['patients'])
    def get_quality(patient_id: str, origin: str, as_of: str, claims=Depends(current)):
        return features.data_quality(state_for(claims, patient_id, origin, as_of)[1])

    @app.get(API + '/patients/{patient_id}/monitoring-summary', tags=['patients'],
             summary='Rule-based monitoring-change summary (research prototype; not a probability)')
    def get_summary(patient_id: str, origin: str, as_of: str, claims=Depends(current)):
        return features.monitoring_summary(state_for(claims, patient_id, origin, as_of)[1])

    @app.get(API + '/patients/{patient_id}/report', tags=['patients'])
    def get_report(patient_id: str, origin: str, as_of: str, format: Literal['json', 'pdf'] = 'json',
                   claims=Depends(current)):
        row, state = state_for(claims, patient_id, origin, as_of)
        rep = features.report(state, row, SOURCES[origin], iso_now())
        if format == 'json':
            return rep
        name = f"pulmira-report-{patient_id}-{origin}-{state['as_of'].replace(':', '')}.pdf"
        return Response(features.report_pdf(rep), media_type='application/pdf',
                        headers={'Content-Disposition': f'attachment; filename="{name}"',
                                 'X-Pulmira-State-Sha256': rep['state_sha256']})

    # ---------- diaries ----------
    @app.post(API + '/patients/{patient_id}/diaries', tags=['diaries'], status_code=201)
    def post_diary(patient_id: str, origin: str, body: DiaryIn, response: Response, claims=Depends(current)):
        check_origin(origin)
        if claims['role'] != 'patient' or claims['patient_id'] != patient_id or claims['data_origin'] != origin:
            raise ApiError(403, 'forbidden', 'Only the bound patient session can submit its own self-report')
        if store.patient(patient_id, origin) is None:
            raise ApiError(404, 'unknown_patient', 'Unknown patient')
        received = now()
        collected = parse_time(body.collected_at, 'collected_at')
        if body.reported_symptom_start_at is not None:
            parse_time(body.reported_symptom_start_at, 'reported_symptom_start_at')
        if body.client_request_id:
            key = f"{claims['sub']}|{patient_id}|{origin}|{body.client_request_id}"
            diary_id = f'DIARY-{origin}-' + hashlib.sha256(key.encode()).hexdigest()[:24]
        else:
            diary_id = f'DIARY-{origin}-' + uuid.uuid4().hex[:24]
        answers = body.model_dump(exclude={'client_request_id'})
        existing = store.db.execute('SELECT diary_json FROM diaries WHERE diary_id=?', (diary_id,)).fetchone()
        if existing:
            old = json.loads(existing[0])
            norm = lambda v: None if v is None else iso(utc(v))
            retry = answers | {k: norm(answers[k]) for k in ('collected_at', 'reported_symptom_start_at')}
            if any(old[k] != v for k, v in retry.items()):
                raise Conflict('client_request_id reused with different answers')
            response.status_code = 200
            return {'diary': old, 'idempotent_replay': True}
        diary = {'diary_id': diary_id, 'patient_id': patient_id, 'data_origin': origin, 'reporter': 'patient_self_report',
                 'available_at': iso(received), **answers}
        if collected > received:
            raise ApiError(422, 'validation_failed', 'collected_at cannot be after server receipt time',
                           ['collection_after_receipt'])
        store.add_diaries([diary], actor=claims['sub'], session_id=claims['sid'], receipt_clock='server_utc')
        stored = store.db.execute('SELECT diary_json FROM diaries WHERE diary_id=?', (diary_id,)).fetchone()
        return {'diary': json.loads(stored[0]), 'idempotent_replay': False, 'receipt_clock': 'server_utc',
                'interpretation': 'Direct self-report; not a clinician-verified exacerbation or validated instrument.'}

    @app.get(API + '/patients/{patient_id}/diaries', tags=['diaries'])
    def list_diaries(patient_id: str, origin: str, as_of: str, limit: int = 50, offset: int = 0, claims=Depends(current)):
        patient_row(claims, patient_id, origin)
        decision = ts(parse_time(as_of, 'as_of'))
        limit, offset = page(limit, offset)
        where = 'patient_id=? AND data_origin=? AND collected_at_ts<=? AND available_at_ts<=?'
        args = [patient_id, origin, decision, decision]
        total = store.db.execute(f'SELECT COUNT(*) FROM diaries WHERE {where}', args).fetchone()[0]
        rows = store.db.execute(f'SELECT diary_json, submitted_by, receipt_clock, inserted_at FROM diaries WHERE {where} '
                                'ORDER BY collected_at_ts DESC, diary_id LIMIT ? OFFSET ?', args + [limit, offset]).fetchall()
        return {'patient_id': patient_id, 'data_origin': origin, 'as_of': iso(parse_time(as_of, 'as_of')),
                'total': total, 'limit': limit, 'offset': offset,
                'items': [{'diary': json.loads(r[0]), 'submitted_by': r[1], 'receipt_clock': r[2], 'stored_at': r[3]}
                          for r in rows]}

    # ---------- observation ingestion ----------
    @app.post(API + '/observations', tags=['ingestion'], status_code=201)
    def post_observations(body: ObservationBatch, claims=Depends(current)):
        origins = {o.data_origin for o in body.observations}
        denied = [o for o in origins if not auth.can_ingest(claims, o)]
        if denied:
            raise ApiError(403, 'forbidden', f'This session cannot ingest origin(s) {sorted(denied)}')
        batch = [o.model_dump() for o in body.observations]
        inserted = store.add_observations(batch, actor=claims['sub'])
        return {'received': len(batch), 'inserted': inserted, 'idempotent_replays': len(batch) - inserted,
                'ledger_revision': store.revision}

    # ---------- notices ----------
    def ack_status(notice_ids):
        if not notice_ids:
            return {}
        rows = store.db.execute('SELECT * FROM notice_acknowledgements WHERE notice_id IN (%s) ORDER BY acted_at, rowid'
                                % ','.join('?' * len(notice_ids)), list(notice_ids)).fetchall()
        latest = {}
        for r in rows:
            latest[r['notice_id']] = dict(r)
        return latest

    def final_decisions(claims, origin=None, patient_id=None):
        """Each patient's saved final historical decision (Member 2's reference states); never "now"."""
        origins = [origin] if origin else [o for o in ('real_open', 'synthetic') if o in claims.get('read_origins', [])]
        q = ('SELECT patient_id, data_origin, as_of FROM reference_decisions WHERE data_origin IN (%s)'
             % ','.join('?' * len(origins)))
        args = list(origins)
        if patient_id:
            q += ' AND patient_id=?'
            args.append(patient_id)
        return store.db.execute(q + ' ORDER BY data_origin, patient_id', args).fetchall()

    @app.get(API + '/notices', tags=['notices'], summary='Review queue (pulmira-review-rules-1.0.0); not clinical alerts')
    def list_notices(origin: str | None = None, as_of: str | None = None, patient_id: str | None = None,
                     kind: str | None = None, status: Literal['open', 'acknowledged', 'all'] = 'all',
                     limit: int = 500, offset: int = 0, claims=Depends(clinician)):
        if origin:
            check_origin(origin)
            if origin not in claims['read_origins']:
                raise ApiError(403, 'forbidden', 'This session cannot read that origin')
        limit, offset = page(limit, offset)
        if as_of:  # one explicit decision time for every selected patient
            if not origin:
                raise ApiError(422, 'validation_failed', 'origin is required with an explicit as_of')
            decision = iso(parse_time(as_of, 'as_of'))
            ids = [patient_id] if patient_id else [r[0] for r in store.db.execute(
                'SELECT patient_id FROM patients WHERE data_origin=? ORDER BY patient_id', (origin,))]
            targets = [(pid, origin, decision) for pid in ids]
        else:      # default: each patient at their own final historical decision
            targets = [(r[0], r[1], r[2]) for r in final_decisions(claims, origin, patient_id)]
        items = []
        for pid, org, decision in targets:
            if store.patient(pid, org) is None:
                raise ApiError(404, 'unknown_patient', 'Unknown patient')
            items += features.notices(store.state(pid, decision, org))
        if kind:
            items = [n for n in items if n['kind'] == kind]
        acks = ack_status({n['id'] for n in items})
        for n in items:
            a = acks.get(n['id'])
            n['status'] = 'acknowledged' if a and a['action'] == 'acknowledged' else 'open'
            n['latest_acknowledgement'] = a
        if status != 'all':
            items = [n for n in items if n['status'] == status]
        return {'rule_version': features.NOTICE_RULES_VERSION, 'decision': as_of and iso(parse_time(as_of, 'as_of')) or 'final_per_patient',
                'profiles': len(targets), 'total': len(items), 'limit': limit, 'offset': offset,
                'items': items[offset:offset + limit], 'clinical_alert': False,
                'note': 'Historical data notices from declared rules; not clinical alerts and no medical priority.'}

    def parse_notice(notice_id):
        parts = notice_id.split('|')
        if len(parts) != 5 or parts[0] != features.NOTICE_RULES_VERSION:
            raise ApiError(404, 'unknown_notice', 'Unrecognised notice ID')
        _, origin, pid, as_of, _kind = parts
        return origin, pid, as_of

    @app.post(API + '/notices/{notice_id}/acknowledgements', tags=['notices'], status_code=201)
    def acknowledge(notice_id: str, body: AckIn, claims=Depends(clinician)):
        origin, pid, as_of = parse_notice(notice_id)
        patient_row(claims, pid, origin)
        state = store.state(pid, iso(parse_time(as_of, 'as_of')), origin)
        if notice_id not in {n['id'] for n in features.notices(state)}:
            raise ApiError(404, 'unknown_notice', 'Notice not present for that patient/origin/decision')
        record = {'ack_id': 'ACK-' + uuid.uuid4().hex[:16], 'notice_id': notice_id, 'patient_id': pid,
                  'data_origin': origin, 'rule_version': features.NOTICE_RULES_VERSION,
                  'action': body.action, 'note': body.note, 'actor': claims['sub'], 'acted_at': iso_now()}
        with store.tx() as db:
            db.execute('INSERT INTO notice_acknowledgements VALUES (:ack_id,:notice_id,:patient_id,:data_origin,'
                       ':rule_version,:action,:note,:actor,:acted_at)', record)
        return record

    @app.get(API + '/notices/{notice_id}/acknowledgements', tags=['notices'])
    def ack_history(notice_id: str, claims=Depends(clinician)):
        rows = store.db.execute('SELECT * FROM notice_acknowledgements WHERE notice_id=? ORDER BY acted_at, rowid',
                                (notice_id,)).fetchall()
        return {'notice_id': notice_id, 'items': [dict(r) for r in rows if r['data_origin'] in claims['read_origins']]}

    # ---------- BIDMC recordings (relative clock) ----------
    def recording_item(r):
        group = [x[0] for x in store.db.execute('SELECT record_id FROM recordings WHERE source_subject_token=? '
                                                'ORDER BY record_id', (r['source_subject_token'],))]
        return {'record_id': r['record_id'], 'dataset': r['dataset'], 'source_subject_token': r['source_subject_token'],
                'subject_group_record_ids': group, 'subject_group_size': len(group),
                'clock_type': r['clock_type'], 'elapsed_seconds_range': [0, r['duration_seconds']],
                'source_file': r['source_file'], 'source_sha256': r['source_sha256'],
                'patient_id': None, 'as_of': None, 'calendar_time_known': False, 'availability_time_known': False,
                'copd_diagnosis_established': False, 'attribution': BIDMC['attribution'], 'source_url': BIDMC['url'],
                'licence': BIDMC['licence']}

    @app.get(API + '/recordings', tags=['recordings'])
    def list_recordings(dataset: Literal['bidmc'] = 'bidmc', claims=Depends(current)):
        if claims['role'] != 'clinician':
            raise ApiError(403, 'forbidden', 'Clinician role required')
        rows = store.db.execute('SELECT * FROM recordings WHERE dataset=? ORDER BY record_id', (dataset,)).fetchall()
        return {'dataset': dataset, 'total': len(rows), 'items': [recording_item(r) for r in rows],
                'note': 'Public ICU recordings on a relative clock; not COPD patients and not part of the patient registry.'}

    def recording_row(record_id, claims):
        if claims['role'] != 'clinician':
            raise ApiError(403, 'forbidden', 'Clinician role required')
        row = store.db.execute('SELECT * FROM recordings WHERE record_id=?', (record_id,)).fetchone()
        if row is None:
            raise ApiError(404, 'unknown_recording', f'No recording {record_id!r}')
        return row

    @app.get(API + '/recordings/{record_id}', tags=['recordings'])
    def get_recording(record_id: str, claims=Depends(current)):
        return recording_item(recording_row(record_id, claims))

    @app.get(API + '/recordings/{record_id}/state', tags=['recordings'],
             summary='pulmira-public-relative-monitoring-1.0.0 packet at a relative offset')
    def get_recording_state(record_id: str, elapsed_seconds: float, claims=Depends(current)):
        recording_row(record_id, claims)
        if not 0 <= elapsed_seconds <= 480:
            raise ApiError(422, 'validation_failed', 'elapsed_seconds must be within 0..480', ['offset_out_of_range'])
        return recording_state(record_id, elapsed_seconds)

    # ---------- fictional scenarios ----------
    @app.get(API + '/demo/scenarios', tags=['scenarios'])
    def list_scenarios(claims=Depends(current)):
        rows = store.db.execute("""
            SELECT s.*, COUNT(DISTINCT t.synthetic_profile_id) AS profiles, GROUP_CONCAT(DISTINCT t.scenario_version) AS versions,
                   GROUP_CONCAT(DISTINCT t.parameter_version) AS parameter_versions, MIN(t.day) AS min_day, MAX(t.day) AS max_day
            FROM scenarios s LEFT JOIN scenario_traces t USING (scenario_id) GROUP BY s.scenario_id ORDER BY s.rowid""").fetchall()
        return {'data_origin': 'synthetic', 'fictional': True, 'clinical_validation': False, 'trace_schema': TRACE_SCHEMA, 'items': [{
            'scenario_id': r['scenario_id'], 'role': r['role'], 'purpose': r['purpose'],
            'parameter_package': r['parameter_package'], 'profiles_available': r['profiles'],
            'scenario_versions': (r['versions'] or '').split(',') if r['versions'] else [],
            'parameter_versions': (r['parameter_versions'] or '').split(',') if r['parameter_versions'] else [],
            'day_range': [r['min_day'], r['max_day']] if r['profiles'] else None,
            'status': 'traces_available' if r['profiles'] else 'trace_export_not_imported',
            'overrides': package_scenarios.get(r['scenario_id'], {}).get('overrides', {}),
            'interpretation': package_scenarios.get(r['scenario_id'], {}).get('interpretation', r['purpose']),
            'clinical_validation': False} for r in rows],
            'interpretation': 'Fictional engineering simulation. Parameters are assumptions, not clinical effects.'}

    def scenario_row(scenario_id):
        row = store.db.execute('SELECT * FROM scenarios WHERE scenario_id=?', (scenario_id,)).fetchone()
        if row is None:
            raise ApiError(404, 'unknown_scenario', f'No scenario {scenario_id!r}')
        return row

    @app.get(API + '/demo/scenarios/{scenario_id}/profiles', tags=['scenarios'])
    def list_profiles(scenario_id: str, limit: int = 100, offset: int = 0, claims=Depends(current)):
        scenario_row(scenario_id)
        limit, offset = page(limit, offset)
        rows = store.db.execute('SELECT synthetic_profile_id, scenario_version, parameter_version, MIN(day), MAX(day), '
                                'GROUP_CONCAT(DISTINCT channel) FROM scenario_traces WHERE scenario_id=? '
                                'GROUP BY synthetic_profile_id, scenario_version, parameter_version '
                                'ORDER BY synthetic_profile_id', (scenario_id,)).fetchall()
        return {'scenario_id': scenario_id, 'fictional': True, 'clinical_validation': False, 'total': len(rows), 'limit': limit, 'offset': offset,
                'items': [{'synthetic_profile_id': r[0], 'scenario_version': r[1], 'parameter_version': r[2],
                           'day_range': [r[3], r[4]], 'channels': sorted(r[5].split(','))} for r in rows[offset:offset + limit]]}

    @app.get(API + '/demo/scenarios/{scenario_id}/trace', tags=['scenarios'])
    def get_trace(scenario_id: str, profile_id: str, scenario_version: str | None = None, from_day: int = 0,
                  to_day: int = 400, channel: str | None = None, claims=Depends(current)):
        scenario = scenario_row(scenario_id)
        if to_day < from_day or to_day - from_day > 400:
            raise ApiError(422, 'range_too_large', 'Day window must be 0..400 days long')
        where = 'scenario_id=? AND synthetic_profile_id=? AND day BETWEEN ? AND ?'
        args = [scenario_id, profile_id, from_day, to_day]
        if scenario_version:
            where += ' AND scenario_version=?'; args.append(scenario_version)
        if channel:
            where += ' AND channel=?'; args.append(channel)
        rows = store.db.execute(f'SELECT * FROM scenario_traces WHERE {where} ORDER BY channel, day', args).fetchall()
        if not rows:
            raise ApiError(404, 'unknown_trace', 'No imported trace for that scenario/profile/window')
        versions = {(r['scenario_version'], r['parameter_version']) for r in rows}
        if len(versions) > 1:
            raise ApiError(422, 'ambiguous_version', 'Multiple scenario versions; pass scenario_version',
                           sorted(v[0] for v in versions))
        series = {}
        for r in rows:
            s = series.setdefault(r['channel'], {'channel': r['channel'], 'units': r['units'], 'points': []})
            s['points'].append({'day': r['day'], 'simulated_date': r['simulated_date'], 'value': r['value'],
                                'observed': bool(r['observed'])})
        sv, pv = versions.pop()
        return {'trace_schema': TRACE_SCHEMA, 'scenario_id': scenario_id, 'scenario_role': scenario['role'],
                'scenario_version': sv, 'parameter_version': pv, 'parameter_package': scenario['parameter_package'],
                'synthetic_profile_id': profile_id, 'data_origin': 'synthetic', 'fictional': True, 'clinical_validation': False,
                'from_day': from_day, 'to_day': to_day, 'series': list(series.values()),
                'risk': {'probability_next_7_days': None, 'status': 'unavailable', 'clinical_validation': False},
                'interpretation': 'Fictional simulated observations. Private latent states and future event schedules '
                                  'are not included. No real-patient effect is implied.'}

    def run_item(r):
        return {**dict(r), 'data_origin': 'synthetic', 'fictional': True, 'clinical_validation': False,
                'trace_url': f"{API}/demo/scenarios/{r['scenario_id']}/trace?profile_id={r['synthetic_profile_id']}"
                             f"&scenario_version={r['scenario_version']}",
                'private_state_returned': False, 'labels_returned': False}

    @app.get(API + '/demo/simulator', tags=['scenarios'], summary='Simulator availability and versions')
    def simulator_info(claims=Depends(current)):
        try:
            s = simulator.load()
        except Exception as exc:  # missing numpy/pandas or drifted files: report, do not guess
            return {'available': False, 'reason': str(exc), 'clinical_validation': False}
        runs = store.db.execute('SELECT COUNT(*) FROM simulation_runs').fetchone()[0]
        return {'available': True, 'scenario_version': s['scenario_version'], 'parameter_version': s['parameter_version'],
                'simulator_sha256': s['simulator_sha256'], 'profiles': len(s['by_id']),
                'package_sha256': json.loads(simulator.PROVENANCE.read_text())['package_sha256'],
                'generation_seed': s['package']['simulation_design']['generation_seed'],
                'simulation_start': s['package']['simulation_design']['simulation_start'],
                'forecast_calendar_days': s['package']['simulation_design']['forecast_calendar_days'],
                'runs_stored': runs, 'runs_capacity': max_runs, 'fictional': True, 'clinical_validation': False,
                'interpretation': "Member 2's frozen engineering simulator. Assumptions are not clinically validated; "
                                  'outputs are fictional observations only.'}

    @app.get(API + '/demo/simulator/profiles', tags=['scenarios'], summary='Fictional profiles a scenario can run')
    def simulator_profiles(scenario_id: str, q: str | None = None, limit: int = 100, offset: int = 0,
                           claims=Depends(current)):
        scenario_row(scenario_id)
        limit, offset = page(limit, offset)
        ids = [p for p in simulator.profile_ids(scenario_id) if not q or q.lower() in p.lower()]
        have = {r[0] for r in store.db.execute('SELECT DISTINCT synthetic_profile_id FROM scenario_traces WHERE scenario_id=?',
                                               (scenario_id,))}
        return {'scenario_id': scenario_id, 'fictional': True, 'clinical_validation': False, 'total': len(ids), 'limit': limit, 'offset': offset,
                'items': [{'synthetic_profile_id': p, 'trace_available': p in have} for p in ids[offset:offset + limit]]}

    @app.post(API + '/demo/scenarios/{scenario_id}/runs', tags=['scenarios'], status_code=201,
              summary='Simulate one fictional profile (observations only); cached if already available')
    def run_scenario(scenario_id: str, body: RunIn, response: Response, claims=Depends(clinician)):
        scenario_row(scenario_id)
        try:
            s = simulator.load()
        except Exception as exc:
            raise ApiError(503, 'simulator_unavailable', 'Simulator could not be loaded', [str(exc)])
        if not simulator.runnable(scenario_id, body.profile_id):
            raise ApiError(404, 'unknown_profile', 'That fictional profile is not part of this scenario',
                           ['default_scenario_runs_all_profiles', 'test_only_scenarios_run_test_profiles_only'])
        prior = store.db.execute('SELECT * FROM simulation_runs WHERE scenario_id=? AND scenario_version=? AND '
                                 'synthetic_profile_id=?', (scenario_id, s['scenario_version'], body.profile_id)).fetchone()
        if prior:
            response.status_code = 200
            return run_item(prior) | {'cached': True}
        if store.db.execute('SELECT 1 FROM scenario_traces WHERE scenario_id=? AND scenario_version=? AND '
                            'synthetic_profile_id=? LIMIT 1', (scenario_id, s['scenario_version'], body.profile_id)).fetchone():
            response.status_code = 200
            return {'run_id': None, 'scenario_id': scenario_id, 'synthetic_profile_id': body.profile_id,
                    'scenario_version': s['scenario_version'], 'parameter_version': s['parameter_version'],
                    'status': 'precomputed', 'cached': True, 'data_origin': 'synthetic', 'fictional': True, 'clinical_validation': False,
                    'trace_url': f"{API}/demo/scenarios/{scenario_id}/trace?profile_id={body.profile_id}"
                                 f"&scenario_version={s['scenario_version']}"}
        if store.db.execute('SELECT COUNT(*) FROM simulation_runs').fetchone()[0] >= max_runs:
            raise ApiError(429, 'capacity_reached', f'Stored simulation runs reached {max_runs}',
                           ['raise_PULMIRA_MAX_SIMULATION_RUNS'])
        rows = simulator.run(scenario_id, body.profile_id)
        record = {'run_id': 'RUN-' + uuid.uuid4().hex[:16], 'scenario_id': scenario_id,
                  'scenario_version': s['scenario_version'], 'parameter_version': s['parameter_version'],
                  'synthetic_profile_id': body.profile_id, 'simulator_sha256': s['simulator_sha256'],
                  'status': 'completed', 'trace_rows': len(rows), 'requested_by': claims['sub'], 'requested_at': iso_now()}
        try:
            with store.tx() as db:
                db.executemany('INSERT INTO scenario_traces VALUES (?,?,?,?,?,?,?,?,?,?,?)',
                               [row + (record['run_id'],) for row in rows])
                db.execute('INSERT INTO simulation_runs VALUES (:run_id,:scenario_id,:scenario_version,:parameter_version,'
                           ':synthetic_profile_id,:simulator_sha256,:status,:trace_rows,:requested_by,:requested_at)', record)
        except sqlite3.IntegrityError:  # a concurrent identical request won; return its result
            prior = store.db.execute('SELECT * FROM simulation_runs WHERE scenario_id=? AND scenario_version=? AND '
                                     'synthetic_profile_id=?', (scenario_id, s['scenario_version'], body.profile_id)).fetchone()
            response.status_code = 200
            return run_item(prior) | {'cached': True}
        return run_item(record) | {'cached': False}

    @app.get(API + '/demo/runs', tags=['scenarios'])
    def list_runs(scenario_id: str | None = None, limit: int = 50, offset: int = 0, claims=Depends(current)):
        limit, offset = page(limit, offset)
        where, args = ('WHERE scenario_id=?', [scenario_id]) if scenario_id else ('', [])
        total = store.db.execute(f'SELECT COUNT(*) FROM simulation_runs {where}', args).fetchone()[0]
        rows = store.db.execute(f'SELECT * FROM simulation_runs {where} ORDER BY requested_at DESC LIMIT ? OFFSET ?',
                                args + [limit, offset]).fetchall()
        return {'total': total, 'limit': limit, 'offset': offset, 'items': [run_item(r) for r in rows]}

    @app.get(API + '/demo/runs/{run_id}', tags=['scenarios'])
    def get_run(run_id: str, claims=Depends(current)):
        row = store.db.execute('SELECT * FROM simulation_runs WHERE run_id=?', (run_id,)).fetchone()
        if row is None:
            raise ApiError(404, 'unknown_run', f'No run {run_id!r}')
        return run_item(row)

    # Frozen UI artifacts are served through the same authorized API; no static fallback.
    from pathlib import Path
    frontend_dir = AIML_DIR.parent / 'frontend'
    @app.get(API + '/frontend/archive', tags=['frontend'])
    def frontend_archive(claims=Depends(current)):
        if claims['role']=='clinician':
            return archive(claims)
        if claims['role']!='patient':
            raise ApiError(403, 'forbidden', 'A reader session is required')
        own = history(claims['patient_id'], claims['data_origin'], claims)
        return {'schemaVersion':'pulmira-frontend-archive-1.0.0', 'sourceLabel':TOLIFE['source'],
                'sourceUrl':TOLIFE['url'], 'license':TOLIFE['licence'], 'clockNote':clock_note,
                'sourceSha256':sha256_file(REFERENCE_STATES_FILE), 'syntheticSha256':sha256_file(SYNTHETIC_STATE_FILE),
                'sourceStates':[], 'syntheticStates':[own['snapshots'][-1]], 'server_connected':True}

    @app.get(API + '/frontend/evidence', tags=['frontend'])
    def frontend_evidence(claims=Depends(current)):
        return json.loads((frontend_dir / 'project-evidence.json').read_text())

    @app.get(API + '/frontend/simulator/manifest', tags=['frontend'])
    def frontend_manifest(claims=Depends(current)):
        return json.loads((frontend_dir / 'simulator/manifest.json').read_text())

    @app.get(API + '/frontend/simulator/traces/{profile}/{scenario}', tags=['frontend'])
    def frontend_trace(profile: str, scenario: str, claims=Depends(current)):
        manifest = frontend_manifest(claims)
        entry = next((t for t in manifest['traces'] if t['profile']==profile and t['scenario']==scenario), None)
        if entry is None:
            raise ApiError(404, 'unknown_trace', 'This frozen comparison is not in the verified catalogue')
        payload = (frontend_dir / 'simulator' / entry['file']).read_bytes()
        if hashlib.sha256(payload).hexdigest()!=entry['sha256']:
            raise ApiError(503, 'integrity_failed', 'The frozen comparison failed its SHA-256 check')
        return Response(payload, media_type='application/json')

    # Separate synthetic-only forecasting study; no real-patient inputs are accepted.
    from . import forecast24
    @app.get(API + '/research/forecast24', tags=['research'])
    def forecast24_catalogue(claims=Depends(current)):
        try:
            return forecast24.catalogue()
        except Exception as exc:
            raise ApiError(503, 'forecast_unavailable', 'The experimental forecast package could not be verified', [str(exc)])

    @app.get(API + '/research/forecast24/profiles/{profile_id}', tags=['research'])
    def forecast24_prediction(profile_id: str, day: int = Query(90, ge=0, le=179), origin: Literal['synthetic_forecast24']='synthetic_forecast24', claims=Depends(current)):
        try:
            return forecast24.predict(profile_id, day)
        except forecast24.UnknownProfile:
            raise ApiError(404, 'unknown_forecast_profile', 'Only this experiment’s fictional profiles are accepted')
        except Exception as exc:
            raise ApiError(503, 'forecast_unavailable', 'The experimental forecast failed its integrity checks', [str(exc)])

    # Same-origin production hosting after all API routes. Deep links retain SPA navigation.
    static_root = Path(os.environ.get('PULMIRA_FRONTEND_DIST', str(Path(__file__).resolve().parents[2] / 'frontend/dist'))).resolve()
    if static_root.is_dir():
        from fastapi.responses import FileResponse
        @app.get('/{path:path}', include_in_schema=False)
        def frontend_page(path: str):
            if path=='api' or path.startswith('api/'):
                return err(404, 'not_found', 'Unknown API route')
            requested = (static_root / path).resolve()
            if not requested.is_relative_to(static_root):
                raise ApiError(404, 'not_found', 'File not found')
            if requested.is_file():
                return FileResponse(requested)
            if path.startswith(('assets/','data/')) or Path(path).suffix:
                raise ApiError(404, 'not_found', 'File not found')
            return FileResponse(static_root / 'index.html', headers={'Cache-Control':'no-cache'})

    return app

