import type { DemoOrigin } from './monitoring';

export const SYMPTOM_FIELDS = ['dyspnea_worse_than_usual', 'cough_worse_than_usual', 'sputum_change'] as const;
export type SymptomField = typeof SYMPTOM_FIELDS[number];
export type Answer = '' | 'yes' | 'no' | 'unsure';
export type Answers = Record<SymptomField, Answer>;
export interface BrowserCheckIn {
  schema_version: 'pulmira-browser-check-in-1.0.0'; id: string; patient_id: string;
  data_origin: 'synthetic'; client_collected_at: string; stored_locally_at: string;
  server_received_at: null; delivery_status: 'browser_only'; reporter: 'patient_self_report';
  dyspnea_worse_than_usual: boolean | null; cough_worse_than_usual: boolean | null;
  sputum_change: boolean | null; reported_symptom_start_at: string | null;
  clinical_validation: false;
}
export const EMPTY_ANSWERS: Answers = { dyspnea_worse_than_usual: '', cough_worse_than_usual: '', sputum_change: '' };
const KEY = 'pulmira-fictional-check-ins-v1';
export function answerValue(answer: Answer): boolean | null {
  if (!['yes', 'no', 'unsure'].includes(answer)) throw new Error('Please answer every question. You can choose Unsure.');
  return answer === 'unsure' ? null : answer === 'yes';
}
export function onsetTimestamp(local: string, offset: string, collectedAt: string): string | null {
  if (!local) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local) || !['+00:00', '+05:30', '+01:00', '+02:00'].includes(offset)) throw new Error('Enter a complete symptom-start date and time, or leave it blank.');
  const calendar = new Date(local + 'Z');
  if (!Number.isFinite(calendar.getTime()) || calendar.toISOString().slice(0,16) !== local) throw new Error('Enter a valid symptom-start date and time, or leave it blank.');
  const parsed = Date.parse(local + offset);
  if (!Number.isFinite(parsed) || parsed > Date.parse(collectedAt)) throw new Error('The symptom-start time must be at or before this check-in.');
  return new Date(parsed).toISOString();
}
export function createCheckIn(patientId: string, origin: DemoOrigin, answers: Answers, onset: string, offset: string, now = new Date().toISOString(), id = crypto.randomUUID()): BrowserCheckIn {
  if (origin !== 'synthetic' || !patientId.startsWith('DEMO-SYNTHETIC-')) throw new Error('Check-in practice is available only for the fictional demonstration profile.');
  const values = Object.fromEntries(SYMPTOM_FIELDS.map(field => [field, answerValue(answers[field])])) as Pick<BrowserCheckIn, SymptomField>;
  return { schema_version: 'pulmira-browser-check-in-1.0.0', id, patient_id: patientId, data_origin: 'synthetic', client_collected_at: now, stored_locally_at: now, server_received_at: null, delivery_status: 'browser_only', reporter: 'patient_self_report', ...values, reported_symptom_start_at: onsetTimestamp(onset, offset, now), clinical_validation: false };
}
export interface CheckInStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }
export function readCheckIns(storage: CheckInStorage, patientId: string): BrowserCheckIn[] {
  const value: unknown = JSON.parse(storage.getItem(KEY) || '[]');
  if (!Array.isArray(value) || value.some(row => !row || row.schema_version !== 'pulmira-browser-check-in-1.0.0' || row.data_origin !== 'synthetic' || !row.patient_id?.startsWith('DEMO-SYNTHETIC-') || row.delivery_status !== 'browser_only' || row.server_received_at !== null || row.clinical_validation !== false || row.reporter !== 'patient_self_report' || typeof row.id !== 'string' || !row.id || !Number.isFinite(Date.parse(row.client_collected_at)) || SYMPTOM_FIELDS.some(field => row[field] !== null && typeof row[field] !== 'boolean'))) throw new Error('The browser demo history could not be read. No entry has been overwritten.');
  return value.filter(row => row.patient_id === patientId).sort((a, b) => b.client_collected_at.localeCompare(a.client_collected_at));
}
export function persistCheckIn(storage: CheckInStorage, entry: BrowserCheckIn) {
  if (entry.data_origin !== 'synthetic' || !entry.patient_id.startsWith('DEMO-SYNTHETIC-') || entry.delivery_status !== 'browser_only' || entry.server_received_at !== null || entry.clinical_validation !== false) throw new Error('Only fictional browser demo entries can be saved.');
  // Validate the entire store before writing; never overwrite an unreadable history.
  readCheckIns(storage, entry.patient_id);
  const all = JSON.parse(storage.getItem(KEY) || '[]') as BrowserCheckIn[];
  if (all.some(row => row.id === entry.id)) throw new Error('This demo entry has already been saved.');
  if (all.length >= 100) throw new Error('This browser has reached its 100-entry demo limit. Export the history before starting another demo session.');
  const serialized = JSON.stringify([...all, entry]);
  storage.setItem(KEY, serialized);
  if (storage.getItem(KEY) !== serialized) throw new Error('This browser could not confirm the save. Please retry.');
}
