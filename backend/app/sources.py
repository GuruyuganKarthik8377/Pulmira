"""BIDMC relative-clock recordings and imported fictional scenario traces.
Both stay out of the absolute-time patient engine: different clocks, different populations."""
import csv
import gzip
import hashlib
import json
import math
import re
import uuid
from pathlib import Path

from .store import iso_now, sha256_file  # sets up the vendored module path

from public_monitoring_replay import query as bidmc_query  # noqa: E402  verifies source checksum per call

TRACE_SCHEMA = 'pulmira-synthetic-scenario-trace-1.0.0'
TRACE_COLUMNS = ['scenario_id', 'scenario_version', 'parameter_version', 'synthetic_profile_id', 'day',
                 'simulated_date', 'channel', 'value', 'units', 'observed']
TRACE_REQUIRED = set(TRACE_COLUMNS) - {'simulated_date'}
NAME = re.compile(r'^[A-Za-z0-9_.:-]{1,80}$')


def recording_state(record_id, elapsed_seconds):
    return bidmc_query(record_id, elapsed_seconds)


def import_traces(store, path):
    """Whitelisted columns only: latent states, onset/event schedules and labels are rejected, not dropped."""
    path = Path(path)
    if path.name.endswith(('.csv', '.csv.gz')):
        with (gzip.open(path, 'rt', newline='') if path.suffix == '.gz' else path.open(newline='')) as f:
            reader = csv.DictReader(f)
            rows = list(reader)
            columns = reader.fieldnames or []
    else:
        rows = [json.loads(line) for line in path.read_text().splitlines() if line.strip()]
        columns = sorted({k for r in rows for k in r})
    extra = set(columns) - set(TRACE_COLUMNS)
    if extra:
        raise ValueError(f'Trace export has non-whitelisted columns (private state/outcomes are not observations): {sorted(extra)}')
    if TRACE_REQUIRED - set(columns):
        raise ValueError(f'Trace export missing columns: {sorted(TRACE_REQUIRED - set(columns))}')
    known = {r[0] for r in store.db.execute('SELECT scenario_id FROM scenarios')}
    real_ids = {r[0] for r in store.db.execute("SELECT patient_id FROM patients WHERE data_origin != 'synthetic'")}
    out = []
    for i, r in enumerate(rows, 1):
        if r['scenario_id'] not in known:
            raise ValueError(f'Row {i}: unknown scenario {r["scenario_id"]!r}')
        for k in ('scenario_version', 'parameter_version', 'synthetic_profile_id', 'channel', 'units'):
            if not isinstance(r[k], str) or not NAME.match(r[k]):
                raise ValueError(f'Row {i}: invalid {k}')
        if r['synthetic_profile_id'] in real_ids:
            raise ValueError(f'Row {i}: profile id collides with a real registry patient')
        observed = int(r['observed'])
        value = r['value']
        value = None if value in (None, '', 'null') else float(value)
        if observed not in (0, 1) or (value is not None and not math.isfinite(value)) or (not observed and value is not None):
            raise ValueError(f'Row {i}: observed must be 0/1 and unobserved rows must have a null value')
        out.append((r['scenario_id'], r['scenario_version'], r['parameter_version'], r['synthetic_profile_id'],
                    int(r['day']), r.get('simulated_date') or None, r['channel'], value, r['units'], observed))
    import_id = 'IMP-' + uuid.uuid4().hex[:12]
    with store.tx() as db:
        db.executemany('INSERT INTO scenario_traces VALUES (?,?,?,?,?,?,?,?,?,?,?)', [row + (import_id,) for row in out])
        db.execute('INSERT INTO dataset_imports VALUES (?,?,?,?,?,?,?,?,?,?)',
                   (import_id, 'synthetic_scenario_traces', None, 'project-internal',
                    'Fictional Pulmira simulator v2 trajectories; not real patients or clinical effects',
                    path.name, sha256_file(path), 'complete', len(out), iso_now()))
    return len(out)


