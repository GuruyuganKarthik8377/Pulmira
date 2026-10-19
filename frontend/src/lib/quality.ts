import type { Channel, PatientState } from './monitoring';
import type { Observation } from './patient-data';

export const QUALITY_CHANNELS = ['spo2_pct','heart_rate_bpm','respiratory_rate_per_min','sleep_hours','gait_speed_m_per_s','aqi_index'] as const;
export interface QualityRow {
  key: string; channel: string; stream: Channel | null; status: 'fresh' | 'stale' | 'invalid' | 'missing';
  observedDays7: number; eligibleRecords: number; invalidRecords: number;
}
export const streamIdentity = (row: Pick<Observation,'channel'|'context'|'device_id'|'source_series_id'>) => `${row.channel}|${row.context}|${row.device_id ? `device:${row.device_id}` : `source:${row.source_series_id}`}`;
export function availableRecords(records: Observation[], state: PatientState) {
  const time = Date.parse(state.as_of);
  return records.filter(row => row.patient_id === state.patient_id && row.data_origin === state.data_origin && Date.parse(row.measurement_end) <= time && Date.parse(row.available_at) <= time);
}
export function recentUtcDays(asOf: string, count = 7) {
  const start = new Date(asOf); start.setUTCHours(0,0,0,0);
  return Array.from({ length:count },(_,i) => new Date(start.getTime()-(count-1-i)*86400000).toISOString().slice(0,10));
}
const utcDay=(value:string)=>new Date(value).toISOString().slice(0,10);
export function qualityRows(state: PatientState, records: Observation[]): QualityRow[] {
  const available = availableRecords(records,state), days = new Set(recentUtcDays(state.as_of));
  return QUALITY_CHANNELS.flatMap<QualityRow>(channel => {
    const streams = state.channels.filter(row => row.channel === channel);
    if (!streams.length) return [{ key:`missing:${channel}`,channel,stream:null,status:'missing',observedDays7:0,eligibleRecords:0,invalidRecords:0 }];
    return streams.map(stream => {
      const rows = available.filter(row => streamIdentity(row) === streamIdentity(stream));
      return { key:streamIdentity(stream),channel,stream,status:stream.freshness,observedDays7:new Set(rows.filter(row => row.validity === 1 && days.has(utcDay(row.measurement_end))).map(row => utcDay(row.measurement_end))).size,eligibleRecords:rows.length,invalidRecords:rows.filter(row => row.validity !== 1).length };
    });
  });
}
export function dailyPresence(state: PatientState, records: Observation[]) {
  const available = availableRecords(records,state).filter(row => row.validity === 1);
  return QUALITY_CHANNELS.map(channel => ({ channel,days:recentUtcDays(state.as_of).map(date => ({ date,present:available.some(row => row.channel === channel && utcDay(row.measurement_end) === date) })) }));
}
export function sourceInventory(state: PatientState) {
  const grouped = new Map<string,{ key:string; deviceId:string|null; seriesIds:string[]; streams:Channel[] }>();
  for (const stream of state.channels) {
    const key = stream.device_id ? `device:${stream.device_id}` : `source:${stream.source_series_id}`;
    const group = grouped.get(key) || { key,deviceId:stream.device_id,seriesIds:[],streams:[] };
    group.streams.push(stream); if (!group.seriesIds.includes(stream.source_series_id)) group.seriesIds.push(stream.source_series_id);
    grouped.set(key,group);
  }
  return [...grouped.values()];
}
export function qualityPacket(state: PatientState, records: Observation[]) {
  const rows = qualityRows(state,records);
  return { schema_version:'pulmira-data-quality-view-1.0.0',patient_id:state.patient_id,data_origin:state.data_origin,as_of:state.as_of,clinical_validation:false,live_connection:false,rows,daily_presence:dailyPresence(state,records),source_inventory:sourceInventory(state),available_record_count:availableRecords(records,state).length,interpretation:'Observed-day presence is not wear-time adherence or predictive accuracy. Device IDs are metadata, not connection evidence.' };
}
