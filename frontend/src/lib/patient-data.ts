import { apiJson, identityKey } from './api.ts';
import { useDemoSession } from './monitoring.ts';
import { useEffect, useState } from 'react';
import { detailedTimestamp } from './preferences.ts';
import type { DisplayZone } from './preferences';
import { getPreferenceSnapshot } from './use-preferences.ts';
import type { DemoOrigin, PatientState } from './monitoring';

export interface Observation {
  observation_id: string; patient_id: string; data_origin: DemoOrigin;
  channel: string; units: string; value: number; context: string;
  source_series_id: string; device_id: string | null; measurement_start: string | null;
  measurement_end: string; available_at: string; validity: number;
  time_evidence: string; window_evidence: string;
}
export interface DiaryReport {
  diary_id: string; patient_id: string; collected_at: string; available_at: string;
  dyspnea_worse_than_usual: boolean | null; cough_worse_than_usual: boolean | null;
  sputum_change: boolean | null; reported_symptom_start_at: string | null;
  data_origin: DemoOrigin; reporter: string; freshness?: string;
}
export interface PatientHistory {
  schemaVersion: string; patientId: string; origin: DemoOrigin; finalAsOf: string;
  samplingNote: string; clockNote: string; provenance: Record<string, string>;
  observations: Observation[]; snapshots: PatientState[];
}
const historyCache = new Map<string, PatientHistory>();

export function validateHistory(value: unknown, patientId: string, origin: DemoOrigin): asserts value is PatientHistory {
  if (!value || typeof value !== 'object') throw new Error('This patient history could not be read.');
  const data = value as PatientHistory;
  if (data.schemaVersion !== 'pulmira-patient-history-1.0.0' || data.patientId !== patientId || data.origin !== origin || !Array.isArray(data.observations) || !Array.isArray(data.snapshots) || !data.snapshots.length) throw new Error('The history does not match this patient and source.');
  for (const row of data.observations) if (row.patient_id !== patientId || row.data_origin !== origin || !Number.isFinite(row.value) || !Number.isFinite(Date.parse(row.measurement_end)) || !Number.isFinite(Date.parse(row.available_at))) throw new Error('The observation history failed its identity or timing checks.');
  let previous = -Infinity;
  for (const state of data.snapshots) {
    const time = Date.parse(state.as_of);
    if (state.patient_id !== patientId || state.data_origin !== origin || !Number.isFinite(time) || time <= previous || !Array.isArray(state.channels) || state.risk?.probability_next_7_days !== null || state.risk?.status !== 'unavailable' || state.risk?.clinical_validation !== false) throw new Error('The historical snapshots failed their checks.');
    if (state.channels.some(row => !Number.isFinite(Date.parse(row.measurement_end)) || !Number.isFinite(Date.parse(row.available_at)) || Date.parse(row.measurement_end) > time || Date.parse(row.available_at) > time)) throw new Error('A snapshot contains observations not yet available at that time.');
    previous = time;
  }
  if (data.snapshots.at(-1)?.as_of !== data.finalAsOf) throw new Error('The final historical snapshot is missing.');
}

export function usePatientHistory(patientId: string, origin: DemoOrigin) {
  useDemoSession();
  const key = `${identityKey()}:${origin}:${patientId}`;
  const [result, setResult] = useState<{ key: string; data?: PatientHistory; error?: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const cached = historyCache.get(key);
    if (cached) return;
    apiJson<unknown>(`/patients/${encodeURIComponent(patientId)}/history?origin=${origin}`, {signal:controller.signal}).then(value => {
            validateHistory(value, patientId, origin);
      if (!controller.signal.aborted) { historyCache.set(key, value); setResult({ key, data: value }); }
    }).catch((reason: unknown) => { if (!controller.signal.aborted) setResult({ key, error: reason instanceof Error ? reason.message : 'Unable to load patient history.' }); });
    return () => controller.abort();
  }, [key, patientId, origin, attempt]);
  return { history: historyCache.get(key) || (result?.key === key ? result.data : undefined), error: result?.key === key ? result.error || '' : '', retry: () => { setResult({ key }); setAttempt(value => value + 1); } };
}

export function seriesKey(row: Pick<Observation, 'channel' | 'context' | 'device_id' | 'source_series_id'>) {
  return `${row.channel}|${row.context}|${row.device_id ? `device:${row.device_id}` : `source:${row.source_series_id}`}`;
}
export function visibleObservations(rows: Observation[], asOf: string) {
  const time = Date.parse(asOf);
  return rows.filter(row => row.validity === 1 && Date.parse(row.measurement_end) <= time && Date.parse(row.available_at) <= time);
}
export function chartSegments(rows: Observation[], maxGapHours = 48) {
  const segments: Observation[][] = [];
  for (const row of rows) {
    const last = segments.at(-1);
    if (!last || Date.parse(row.measurement_end) - Date.parse(last.at(-1)!.measurement_end) > maxGapHours * 3600000) segments.push([row]);
    else last.push(row);
  }
  return segments;
}
export function diaryFromState(state: PatientState): DiaryReport | null {
  return state.symptom_diary.latest as DiaryReport | null;
}
export function timestamp(value: string, timeZone:DisplayZone=getPreferenceSnapshot().preferences.timeZone) {
  return detailedTimestamp(value,timeZone);
}
