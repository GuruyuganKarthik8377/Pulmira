"""On-demand single-profile runs of Member 2's frozen simulator v2 (vendor/aiml/simulator, unmodified).

Each profile has its own keyed random streams, so one profile simulated alone equals the same profile in
Member 2's full export (tested). Only observed channels leave this module: latent state, events, labels,
eligibility gates and the split are computed by the simulator but discarded here.
ponytail: runs are synchronous (~20 ms per profile) under one lock; add a job queue only if runs get heavy.
"""
import hashlib
import json
import sys
import threading
from pathlib import Path

from .sources import V2_CHANNELS
from .store import AIML_DIR

SIM_DIR = AIML_DIR / 'simulator'
PROVENANCE = AIML_DIR / 'synthetic_copd_v2_provenance.json'
_lock = threading.Lock()
_state = {}


def _sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def load():
    """Lazy: numpy/pandas and the 8,421 profiles load on first use. Refuses drifted code or parameters."""
    with _lock:
        if _state:
            return _state
        prov = json.loads(PROVENANCE.read_text())
        for rel, digest in prov['sources_sha256'].items():
            if _sha(SIM_DIR / rel) != digest:
                raise RuntimeError(f'Simulator file {rel} differs from the version that produced the exports')
        if str(SIM_DIR / 'src') not in sys.path:
            sys.path.insert(0, str(SIM_DIR / 'src'))
        import numpy as np
        import pandas as pd
        import simulate_copd_v2 as sim
        from verify_simulator_parameters_v2 import apply_scenario, parameters, validate_package
        package = json.loads(sim.PACKAGE.read_text())
        validate_package(package, json.loads((SIM_DIR / 'config/causal_simulator_spec_v2.json').read_text()))
        runtime = prov['runtime']
        if (np.__version__, pd.__version__) != (runtime['numpy'], runtime['pandas']):
            raise RuntimeError(f"Need numpy {runtime['numpy']} / pandas {runtime['pandas']} for exact reproduction")
        profiles = sim.load_profiles(package)  # also checks the profile file hash
        _state.update(np=np, pd=pd, sim=sim, package=package, profiles=profiles,
                      by_id={pid: i for i, pid in enumerate(profiles.patient_id)},
                      split=dict(zip(profiles.patient_id, profiles.split)),
                      scenarios={s['name']: s for s in package['scenarios']},
                      params=parameters(package), apply=apply_scenario,
                      scenario_version=prov['version'], parameter_version='params-' + prov['package_sha256'][:12],
                      simulator_sha256=prov['sources_sha256']['src/simulate_copd_v2.py'])
        return _state


def runnable(scenario_id, profile_id):
    """Member 2's design: the default runs every profile; test-only variants run test-split profiles only."""
    s = load()
    if scenario_id not in s['scenarios'] or profile_id not in s['by_id']:
        return False
    return s['scenarios'][scenario_id]['role'] == 'default' or s['split'][profile_id] == 'test'


def profile_ids(scenario_id):
    s = load()
    return [p for p in s['profiles'].patient_id if runnable(scenario_id, p)]


def run(scenario_id, profile_id):
    """Rows in the trace format (pulmira-synthetic-scenario-trace-1.0.0); observed channels only."""
    s = load()
    if not runnable(scenario_id, profile_id):
        raise ValueError('Profile is not part of that scenario')
    sim, np, pd, package = s['sim'], s['np'], s['pd'], s['package']
    v = s['apply'](s['params'], s['scenarios'][scenario_id])
    days = package['simulation_design']['forecast_calendar_days'] + v['label_maturation_cap']['additional_label_followup_days']
    p = s['profiles'].iloc[[s['by_id'][profile_id]]].reset_index(drop=True)
    with _lock:
        latent, _events, bases, iu, iz = sim.latent_process(p, package, v, days, scenario_id, private=False)
        x, age, release = sim.observe(p, package, v, latent, bases, iu, iz, days)
    del latent, _events  # private state and the future event register never leave this function
    dates = pd.date_range(package['simulation_design']['simulation_start'], periods=days).strftime('%Y-%m-%d')
    rows = []
    for d in range(days):
        released = int(release[0, d])
        values = [float(x[0, d, j]) for j in range(len(sim.SIGNALS))] + [
            float('nan') if released < 0 else float(released), float(age[0, d])]
        for ch, value in zip([*sim.SIGNALS, 'reported_symptom_collection_day', 'reported_symptom_age_days'], values):
            observed = not np.isnan(value)
            rows.append((scenario_id, s['scenario_version'], s['parameter_version'], profile_id, d, dates[d], ch,
                         value if observed else None, V2_CHANNELS[ch], int(observed)))
    return rows


def backfill_runs(store, log=print):
    """Stored runs made before a channel was added get the missing channels (deterministic recomputation)."""
    expected = len(V2_CHANNELS)
    stale = store.db.execute('SELECT r.run_id, r.scenario_id, r.synthetic_profile_id FROM simulation_runs r '
                             'WHERE (SELECT COUNT(DISTINCT channel) FROM scenario_traces t WHERE t.import_id=r.run_id) < ?',
                             (expected,)).fetchall()
    for run_id, scenario_id, profile_id in stale:
        rows = run(scenario_id, profile_id)
        with store.tx() as db:
            db.executemany('INSERT OR IGNORE INTO scenario_traces VALUES (?,?,?,?,?,?,?,?,?,?,?)',
                           [row + (run_id,) for row in rows])
            db.execute('UPDATE simulation_runs SET trace_rows=? WHERE run_id=?', (len(rows), run_id))
    if stale:
        log(f'simulator runs upgraded: {len(stale)}')
