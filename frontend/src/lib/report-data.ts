import type { Archive } from './monitoring';
import type { PatientHistory } from './patient-data';
import { qualityPacket } from './quality.ts';

export const REPORT_LIMITATIONS = [
  'Historical source observations are not a live patient feed. Each participant has an individual snapshot clock.',
  'Public-source window times and the 24-hour processing lag are retrospective engineering assumptions, not measured live latency.',
  'Missing values are unknown. Stale values are not current or normal readings. Physical device identity may be unestablished.',
  'Observed-day counts describe channel presence, not device wear-time adherence. Trends are descriptive, not causal effects.',
  'A symptom diary is a direct self-report, not a clinician-verified exacerbation or a validated symptom instrument.',
  'A separate formula-based seven-day change outlook is available in the workspace and is excluded from this monitoring report. Calibrated event probabilities and real-patient counterfactuals remain unavailable. No diagnosis or treatment recommendation is generated.',
  'This research report is generated from source-linked historical data. It is not clinician reviewed or stored by a clinical service.',
];
export function buildMonitoringReport(history: PatientHistory, index: number, archive: Archive, generatedAt = new Date().toISOString()) {
  const state = history.snapshots[index];
  if (!state || !Number.isFinite(Date.parse(state.as_of)) || state.patient_id !== history.patientId || state.data_origin !== history.origin || !Number.isFinite(Date.parse(generatedAt))) throw new Error('The report does not match a valid patient and historical decision.');
  if (state.risk.probability_next_7_days !== null || state.risk.status !== 'unavailable' || state.risk.clinical_validation !== false) throw new Error('The report failed its forecast boundary checks.');
  if (state.channels.some(row => !Number.isFinite(Date.parse(row.measurement_end)) || !Number.isFinite(Date.parse(row.available_at)) || Date.parse(row.measurement_end) > Date.parse(state.as_of) || Date.parse(row.available_at) > Date.parse(state.as_of))) throw new Error('The report contains observations unavailable at the selected time.');
  const diary = state.symptom_diary.latest as { patient_id:string;data_origin:string;collected_at:string;available_at:string } | null;
  if (diary && (!Number.isFinite(Date.parse(diary.collected_at)) || !Number.isFinite(Date.parse(diary.available_at)) || diary.patient_id !== state.patient_id || diary.data_origin !== state.data_origin || Date.parse(diary.collected_at) > Date.parse(state.as_of) || Date.parse(diary.available_at) > Date.parse(state.as_of))) throw new Error('The archived diary does not match this report.');
  return structuredClone({ schema_version:'pulmira-monitoring-report-1.0.0',reference:`PLM-${state.patient_id}-${state.as_of.replace(/[^0-9]/g,'')}-v1`,patient_id:state.patient_id,data_origin:state.data_origin,as_of:state.as_of,generated_at_client:generatedAt,report_status:'local_research_summary',clinician_reviewed:false,clinical_validation:false,server_connected:archive.server_connected??false,state,quality:qualityPacket(state,history.observations),source:{ label:history.origin === 'synthetic' ? 'Fictional contract illustration' : archive.sourceLabel,url:history.origin === 'real_open' ? archive.sourceUrl : null,license:history.origin === 'real_open' ? archive.license : null,final_state_archive_sha256:history.origin === 'real_open' ? archive.sourceSha256 : archive.syntheticSha256,history_inputs_sha256:history.provenance,clock_note:'This report shows one selected historical decision for the identified patient. It is not a live feed or a simultaneous cohort assessment.' },browser_demo_check_ins_included:false,limitations:REPORT_LIMITATIONS });
}
export type MonitoringReport = ReturnType<typeof buildMonitoringReport>;
export function reportFilename(report: MonitoringReport, extension: 'pdf'|'json') {
  return `pulmira-${report.patient_id}-${report.as_of.replace(/[:.]/g,'-')}-monitoring.${extension}`;
}
export function reportTextValue(value: boolean | null) { return value === null ? 'Unknown / unsure' : value ? 'Yes' : 'No'; }