# ---------- Member 2 simulator v2 export -> bounded trace sample ----------
# The v2 *_observations.csv.gz exports also carry labels, split and modelling gates. Only these columns are kept.
V2_KEEP = {'patient_id', 'scenario', 'date', 'day'}
V2_CHANNELS = {'spo2_pct': 'percent', 'heart_rate_bpm': 'bpm', 'respiratory_rate_per_min': 'breaths_per_min',
               'sleep_hours': 'hours', 'aqi_index': 'AQI_index', 'gait_speed_m_per_s': 'm_per_s',
               'reported_dyspnea_change': 'synthetic_report_score', 'reported_cough_change': 'synthetic_report_score',
               # Release timing of the simulated self-report: observable at runtime, not an outcome.
               'reported_symptom_collection_day': 'day_index', 'reported_symptom_age_days': 'days'}
V2_DROPPED = {'split', 'exacerbation_next_7_days', 'care_event_next_7_days', 'label_observed', 'episode_truth',
              'warmup', 'forecast_day', 'available_for_prediction', 'eligible_for_modeling', 'runtime_gate', 'data_origin'}


def convert_v2_traces(src_dir, provenance_path, out_path, n_profiles=25, log=print):
    """Same n profiles in every scenario, chosen by SHA-256 of the profile ID (never by outcome or coverage)."""
    from .store import SCENARIOS
    src_dir = Path(src_dir)
    prov = json.loads(Path(provenance_path).read_text())
    if prov.get('clinical_validation') is not False or prov.get('version') != 'synthetic_copd_v2':
        raise ValueError('Unexpected provenance file')
    files = {sid: src_dir / f'{sid}_observations.csv.gz' for sid, _, _ in SCENARIOS}
    for sid, f in files.items():  # integrity: every source matches Member 2's recorded output hash
        if sha256_file(f) != prov['output_sha256'][f.name]:
            raise ValueError(f'{f.name}: checksum differs from provenance')
    ids = None
    for sid, f in files.items():
        with gzip.open(f, 'rt', newline='') as h:
            reader = csv.DictReader(h)
            unknown = set(reader.fieldnames) - V2_KEEP - set(V2_CHANNELS) - V2_DROPPED
            if unknown:
                raise ValueError(f'{f.name}: unreviewed columns {sorted(unknown)}; refusing to guess')
            present = {row['patient_id'] for row in reader}
        ids = present if ids is None else ids & present
    chosen = sorted(ids, key=lambda i: hashlib.sha256(i.encode()).hexdigest())[:n_profiles]
    if len(chosen) < n_profiles:
        raise ValueError(f'Only {len(chosen)} profiles are shared by all scenarios')
    keep, rows = set(chosen), 0
    version, params = prov['version'], 'params-' + prov['package_sha256'][:12]
    with gzip.open(out_path, 'wt', newline='') as out:
        w = csv.writer(out)
        w.writerow(TRACE_COLUMNS)
        for sid, f in files.items():
            with gzip.open(f, 'rt', newline='') as h:
                for row in csv.DictReader(h):
                    if row['patient_id'] not in keep:
                        continue
                    if row['scenario'] != sid:
                        raise ValueError(f'{f.name}: row scenario {row["scenario"]!r} does not match file')
                    for ch, units in V2_CHANNELS.items():
                        v = row[ch]
                        if ch == 'reported_symptom_collection_day' and v == '-1':  # generator's "no release" sentinel
                            if row['reported_symptom_age_days'] or row['reported_dyspnea_change'] or row['reported_cough_change']:
                                raise ValueError(f'{f.name}: release sentinel with released report values')
                            v = ''
                        w.writerow([sid, version, params, row['patient_id'], row['day'], row['date'], ch,
                                    v if v != '' else '', units, 1 if v != '' else 0])
                        rows += 1
            log(f'{sid}: done')
    return {'profiles': chosen, 'rows': rows, 'scenario_version': version, 'parameter_version': params}
