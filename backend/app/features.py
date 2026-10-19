"""Views derived from one engine state packet: data quality, timeline snapshot, notices,
monitoring-change summary and report. None of these change engine values or estimate risk."""
import hashlib
import json

SUMMARY_VERSION = 'pulmira-monitoring-change-summary-0.1.0'
NOTICE_RULES_VERSION = 'pulmira-review-rules-1.0.0'
REPORT_VERSION = 'pulmira-monitoring-report-1.0.0'

# Engineering assumptions, not clinical thresholds: a robust standardized change (MAD-scaled, from the
# engine) at or beyond 2 in the declared direction counts as a "recorded change".
CHANGE_RULES = {
    'spo2_pct': ('decrease', -2.0),
    'heart_rate_bpm': ('increase', 2.0),
    'respiratory_rate_per_min': ('increase', 2.0),
    'sleep_hours': ('decrease', -2.0),
    'gait_speed_m_per_s': ('decrease', -2.0),
    'aqi_index': ('increase', 2.0),
}
SUMMARY_COPY = ('Monitoring change summary — research prototype. Calculated using transparent rules from available '
                'observations. Summarises recorded changes; does not estimate the probability of an exacerbation '
                'within the next seven days.')


def state_hash(state):
    return hashlib.sha256(json.dumps(state, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def series_key(c):
    return f"{c['channel']}|{c['context']}|" + (f"device:{c['device_id']}" if c['device_id'] else f"source:{c['source_series_id']}")


def paired(state):
    # The engine builds patient_trends by iterating channels, so the lists align one-to-one.
    return list(zip(state['channels'], state['patient_trends']))


def data_quality(state):
    series = []
    for c, t in paired(state):
        series.append({
            'series_key': series_key(c), 'channel': c['channel'], 'units': c['units'], 'context': c['context'],
            'device_id': c['device_id'], 'source_series_id': c['source_series_id'],
            'current_observation_id': c['observation_id'], 'value': c['value'], 'freshness': c['freshness'],
            'measurement_end': c['measurement_end'], 'available_at': c['available_at'],
            'measurement_age_hours': c['measurement_age_hours'], 'availability_age_hours': c['availability_age_hours'],
            'time_evidence': c['time_evidence'], 'window_evidence': c['window_evidence'],
            'last_valid': c['last_valid'],
            'baseline_prior_observed_days': c['baseline']['prior_observed_days'],
            'baseline_mean_available': c['baseline']['mean'] is not None,
            'warmup_complete': c['baseline']['warmup_complete'],
            'timestamp_metadata_verified': c['baseline']['timestamp_metadata_verified'],
            'observation_geometry_ready': c['observation_geometry_ready'],
            'verified_observation_ready': c['verified_observation_ready'],
            'recent7_observed_days': t['recent7_observed_days'],
            'recent7_observed_day_fraction': t['recent7_observed_day_fraction'],
            'reasons': sorted(set(c['reasons']) | set(t['reasons']))})
    count = lambda f: sum(1 for s in series if s['freshness'] == f)
    return {
        'patient_id': state['patient_id'], 'data_origin': state['data_origin'], 'as_of': state['as_of'],
        'state_schema_version': state['schema_version'], 'state_sha256': state_hash(state),
        'state_status': state['state_status'],
        'summary': {'series': len(series), 'fresh': count('fresh'), 'stale': count('stale'), 'invalid': count('invalid'),
                    'missing_channels': len(state['missing_channels']),
                    'series_with_baseline': sum(1 for s in series if s['baseline_mean_available']),
                    'warmup_complete': sum(1 for s in series if s['warmup_complete']),
                    'metadata_verified': sum(1 for s in series if s['timestamp_metadata_verified'])},
        'series': series, 'missing_channels': state['missing_channels'],
        'symptom_diary': {'status': state['symptom_diary']['status'],
                          'freshness': (state['symptom_diary']['latest'] or {}).get('freshness'),
                          'unknown_flags': (state['symptom_diary']['latest'] or {}).get('unknown_flags')},
        'notes': ['Freshness uses measurement age (fresh through exactly 24 h); arrival age cannot make data fresh.',
                  'recent7_observed_day_fraction counts days with observations; it is not wear-time adherence or accuracy.',
                  'Unknown values are null, never zero.']}


def snapshot(state):
    """Compact per-decision-time view for timeline replay; null stays null."""
    return {
        'as_of': state['as_of'], 'state_status': state['state_status'], 'state_sha256': state_hash(state),
        'channels': [{'series_key': series_key(c), 'channel': c['channel'], 'units': c['units'], 'context': c['context'],
                      'observation_id': c['observation_id'], 'value': c['value'], 'measurement_end': c['measurement_end'],
                      'available_at': c['available_at'], 'freshness': c['freshness'],
                      'measurement_age_hours': c['measurement_age_hours'],
                      'baseline_mean': c['baseline']['mean'], 'deviation_from_baseline': c['deviation_from_baseline']}
                     for c in state['channels']],
        'missing_channels': state['missing_channels'],
        'symptom_diary_status': state['symptom_diary']['status'],
        'risk': state['risk']}


def monitoring_summary(state):
    inputs, assessable, matched = [], 0, 0
    for c, t in paired(state):
        direction, cutoff = CHANGE_RULES[c['channel']]
        exclusions = []
        if c['freshness'] != 'fresh':
            exclusions.append('current_measurement_' + c['freshness'])
        if t['robust_standardized_change'] is None:
            exclusions += [r for r in t['reasons'] if r in ('insufficient_prior_observed_days',
                           'zero_baseline_dispersion_standardized_change_undefined')] or ['standardized_change_unavailable']
        z = t['robust_standardized_change']
        ok = not exclusions
        hit = ok and (z <= cutoff if direction == 'decrease' else z >= cutoff)
        assessable += ok
        matched += bool(hit)
        inputs.append({
            'series_key': series_key(c), 'channel': c['channel'], 'units': c['units'], 'context': c['context'],
            'source_series_id': c['source_series_id'], 'device_id': c['device_id'],
            'source_observation_id': c['observation_id'], 'value': c['value'], 'measurement_end': c['measurement_end'],
            'reference': {'kind': 'prior28_median_and_mad', 'median': t['prior28_median'], 'mad': t['prior28_mad'],
                          'observed_days': t['prior28_observed_days']},
            'robust_standardized_change': z, 'rule': {'direction': direction, 'cutoff': cutoff},
            'assessable': ok, 'matched': bool(hit) if ok else None, 'exclusions': exclusions})
    return {
        'schema_version': SUMMARY_VERSION, 'rule_version': SUMMARY_VERSION,
        'patient_id': state['patient_id'], 'data_origin': state['data_origin'], 'as_of': state['as_of'],
        'state_sha256': state_hash(state),
        'status': 'computed' if assessable else 'unavailable',
        'unavailable_reason': None if assessable else 'no_assessable_inputs',
        'assessable_inputs': assessable, 'matched_inputs': matched if assessable else None,
        'not_assessed_channels': state['missing_channels'],
        'inputs': inputs,
        'rules': {k: {'direction': d, 'robust_standardized_change_cutoff': v} for k, (d, v) in CHANGE_RULES.items()},
        'assumptions': ['Cutoffs are engineering assumptions, not clinically validated thresholds.',
                        'Only fresh current measurements with a defined robust standardized change are assessable.',
                        'A match count is not a percentage, probability, severity grade or causal attribution.'],
        'is_probability': False, 'clinical_validation': False,
        'probability_next_7_days': None, 'display_copy': SUMMARY_COPY}


CHANNEL_NAMES = {'spo2_pct': 'SpO₂', 'heart_rate_bpm': 'Heart rate', 'respiratory_rate_per_min': 'Respiratory rate',
                 'sleep_hours': 'Sleep duration', 'gait_speed_m_per_s': 'Gait speed', 'aqi_index': 'Air quality index'}


def notices(state):
    """The frontend's review rules (pulmira-review-rules-1.0.0), now computed once, server-side.
    At most one notice per category per patient/origin/decision; no severity, diagnosis or priority."""
    if state['risk']['probability_next_7_days'] is not None or state['risk']['status'] != 'unavailable':
        raise ValueError('Review source failed its forecast checks')
    out = []

    def add(kind, title, explanation, channels=(), missing=(), diary=None):
        out.append({'id': '|'.join([NOTICE_RULES_VERSION, state['data_origin'], state['patient_id'], state['as_of'], kind]),
                    'kind': kind, 'patientId': state['patient_id'], 'origin': state['data_origin'],
                    'asOf': state['as_of'], 'title': title, 'explanation': explanation, 'channels': list(channels),
                    'missing': list(missing), 'diary': diary, 'clinical_alert': False})

    plural = lambda n, one, many: one if n == 1 else many
    if state['missing_channels']:
        add('missing', 'Some channel types are not observed' if state['channels'] else 'No channel types are observed',
            ', '.join(CHANNEL_NAMES.get(k, k) for k in state['missing_channels']) +
            '. Missing is unknown; it is not a normal reading.', missing=state['missing_channels'])
    stale = [c for c in state['channels'] if c['freshness'] == 'stale']
    if stale:
        add('stale', f"{len(stale)} stale source {plural(len(stale), 'stream', 'streams')}",
            'The source packet marks these readings stale at this historical decision. '
            'Their age does not establish a clinical condition.', stale)
    invalid = [c for c in state['channels'] if c['freshness'] == 'invalid']
    if invalid:
        add('invalid', f"{len(invalid)} invalid source {plural(len(invalid), 'stream', 'streams')}",
            'These streams are marked invalid in the source packet; no clinical priority is inferred.', invalid)
    baseline = [c for c in state['channels'] if c['baseline']['mean'] is None]
    if baseline:
        add('baseline', f"{len(baseline)} {plural(len(baseline), 'stream lacks', 'streams lack')} a baseline",
            'The original packet has no baseline mean. Review the prior observed-day count rather than '
            'substituting a population value.', baseline)
    if state['symptom_diary']['latest']:
        add('diary', 'An archived symptom report is available',
            'Direct self-report available at this decision, not a verified exacerbation.',
            diary=state['symptom_diary']['latest'])
    return out


LIMITATIONS = [
    'Seven-day exacerbation probability is unavailable: no validated forecast model exists in this project.',
    'Descriptive changes and deviations are observations, not causal triggers, diagnoses or treatment advice.',
    'Source availability times for TOLIFE are an engineering assumption (24 h processing lag), not measured latency.',
    'Self-reported symptoms are not a clinician-verified exacerbation or a validated questionnaire.',
    'Unknown values are shown as unavailable, never zero.',
]


def report(state, patient_row, sources, generated_at):
    dq = data_quality(state)
    return {
        'report_schema_version': REPORT_VERSION, 'generated_at': generated_at,
        'patient': {'patient_id': state['patient_id'], 'data_origin': state['data_origin'],
                    'source_dataset': patient_row['source_dataset'], 'source_site': patient_row['source_site'],
                    'demographics': None},
        'as_of': state['as_of'], 'state_schema_version': state['schema_version'],
        'base_schema_version': state['base_schema_version'], 'state_sha256': state_hash(state),
        'sources': sources,
        'fictional_data': state['data_origin'] == 'synthetic',
        'observations': [{k: s[k] for k in ('channel', 'units', 'context', 'source_series_id', 'device_id', 'value',
                                              'measurement_end', 'available_at', 'freshness', 'measurement_age_hours',
                                              'time_evidence', 'reasons')}
                         | {'baseline_mean': c['baseline']['mean'], 'baseline_prior_observed_days': c['baseline']['prior_observed_days'],
                            'deviation_from_baseline': c['deviation_from_baseline']}
                         for s, c in zip(dq['series'], state['channels'])],
        'trends': state['patient_trends'],
        'symptom_diary': state['symptom_diary'],
        'data_gaps': {**dq['summary'], 'missing_channel_count': dq['summary']['missing_channels'],
                      'missing_channels': state['missing_channels']},
        'monitoring_change_summary': monitoring_summary(state),
        'forecast': state['risk'] | {'display': '7-day forecast unavailable'},
        'counterfactual': state['counterfactual'],
        'limitations': LIMITATIONS,
        'state': state}


def report_pdf(rep):
    from fpdf import FPDF

    def t(x):
        return ('—' if x is None else str(x)).replace('—', '-').replace('₂', '2').encode('latin-1', 'replace').decode('latin-1')

    pdf = FPDF(format='A4')
    pdf.set_auto_page_break(True, 15)
    pdf.add_page()
    pdf.set_font('Helvetica', 'B', 15)
    pdf.cell(0, 9, t('Pulmira monitoring report - research prototype'), new_x='LMARGIN', new_y='NEXT')
    pdf.set_font('Helvetica', '', 9)
    p = rep['patient']
    for line in [f"Patient {p['patient_id']}  |  origin {p['data_origin']}  |  site {p['source_site']}  |  dataset {p['source_dataset']}",
                 f"Decision time (as of): {rep['as_of']}   Generated: {rep['generated_at']}",
                 f"State {rep['state_schema_version']}  sha256 {rep['state_sha256'][:16]}..."]:
        pdf.cell(0, 5, t(line), new_x='LMARGIN', new_y='NEXT')
    if rep['fictional_data']:
        pdf.set_text_color(170, 0, 0)
        pdf.cell(0, 6, 'FICTIONAL / SYNTHETIC DATA - not a real patient', new_x='LMARGIN', new_y='NEXT')
        pdf.set_text_color(0, 0, 0)

    def heading(text):
        pdf.ln(2)
        pdf.set_font('Helvetica', 'B', 11)
        pdf.cell(0, 7, t(text), new_x='LMARGIN', new_y='NEXT')
        pdf.set_font('Helvetica', '', 8)

    def para(text):
        pdf.multi_cell(0, 4.5, t(text), align='L', new_x='LMARGIN', new_y='NEXT')

    heading('Observations at decision time')
    rows = [('Channel', 'Context', 'Value', 'Units', 'Measured (end)', 'Fresh', 'Age h', 'Baseline')]
    rows += [(o['channel'], o['context'], '-' if o['value'] is None else f"{o['value']:.2f}", o['units'],
              o['measurement_end'], o['freshness'], f"{o['measurement_age_hours']:.0f}",
              '-' if o['baseline_mean'] is None else f"{o['baseline_mean']:.2f}") for o in rep['observations']]
    with pdf.table(col_widths=(26, 34, 14, 18, 36, 13, 12, 17), text_align='LEFT', line_height=4.5) as table:
        for r in rows:
            row = table.row()
            for v in r:
                row.cell(t(v))
    g = rep['data_gaps']
    heading('Data gaps and quality')
    para(f"Missing channels: {', '.join(g['missing_channels']) or 'none'}. Series: {g['series']} "
         f"(fresh {g['fresh']}, stale {g['stale']}, invalid {g['invalid']}). With baseline: {g['series_with_baseline']}.")
    heading('Symptom diary (patient self-report)')
    d = rep['symptom_diary']['latest']
    para('No self-report visible at this decision time.' if not d else
         f"Collected {d['collected_at']}, received {d['available_at']} ({d['freshness']}). Breathlessness worse: "
         f"{_yn(d['dyspnea_worse_than_usual'])}; cough worse: {_yn(d['cough_worse_than_usual'])}; sputum change: "
         f"{_yn(d['sputum_change'])}. {rep['symptom_diary']['interpretation']}")
    s = rep['monitoring_change_summary']
    heading('Monitoring change summary (research prototype)')
    para(s['display_copy'])
    para(f"Status: {s['status']}. Assessable inputs: {s['assessable_inputs']}; matched: {t(s['matched_inputs'])}. "
         f"Rule version {s['rule_version']}.")
    heading('Seven-day forecast')
    para(f"Unavailable. Reasons: {', '.join(rep['forecast']['reasons'])}. Clinical validation: false.")
    heading('Sources and limitations')
    for src in rep['sources']:
        para(f"{src['attribution']} {src['url'] or ''}")
    for line in rep['limitations']:
        para('- ' + line)
    return bytes(pdf.output())


def _yn(v):
    return 'unknown' if v is None else ('yes' if v else 'no')
