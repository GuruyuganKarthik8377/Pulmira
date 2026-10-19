"""Historical relative-clock views of BIDMC numerics, separate from COPD forecasting.

No calendar timestamps, receipt times, diagnoses, baselines or predictions are invented.
This is not an availability-aware reconstruction of real-time clinical decisions.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[1]
RAW = PROJECT / 'data/raw/public_now_v1/bidmc_1.0.0'
FIELDS = {
    'HR': ('heart_rate_bpm', 'bpm', 'ECG-derived monitor numeric'),
    'PULSE': ('pulse_rate_bpm', 'bpm', 'PPG-derived monitor numeric'),
    'RESP': ('respiratory_rate_per_min', 'breaths_per_min', 'impedance-derived monitor numeric'),
    'SpO2': ('spo2_pct', 'percent', 'pulse-oximetry monitor numeric'),
}


def parse_number(text: str) -> float | None:
    text = text.strip()
    if text in ('', 'NaN', 'nan', 'NAN'):
        return None
    value = float(text)
    if not math.isfinite(value):
        return None
    return value


def read_rows(path: Path) -> list[dict]:
    rows = []
    with path.open(newline='') as handle:
        reader = csv.DictReader(handle, skipinitialspace=True)
        if reader.fieldnames != ['Time [s]', *FIELDS]:
            raise ValueError(f'Unexpected numeric columns: {reader.fieldnames}')
        previous = -math.inf
        for source_row, row in enumerate(reader, 2):
            t = parse_number(row['Time [s]'])
            if t is None or t < -1 or t <= previous or t > 480:
                raise ValueError('Source offsets must be finite, unique, ordered and inside -1..480 seconds')
            previous = t
            values = {}
            flags = {}
            for source_column, (channel, _, _) in FIELDS.items():
                value = parse_number(row[source_column])
                # Broad representational bounds only; no clinical severity threshold.
                invalid = value is not None and (value < 0 or (channel == 'spo2_pct' and value > 100))
                values[channel] = None if invalid else value
                flags[channel] = 'invalid' if invalid else ('missing' if value is None else 'recorded')
            rows.append({'elapsed_seconds': t, 'source_row': source_row,
                         'values': values, 'status': flags})
    if not rows:
        raise ValueError('Empty recording')
    return rows


def packet(record_id: str, rows: list[dict], elapsed_seconds: float) -> dict:
    if record_id not in {f'BIDMC-{i:02d}' for i in range(1, 54)}:
        raise ValueError('Unknown recording ID')
    if isinstance(elapsed_seconds, bool) or not isinstance(elapsed_seconds, (float, int)):
        raise ValueError('Offset must be numeric')
    if not math.isfinite(elapsed_seconds) or not 0 <= elapsed_seconds <= 480:
        raise ValueError('Offset must be finite and inside 0..480 seconds')
    eligible = [r for r in rows if 0 <= r['elapsed_seconds'] <= elapsed_seconds]
    latest = eligible[-1] if eligible else None
    channels = []
    for column, (channel, units, context) in FIELDS.items():
        valid = next((r for r in reversed(eligible) if r['status'][channel] == 'recorded'), None)
        channels.append({
            'channel': channel, 'units': units, 'context': context,
            'value': latest['values'][channel] if latest else None,
            'status': latest['status'][channel] if latest else 'no_recorded_sample',
            'measurement_elapsed_seconds': latest['elapsed_seconds'] if latest else None,
            'age_within_record_seconds': elapsed_seconds - latest['elapsed_seconds'] if latest else None,
            'source_column': column, 'source_row': latest['source_row'] if latest else None,
            'measurement_end': None, 'available_at': None, 'device_id': None,
            'clinical_measurement_quality_validated': False,
            'last_recorded_nonmissing': {'value': valid['values'][channel],
                                       'elapsed_seconds': valid['elapsed_seconds']} if valid else None,
            'baseline': None,
            'history': [{'elapsed_seconds': r['elapsed_seconds'], 'value': r['values'][channel],
                         'status': r['status'][channel]} for r in eligible],
        })
    return {
        'schema_version': 'pulmira-public-relative-monitoring-1.0.0',
        'record_id': record_id, 'patient_id': None, 'data_origin': 'real_open',
        'source_dataset': 'BIDMC PPG and Respiration 1.0.0',
        'source_url': 'https://physionet.org/content/bidmc/1.0.0/',
        'population': 'Critical-care ICU recordings; COPD diagnosis not established',
        'view_kind': 'historical_recording_relative_clock',
        'elapsed_seconds': elapsed_seconds, 'recording_duration_seconds': 480,
        'as_of': None, 'calendar_time_known': False, 'availability_time_known': False,
        'excluded_negative_offset_source_rows': [r['source_row'] for r in rows if r['elapsed_seconds'] < 0],
        'clinical_decision_replay': False, 'channels': channels,
        'unsupported_channels': ['aqi_index', 'sleep_hours', 'gait_speed_m_per_s'],
        'risk': {'probability_next_7_days': None, 'status': 'unavailable',
                 'clinical_validation': False,
                 'reasons': ['no_copd_event_labels', 'eight_minute_recordings_not_seven_day_followup',
                             'no_validated_forecast_model']},
        'counterfactual': {'status': 'unavailable', 'clinical_validation': False},
        'interpretation': 'Real recorded numeric samples. Historical elapsed-time display only; '
                          'not live telemetry, a COPD diagnosis or an exacerbation forecast.',
    }


def query(record_id: str, elapsed_seconds: float, raw: Path = RAW) -> dict:
    if record_id not in {f'BIDMC-{i:02d}' for i in range(1, 54)}:
        raise ValueError('Unknown recording ID')
    number = record_id.removeprefix('BIDMC-')
    name = f'bidmc_csv/bidmc_{number}_Numerics.csv'
    acquisition = json.loads((raw / 'acquisition.json').read_text())
    path = raw / name
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    if digest != acquisition['acquired_files'][name]['sha256']:
        raise ValueError('Source checksum mismatch')
    return packet(record_id, read_rows(path), elapsed_seconds)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--record', default='BIDMC-01')
    parser.add_argument('--elapsed-seconds', type=float, default=120)
    parser.add_argument('--raw', type=Path, default=RAW)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    content = json.dumps(query(args.record, args.elapsed_seconds, args.raw), indent=2, allow_nan=False) + '\n'
    if args.output:
        with args.output.open('x') as handle:
            handle.write(content)
    else:
        print(content, end='')
