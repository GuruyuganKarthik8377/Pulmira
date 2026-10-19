"""Local enhanced Twin query with optional direct symptom intake."""
import argparse
import gzip
import json
from pathlib import Path

from observed_twin import PROJECT
from pulmira_monitoring_support import MonitoringSupport


def query(path, patient_id, as_of, origin, diaries_path=None):
    path = Path(path)
    if path.suffix == '.gz':
        with gzip.open(path, 'rt') as handle: payload = [json.loads(line) for line in handle]
    else: payload = json.loads(path.read_text())
    diaries = []
    if isinstance(payload, dict):
        if set(payload) != {'observations', 'diaries'}: raise ValueError('Expected observations/diaries intake object')
        observations = payload['observations']; diaries = payload['diaries']
    else: observations = [r['observation'] if 'observation' in r else r for r in payload]
    if diaries_path is not None: diaries += json.loads(Path(diaries_path).read_text())
    engine = MonitoringSupport(); engine.ingest_many(observations); engine.ingest_diaries(diaries)
    return engine.state(patient_id, as_of, origin)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', type=Path, default=PROJECT / 'data/processed/observed_twin_v1/source_observations.jsonl.gz')
    parser.add_argument('--diaries', type=Path)
    parser.add_argument('--patient-id', required=True); parser.add_argument('--as-of', required=True)
    parser.add_argument('--origin', required=True, choices=['real_open', 'real_controlled', 'synthetic'])
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    text = json.dumps(query(args.input, args.patient_id, args.as_of, args.origin, args.diaries), indent=2, allow_nan=False) + '\n'
    if args.output:
        with args.output.open('x') as handle: handle.write(text)
    else: print(text, end='')
