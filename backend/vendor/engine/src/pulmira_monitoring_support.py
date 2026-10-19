"""Composable descriptive trends and direct patient diary intake; no risk estimator."""
from collections import defaultdict
from dataclasses import dataclass, asdict
from datetime import timedelta
import json
import math
from statistics import median, NormalDist

from observed_twin import PROJECT, Observation, ObservedTwin, ORIGINS, utc, iso

POLICY = json.loads((PROJECT / 'config/pulmira_improvement_v1.json').read_text())
FLAGS = tuple(POLICY['symptom_flags'])


@dataclass(frozen=True)
class SymptomDiary:
    diary_id: str
    patient_id: str
    collected_at: str
    available_at: str
    dyspnea_worse_than_usual: bool | None
    cough_worse_than_usual: bool | None
    sputum_change: bool | None
    reported_symptom_start_at: str | None
    data_origin: str
    reporter: str

    def __post_init__(self):
        for field in ('diary_id', 'patient_id'):
            if not isinstance(getattr(self, field), str) or not getattr(self, field).strip():
                raise ValueError('Missing diary identity')
        if self.data_origin not in ORIGINS or self.reporter != 'patient_self_report':
            raise ValueError('Diary must declare origin and direct patient self-report')
        collected = utc(self.collected_at); available = utc(self.available_at)
        if available < collected:
            raise ValueError('Diary availability precedes collection')
        for flag in FLAGS:
            value = getattr(self, flag)
            if value is not None and type(value) is not bool:
                raise ValueError('Symptom flags must be boolean or null')
        if self.reported_symptom_start_at is not None:
            onset = utc(self.reported_symptom_start_at)
            if onset > collected: raise ValueError('Reported symptom start is after collection')
            object.__setattr__(self, 'reported_symptom_start_at', iso(onset))
        object.__setattr__(self, 'collected_at', iso(collected))
        object.__setattr__(self, 'available_at', iso(available))


def trend_features(observations, latest, as_of):
    """Equal-weight daily summaries, with actual gaps and only past availability."""
    decision = utc(as_of); today = decision.date()
    latest_day = utc(latest['measurement_end']).date()
    baseline_start = today - timedelta(days=POLICY['baseline_days'])
    trend_start = today - timedelta(days=POLICY['trend_days'] - 1)
    daily = defaultdict(list)
    for observation in sorted(observations, key=lambda o: (o.measurement_end, o.available_at, o.observation_id)):
        if observation.validity and utc(observation.available_at) <= decision and utc(observation.measurement_end) <= decision:
            daily[utc(observation.measurement_end).date()].append(float(observation.value))
    means = {day: sum(values) / len(values) for day, values in sorted(daily.items())}
    baseline_values = [value for day, value in means.items() if baseline_start <= day < today and day != latest_day]
    enough = len(baseline_values) >= POLICY['minimum_baseline_days']
    center = median(baseline_values) if enough else None
    mad = median([abs(x - center) for x in baseline_values]) if enough else None
    robust_z = None
    if center is not None and mad > 0 and latest['value'] is not None:
        robust_z = (latest['value'] - center) * NormalDist().inv_cdf(.75) / mad
    recent = [(day, value) for day, value in means.items() if trend_start <= day <= today]
    span = (recent[-1][0] - recent[0][0]).days if recent else 0
    slope = None
    if len(recent) >= POLICY['minimum_slope_days'] and span >= POLICY['minimum_slope_span_days']:
        x = [(day - recent[0][0]).days for day, _ in recent]; y = [value for _, value in recent]
        xm = sum(x) / len(x); ym = sum(y) / len(y)
        slope = sum((a - xm) * (b - ym) for a, b in zip(x, y)) / sum((a - xm) ** 2 for a in x)
    reasons = []
    if not enough: reasons.append('insufficient_prior_observed_days')
    elif mad == 0: reasons.append('zero_baseline_dispersion_standardized_change_undefined')
    if slope is None: reasons.append('insufficient_recent_observed_days_or_span_for_slope')
    if latest['freshness'] != 'fresh': reasons.append('current_measurement_' + latest['freshness'])
    if not latest['verified_observation_ready']: reasons.append('verified_observation_geometry_unavailable')
    result = {
        'channel': latest['channel'], 'units': latest['units'], 'context': latest['context'],
        'device_id': latest['device_id'], 'source_series_id': latest['source_series_id'],
        'current_observation_id': latest['observation_id'],
        'prior28_observed_days': len(baseline_values), 'prior28_median': center, 'prior28_mad': mad,
        'change_from_prior28_median': None if center is None or latest['value'] is None else latest['value'] - center,
        'robust_standardized_change': robust_z, 'recent7_observed_days': len(recent),
        'recent7_observed_day_fraction': len(recent) / POLICY['trend_days'],
        'recent7_span_days': span, 'recent7_daily_mean': sum(v for _, v in recent) / len(recent) if recent else None,
        'recent7_slope_units_per_day': slope,
        'candidate_feature_geometry_ready': latest['verified_observation_ready'] and enough and slope is not None,
        'clinical_prediction_validated': False, 'reasons': reasons}
    if any(isinstance(v, float) and not math.isfinite(v) for v in result.values()):
        raise ValueError('Non-finite trend feature')
    return result


