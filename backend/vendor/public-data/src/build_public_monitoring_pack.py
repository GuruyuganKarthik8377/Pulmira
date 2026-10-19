"""Build an inspectable real-source monitoring supplement and public-source audit."""
from collections import Counter
import csv
import hashlib
import io
import json
from pathlib import Path
import re
import zipfile

import numpy as np
import pandas as pd

from public_monitoring_replay import RAW, FIELDS, PROJECT, read_rows, query

OUT = PROJECT / 'data/processed/public_now_v1'
REPORT = PROJECT / 'reports/public_now_v1'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    content = json.dumps(value, indent=2, allow_nan=False) + '\n'
    if path.exists() and path.read_text() != content:
        raise FileExistsError(f'Refusing to replace changed output: {path}')
    path.write_text(content)


def build():
    acquisition = json.loads((RAW / 'acquisition.json').read_text())
    for name, info in acquisition['acquired_files'].items():
        assert sha(RAW / name) == info['sha256'], name
    records = []
    summaries = []
    subject_tokens = []
    for i in range(1, 54):
        name = f'bidmc_csv/bidmc_{i:02d}_Numerics.csv'
        source = RAW / name
        rows = read_rows(source)
        header = (RAW / f'bidmc{i:02d}n.hea').read_text()
        token = re.search(r'matched/(s\d+)/', header).group(1)
        subject_tokens.append(token)
        records.append({'record_id': f'BIDMC-{i:02d}', 'source_subject_token': token,
                        'source_file': name, 'source_sha256': sha(source), 'rows': rows})
        summaries.append({'record_id': f'BIDMC-{i:02d}', 'raw_rows': len(rows),
                          'first_source_offset_seconds': rows[0]['elapsed_seconds'],
                          'last_source_offset_seconds': rows[-1]['elapsed_seconds'],
                          'negative_offset_rows': sum(r['elapsed_seconds'] < 0 for r in rows),
                          'channel_status_counts': {
                              channel: dict(Counter(r['status'][channel] for r in rows))
                              for channel, _, _ in FIELDS.values()}})
    envelope = {'schema_version': 'pulmira-public-relative-records-1.0.0',
                'data_origin': 'real_open', 'source_url': acquisition['source'],
                'license': acquisition['license'], 'copd_diagnosis_verified': False,
                'event_labels_available': False, 'calendar_time_known': False,
                'availability_time_known': False, 'records': records}
    write_json(OUT / 'bidmc_records.json', envelope)
    write_json(OUT / 'example_packet.json', query('BIDMC-01', 120))
    raw_rows = sum(x['raw_rows'] for x in summaries)
    counts = {channel: dict(sum((Counter(x['channel_status_counts'][channel]) for x in summaries), Counter()))
              for channel, _, _ in FIELDS.values()}
    bidmc_audit = {'recordings': len(records), 'unique_source_subject_tokens': len(set(subject_tokens)),
                   'raw_numeric_rows': raw_rows, 'raw_channel_cells': raw_rows * 4,
                   'status_counts': counts, 'published_checksums_verified': len(acquisition['acquired_files']),
                   'negative_offset_rows': sum(x['negative_offset_rows'] for x in summaries),
                   'negative_offset_policy': 'Preserve raw -1 second sample; explicitly exclude from 0..480 display without shifting clocks',
                   'calendar_and_receipt_timestamps_known': False,
                   'forecast_training_eligible': False, 'per_record': summaries}
    write_json(REPORT / 'bidmc_audit.json', bidmc_audit)

    ppg_root = PROJECT / 'data/raw/public_now_v1/copd_ppg_18109876'
    ppg_acquisition = json.loads((ppg_root / 'acquisition.json').read_text())
    archive = ppg_root / '128s_db.zip'
    assert sha(archive) == ppg_acquisition['sha256']
    with zipfile.ZipFile(archive) as z:
        items = [item for item in z.infolist() if not item.is_dir()]
        assert sum(item.file_size for item in items) <= 64_000_000
        inspected = []
        labels = Counter()
        for item in items:
            if not item.filename.endswith('.csv'):
                raise ValueError('Unexpected archive content; no executable/pickle data accepted')
            data = z.read(item.filename)
            frame = pd.read_csv(io.BytesIO(data), sep=';')
            assert frame.columns.tolist() == [str(i) for i in range(256)] + ['copd']
            signal = frame.drop(columns='copd').to_numpy(dtype=float)
            assert np.isfinite(signal).all()
            assert set(frame['copd'].unique()) <= {0, 1}
            label_counts = Counter(int(v) for v in frame['copd'])
            labels.update(label_counts)
            # Independent CSV parsing verifies rows/columns/class counts.
            independent = list(csv.reader(io.StringIO(data.decode()), delimiter=';'))
            assert len(independent) - 1 == len(frame)
            assert all(len(row) == 257 for row in independent)
            assert Counter(int(row[-1]) for row in independent[1:]) == label_counts
            inspected.append({'file': item.filename, 'rows': len(frame), 'signal_columns': signal.shape[1],
                              'labels': dict(label_counts), 'minimum': float(signal.min()),
                              'maximum': float(signal.max()), 'all_finite': True,
                              'uncompressed_bytes': item.file_size,
                              'sha256': hashlib.sha256(data).hexdigest()})
    ppg_audit = {'archive_subset': '128s_db.zip', 'source_files': len(inspected),
                 'segments': sum(x['rows'] for x in inspected), 'label_counts': dict(labels),
                 'independent_patient_count_verified': False,
                 'grouping_rule': 'Keep every source file together in any future exploratory split; cross-duration overlap unresolved',
                 'clinical_label_definition_verified': False,
                 'forecast_training_eligible': False, 'screening_training_performed': False,
                 'reason': 'COPD screening segments; no event-onset/follow-up labels or daily vital/exposure trajectories',
                 'files': inspected}
    write_json(REPORT / 'copd_ppg_audit.json', ppg_audit)
    result = {'bidmc': {k: v for k, v in bidmc_audit.items() if k != 'per_record'},
              'copd_ppg': {k: v for k, v in ppg_audit.items() if k != 'files'},
              'model_trained': False, 'accuracy_improvement_established': False,
              'outputs_sha256': {p.name: sha(p) for p in sorted(OUT.glob('*.json'))}}
    write_json(REPORT / 'build_summary.json', result)
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    build()
