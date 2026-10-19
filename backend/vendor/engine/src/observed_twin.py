"""Deterministic, as-of observed Twin state. No prediction model is loaded."""
from collections import defaultdict
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta, timezone
import json
import math
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[1]
CONFIG = json.loads((PROJECT / 'config/observed_twin_v1.json').read_text())
ORIGINS = {'real_open', 'real_controlled', 'synthetic'}
EVIDENCE = {'measured', 'custodian_verified_bound', 'assumed_source_clock', 'synthetic_generated'}


def utc(value):
    """Reject naive input; silently inventing a timezone would change freshness."""
    if isinstance(value, str):
        value = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if not isinstance(value, datetime) or value.tzinfo is None or value.utcoffset() is None:
        raise ValueError('An explicit timezone is required')
    return value.astimezone(timezone.utc)


def iso(value):
    return utc(value).isoformat().replace('+00:00', 'Z')


@dataclass(frozen=True)
class Observation:
    observation_id: str
    patient_id: str
    channel: str
    value: float | None
    units: str
    device_id: str | None
    source_series_id: str
    context: str
    measurement_start: str | None
    measurement_end: str
    available_at: str
    validity: int
    data_origin: str
    time_evidence: str
    window_evidence: str

    def __post_init__(self):
        for name in ('observation_id', 'patient_id', 'source_series_id', 'context'):
            value = getattr(self, name)
            if not isinstance(value, str) or not value.strip():
                raise ValueError('Missing identity/context: ' + name)
        if self.device_id is not None and (not isinstance(self.device_id, str) or not self.device_id.strip()):
            raise ValueError('Empty device identity; use null when unknown')
        meta = CONFIG['channels'].get(self.channel)
        if meta is None or self.units != meta['units']:
            raise ValueError('Channel/unit mismatch')
        if self.data_origin not in ORIGINS:
            raise ValueError('Unknown data origin')
        if self.time_evidence not in EVIDENCE or self.window_evidence not in EVIDENCE:
            raise ValueError('Unknown timestamp/window evidence')
        if self.data_origin == 'synthetic' and (self.time_evidence != 'synthetic_generated' or self.window_evidence != 'synthetic_generated'):
            raise ValueError('Synthetic timestamps must be labeled synthetic_generated')
        if self.data_origin != 'synthetic' and 'synthetic_generated' in (self.time_evidence, self.window_evidence):
            raise ValueError('Real observations cannot claim synthetic timestamp evidence')
        end = utc(self.measurement_end); available = utc(self.available_at)
        if available < end:
            raise ValueError('Availability precedes measurement end')
        if self.measurement_start is not None and utc(self.measurement_start) > end:
            raise ValueError('Measurement window reversed')
        verified = {'measured', 'custodian_verified_bound'}
        if self.window_evidence in verified and self.measurement_start is None:
            raise ValueError('Verified window requires its start')
        if self.time_evidence in verified and self.device_id is None:
            raise ValueError('Verified intake requires a device identity')
        if type(self.validity) is not int or self.validity not in (0, 1):
            raise ValueError('Validity must be integer 0 or 1')
        if self.validity:
            lo, hi = meta['sanity_bounds']
            if isinstance(self.value, bool) or not isinstance(self.value, (float, int)) or not math.isfinite(self.value) or not lo <= self.value <= hi:
                raise ValueError('Valid reading outside engineering sanity bounds')
        elif self.value is not None and (isinstance(self.value, bool) or not isinstance(self.value, (float, int)) or not math.isfinite(self.value)):
            raise ValueError('Invalid reading must have a finite value or null')
        object.__setattr__(self, 'measurement_end', iso(end))
        object.__setattr__(self, 'available_at', iso(available))
        if self.measurement_start is not None:
            object.__setattr__(self, 'measurement_start', iso(self.measurement_start))

    @property
    def series(self):
        # Unknown physical identity remains qualified; a source stream is never a device.
        identity = ('device', self.device_id) if self.device_id is not None else ('source', self.source_series_id)
        return self.patient_id, self.data_origin, self.channel, self.context, *identity