class MonitoringSupport:
    def __init__(self):
        self._base = ObservedTwin()
        self._observations = {}
        self._by_patient_origin = defaultdict(dict)
        self._diaries = {}
        self._diary_times = {}
        self._diary_by_patient_origin = defaultdict(dict)

    def ingest(self, observation):
        o = Observation(**observation) if isinstance(observation, dict) else observation
        inserted = self._base.ingest(o)
        if inserted:
            self._observations[o.observation_id] = o
            self._by_patient_origin[(o.patient_id, o.data_origin)][o.observation_id] = o
        return inserted

    def ingest_many(self, observations):
        values = [Observation(**o) if isinstance(o, dict) else o for o in observations]
        self._base.ingest_many(values)
        for o in values:
            self._observations[o.observation_id] = o
            self._by_patient_origin[(o.patient_id, o.data_origin)][o.observation_id] = o

    def ingest_diary(self, diary):
        d = SymptomDiary(**diary) if isinstance(diary, dict) else diary
        if not isinstance(d, SymptomDiary): raise TypeError('Expected SymptomDiary')
        if d.diary_id in self._diaries:
            if d != self._diaries[d.diary_id]: raise ValueError('Conflicting diary ID')
            return False
        key = (d.patient_id, d.data_origin, d.collected_at)
        if key in self._diary_times: raise ValueError('Duplicate diary collection; reviewed revision required')
        self._diaries[d.diary_id] = d; self._diary_times[key] = d.diary_id
        self._diary_by_patient_origin[(d.patient_id, d.data_origin)][d.diary_id] = d
        return True

    def ingest_diaries(self, diaries):
        staged = MonitoringSupport()
        for d in self._diaries.values(): staged.ingest_diary(d)
        for d in diaries: staged.ingest_diary(d)
        self._diaries, self._diary_times = staged._diaries, staged._diary_times
        self._diary_by_patient_origin = staged._diary_by_patient_origin

    def state(self, patient_id, as_of, data_origin):
        state = self._base.state(patient_id, as_of, data_origin)
        state['base_schema_version'] = state['schema_version']; state['schema_version'] = POLICY['version']
        grouped = defaultdict(list)
        for o in self._by_patient_origin.get((patient_id, data_origin), {}).values():
            identity = ('device', o.device_id) if o.device_id is not None else ('source', o.source_series_id)
            grouped[(o.channel, o.context, *identity)].append(o)
        trends = []
        for c in state['channels']:
            identity = ('device', c['device_id']) if c['device_id'] is not None else ('source', c['source_series_id'])
            trends.append(trend_features(grouped[(c['channel'], c['context'], *identity)], c, as_of))
        state['patient_trends'] = trends
        decision = utc(as_of)
        visible = [d for d in self._diary_by_patient_origin.get((patient_id, data_origin), {}).values()
                   if utc(d.available_at) <= decision and utc(d.collected_at) <= decision]
        diary = None
        if visible:
            latest = max(visible, key=lambda d: (utc(d.collected_at), utc(d.available_at), d.diary_id))
            age = (decision - utc(latest.collected_at)).total_seconds() / 3600
            diary = {**asdict(latest), 'age_hours': age,
                     'freshness': 'fresh' if age <= POLICY['diary_max_age_hours'] else 'stale',
                     'unknown_flags': [name for name in FLAGS if getattr(latest, name) is None],
                     'symptom_onset_clinically_verified': False}
        state['symptom_diary'] = {'status': 'unavailable' if diary is None else 'patient_report_available',
                                  'latest': diary, 'interpretation': 'Direct self-report; not a clinician-verified exacerbation or a validated symptom instrument.'}
        state['research_readiness'] = {
            'experiment_authorized': False, 'model_trained': False,
            'required_review_checks': POLICY['experiment_entry_checks'],
            'clinical_validation': False}
        return state
