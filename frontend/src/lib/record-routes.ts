import type { PatientHistory } from './patient-data';

const timeQuery = (asOf?: string | null) => asOf == null ? '' : `asOf=${encodeURIComponent(asOf)}`;
export function patientPath(id: string, asOf?: string | null) { const time = timeQuery(asOf); return `/app/patients/${encodeURIComponent(id)}${time ? `?${time}` : ''}`; }
export function qualityPath(id: string, asOf?: string | null) { const time = timeQuery(asOf); return `/app/data-quality?patient=${encodeURIComponent(id)}${time ? `&${time}` : ''}`; }
export function reportPath(id: string, asOf?: string | null) { const time = timeQuery(asOf); return `/app/patients/${encodeURIComponent(id)}/report${time ? `?${time}` : ''}`; }
export function snapshotIndex(history: PatientHistory, requested: string | null): number {
  if (requested === null) return history.snapshots.length - 1;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(requested)) return -1;
  const value = Date.parse(requested);
  return Number.isFinite(value) ? history.snapshots.findIndex(row => Date.parse(row.as_of) === value) : -1;
}

export function reportsPath(id:string,asOf?:string|null) {const time=timeQuery(asOf);return `/app/reports?patient=${encodeURIComponent(id)}${time?`&${time}`:''}`;}