class ObservedTwin:
    """Append-only ledger; insertion order cannot affect an as-of reconstruction.

    Corrections are deliberately not inferred: conflicting IDs/windows raise an error.
    Rebuild with a reviewed corrected ledger rather than silently changing history.
    """
    def __init__(self):
        self._ids = {}
        self._windows = {}
        self._series = defaultdict(list)

    def ingest(self, observation):
        if isinstance(observation, dict):
            observation = Observation(**observation)
        if not isinstance(observation, Observation):
            raise TypeError('Expected Observation or exact observation object')
        existing = self._ids.get(observation.observation_id)
        if existing is not None:
            if existing != observation:
                raise ValueError('Conflicting duplicate observation ID')
            return False
        window = observation.series + (observation.measurement_start, observation.measurement_end)
        if window in self._windows:
            raise ValueError('Duplicate measurement window; provide a reviewed ledger correction')
        self._ids[observation.observation_id] = observation
        self._windows[window] = observation.observation_id
        self._series[observation.series].append(observation)
        return True

    def ingest_many(self, observations):
        # Validate the whole batch first: one bad record must not partly commit a batch.
        candidate = ObservedTwin()
        for observation in self._ids.values():
            candidate.ingest(observation)
        for observation in observations:
            candidate.ingest(observation)
        self._ids, self._windows, self._series = candidate._ids, candidate._windows, candidate._series

    def state(self, patient_id, as_of, data_origin):
        if not isinstance(patient_id, str) or not patient_id.strip() or data_origin not in ORIGINS:
            raise ValueError('Explicit patient and data origin required')
        decision = utc(as_of); day = decision.date()
        lower = day - timedelta(days=CONFIG['baseline_window_days'])
        channels = []
        for key in sorted(self._series):
            if key[0] != patient_id or key[1] != data_origin:
                continue
            # Future observations are omitted entirely, including their series identities.
            visible = [o for o in self._series[key] if utc(o.available_at) <= decision and utc(o.measurement_end) <= decision]
            if not visible:
                continue
            visible.sort(key=lambda o: (utc(o.measurement_end), utc(o.available_at), o.observation_id))
            latest = visible[-1]
            latest_day = utc(latest.measurement_end).date()
            valid = [o for o in visible if o.validity == 1]
            past_days = defaultdict(list)
            for o in valid:
                measured_day = utc(o.measurement_end).date()
                if lower <= measured_day < day and measured_day != latest_day:
                    past_days[measured_day].append(float(o.value))
            daily_means = [sum(values) / len(values) for _, values in sorted(past_days.items())]
            n = len(daily_means)
            baseline = sum(daily_means) / n if n >= CONFIG['minimum_prior_observed_days'] else None
            # Warmup uses observed, available history; future kit manifests cannot start it.
            first_valid = min((utc(o.measurement_end) for o in valid), default=None)
            warmup = first_valid is not None and decision - first_valid >= timedelta(days=CONFIG['warmup_days'])
            age = (decision - utc(latest.measurement_end)).total_seconds() / 3600
            arrival_age = (decision - utc(latest.available_at)).total_seconds() / 3600
            freshness = 'invalid' if not latest.validity else ('fresh' if age <= CONFIG['max_measurement_age_hours'] else 'stale')
            verified = {'measured', 'custodian_verified_bound'}
            metadata_verified = latest.device_id is not None and latest.measurement_start is not None and latest.time_evidence in verified and latest.window_evidence in verified
            # Do not blend historical assumed clocks into a verified clinical baseline.
            baseline_verified = n >= CONFIG['minimum_prior_observed_days'] and all(
                o.time_evidence in verified and o.window_evidence in verified and o.device_id is not None
                for o in valid if lower <= utc(o.measurement_end).date() < day and utc(o.measurement_end).date() != latest_day)
            reasons = []
            if freshness != 'fresh': reasons.append('latest_measurement_' + freshness)
            if baseline is None: reasons.append('insufficient_prior_observed_days')
            if not warmup: reasons.append('warmup_incomplete')
            if not metadata_verified or not baseline_verified: reasons.append('timestamp_or_device_metadata_unverified')
            ready = freshness == 'fresh' and baseline is not None and warmup
            last_valid = valid[-1] if valid else None
            channels.append({
                'channel': latest.channel, 'units': latest.units, 'context': latest.context,
                'device_id': latest.device_id, 'source_series_id': latest.source_series_id,
                'observation_id': latest.observation_id, 'value': float(latest.value) if latest.validity else None,
                'measurement_start': latest.measurement_start, 'measurement_end': latest.measurement_end,
                'available_at': latest.available_at, 'time_evidence': latest.time_evidence,
                'window_evidence': latest.window_evidence, 'freshness': freshness,
                'measurement_age_hours': age, 'availability_age_hours': arrival_age,
                'last_valid': None if last_valid is None else {'observation_id': last_valid.observation_id, 'value': float(last_valid.value), 'measurement_end': last_valid.measurement_end},
                'baseline': {'window_days': CONFIG['baseline_window_days'], 'prior_observed_days': n,
                             'mean': baseline, 'current_day_excluded': True, 'latest_measurement_day_excluded': True,
                             'warmup_complete': warmup,
                             'timestamp_metadata_verified': baseline_verified},
                'deviation_from_baseline': float(latest.value) - baseline if latest.validity and baseline is not None else None,
                'observation_geometry_ready': ready,
                'verified_observation_ready': ready and metadata_verified and baseline_verified and data_origin != 'synthetic',
                'reasons': reasons})
        present = {c['channel'] for c in channels}
        expected = set(CONFIG['channels'])
        vitals = {'spo2_pct', 'heart_rate_bpm', 'respiratory_rate_per_min'}
        # Same physical device and context required; a session + mattress + wrist is not a wrist triad.
        groups = defaultdict(set)
        for c in channels:
            if c['verified_observation_ready'] and c['device_id'] is not None:
                groups[(c['device_id'], c['context'])].add(c['channel'])
        coherent_triad = any(vitals.issubset(group) for group in groups.values())
        risk_reasons = ['no_validated_forecast_model', 'onset_and_surveillance_evidence_not_integrated']
        if not coherent_triad: risk_reasons.append('coherent_verified_fresh_vital_triad_unavailable')
        if data_origin == 'synthetic': risk_reasons.append('synthetic_demonstration_only')
        if any(c['time_evidence'] == 'assumed_source_clock' for c in channels):
            risk_reasons.append('source_availability_is_assumed')
        return {
            'schema_version': CONFIG['version'], 'patient_id': patient_id, 'data_origin': data_origin,
            'as_of': iso(decision), 'state_kind': 'observed_measurements',
            'state_status': 'no_observations_available' if not channels else 'observations_available',
            'channels': channels, 'missing_channels': sorted(expected - present),
            'coherent_verified_vital_triad_ready': coherent_triad,
            'risk': {'probability_next_7_days': None, 'status': 'unavailable', 'reasons': risk_reasons,
                     'clinical_validation': False},
            'counterfactual': {'status': 'unavailable', 'reason': 'no_validated_real_patient_causal_model'},
            'interpretation': 'Descriptive deviations are observations, not causal triggers or clinical alerts.'}


def observation_dict(observation):
    return asdict(observation)
