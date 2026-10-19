"""Independently compare every prepared numeric value with a pandas source parse."""
import hashlib
import json
from pathlib import Path

import pandas as pd

from public_monitoring_replay import PROJECT, RAW, FIELDS, query


def verify():
    out = PROJECT / 'data/processed/public_now_v1'
    report = PROJECT / 'reports/public_now_v1'
    prepared = json.loads((out / 'bidmc_records.json').read_text())
    cells = 0
    historical_checks = 0
    for recording in prepared['records']:
        source = pd.read_csv(RAW / recording['source_file'], skipinitialspace=True)
        assert len(source) == len(recording['rows'])
        for index, row in enumerate(recording['rows']):
            assert row['source_row'] == index + 2
            assert row['elapsed_seconds'] == float(source.iloc[index]['Time [s]'])
            for column, (channel, _, _) in FIELDS.items():
                value = source.iloc[index][column]
                expected = None if pd.isna(value) or value < 0 or (column == 'SpO2' and value > 100) else float(value)
                assert row['values'][channel] == expected, (recording['record_id'], index, channel)
                cells += 1
        # Complete history checked at final cutoff; several intermediate cutoffs test isolation.
        for cutoff in [0, 0.5, 59.5, 60, 120, 239.5, 240, 479, 480]:
            packet = query(recording['record_id'], cutoff)
            selected = source[(source['Time [s]'] >= 0) & (source['Time [s]'] <= cutoff)]
            assert packet['risk']['probability_next_7_days'] is None
            assert packet['as_of'] is None and not packet['clinical_decision_replay']
            for channel in packet['channels']:
                assert len(channel['history']) == len(selected)
                for item, (_, original) in zip(channel['history'], selected.iterrows()):
                    assert item['elapsed_seconds'] == float(original['Time [s]'])
                    value = original[channel['source_column']]
                    expected = None if pd.isna(value) or value < 0 or (channel['channel'] == 'spo2_pct' and value > 100) else float(value)
                    assert item['value'] == expected
                if len(selected):
                    assert channel['measurement_elapsed_seconds'] == float(selected.iloc[-1]['Time [s]'])
                    assert channel['value'] == channel['history'][-1]['value']
                assert channel['available_at'] is None and channel['baseline'] is None
            historical_checks += 1
    summary = json.loads((report / 'build_summary.json').read_text())
    for name, digest in summary['outputs_sha256'].items():
        assert hashlib.sha256((out / name).read_bytes()).hexdigest() == digest
    result = {'source_cells_independently_checked': cells, 'relative_cutoff_queries_checked': historical_checks,
              'recordings_checked': len(prepared['records']), 'future_offsets_excluded': True,
              'missing_values_not_forward_filled': True, 'clinical_validation': False,
              'model_trained': False, 'verification_passed': True}
    content = json.dumps(result, indent=2) + '\n'
    path = report / 'verification.json'
    if path.exists() and path.read_text() != content:
        raise FileExistsError('Refusing to overwrite different verification')
    path.write_text(content)
    print(content, end='')


if __name__ == '__main__':
    verify()
