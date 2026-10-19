import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { answerValue, createCheckIn, EMPTY_ANSWERS, onsetTimestamp, persistCheckIn, readCheckIns } from '../src/lib/checkins.ts';
import type { BrowserCheckIn, CheckInStorage } from '../src/lib/checkins.ts';
import { chartSegments, seriesKey, validateHistory, visibleObservations } from '../src/lib/patient-data.ts';
import type { PatientHistory } from '../src/lib/patient-data.ts';

const now = '2026-10-16T12:00:00.000Z';
const answers = { dyspnea_worse_than_usual:'yes', cough_worse_than_usual:'no', sputum_change:'unsure' } as const;
function store(): CheckInStorage { const values = new Map<string,string>(); return { getItem:key => values.get(key) ?? null, setItem:(key,value) => { values.set(key,value); } }; }
const history = JSON.parse(readFileSync(new URL('../public/data/patients/DEMO-SYNTHETIC-002.json',import.meta.url),'utf8')) as PatientHistory;

test('unknown is null, false stays false, unanswered is rejected', () => {
  assert.equal(answerValue('unsure'),null); assert.equal(answerValue('no'),false); assert.equal(answerValue('yes'),true);
  assert.throws(() => createCheckIn('DEMO-SYNTHETIC-002','synthetic',EMPTY_ANSWERS,'','+00:00',now,'test-empty'),/answer every question/);
});
test('source participants cannot create or persist demo check-ins', () => {
  assert.throws(() => createCheckIn('GER-002','real_open',answers,'','+00:00',now,'test-real'),/fictional/);
  const forged = { ...createCheckIn('DEMO-SYNTHETIC-002','synthetic',answers,'','+00:00',now,'test-forged'), patient_id:'GER-002' };
  assert.throws(() => persistCheckIn(store(),forged),/fictional/);
});
test('optional onset preserves null and normalizes explicit timezones; invalid/future times are rejected', () => {
  assert.equal(onsetTimestamp('','+00:00',now),null);
  assert.equal(onsetTimestamp('2026-10-16T15:00','+05:30',now),'2026-10-16T09:30:00.000Z');
  assert.throws(() => onsetTimestamp('2026-10-17T15:00','+00:00',now),/before/);
  assert.throws(() => onsetTimestamp('2026-02-30T10:00','+00:00',now),/valid/);
  assert.throws(() => onsetTimestamp('2026-10-16','+00:00',now),/complete/);
});
test('browser-only persistence survives reads, preserves unknown and has no forged server receipt', () => {
  const storage = store();
  const entry = createCheckIn('DEMO-SYNTHETIC-002','synthetic',answers,'','+00:00',now,'test-persist');
  persistCheckIn(storage,entry);
  assert.deepEqual(readCheckIns(storage,entry.patient_id),[entry]);
  assert.equal(entry.sputum_change,null); assert.equal(entry.cough_worse_than_usual,false);
  assert.equal(entry.server_received_at,null); assert.equal(entry.delivery_status,'browser_only');
  assert.equal(readCheckIns(storage,'GER-002').length,0);
  assert.throws(() => persistCheckIn(storage,entry),/already/);
});
test('storage failures do not produce successful saves; corrupt histories are not overwritten', () => {
  const entry = createCheckIn('DEMO-SYNTHETIC-002','synthetic',answers,'','+00:00',now,'test-failure');
  assert.throws(() => persistCheckIn({getItem:()=>null,setItem:()=>{throw new Error('quota');}},entry),/quota/);
  assert.throws(() => persistCheckIn({getItem:()=>null,setItem:()=>{}},entry),/confirm the save/);
  let written = false;
  assert.throws(() => persistCheckIn({getItem:()=>'{corrupt',setItem:()=>{written=true;}},entry));
  assert.equal(written,false);
  const fake = { ...entry, data_origin:'real_open' } as unknown as BrowserCheckIn;
  assert.throws(() => readCheckIns({getItem:()=>JSON.stringify([fake]),setItem:()=>{}},entry.patient_id),/could not be read/);
});
test('history identity, timeline order and forecast invariants are validated', () => {
  validateHistory(history,'DEMO-SYNTHETIC-002','synthetic');
  assert.throws(() => validateHistory(history,'ITA-004','real_open'),/does not match/);
  const bad = structuredClone(history); bad.snapshots[0].channels[0].available_at = '2099-01-01T00:00:00Z';
  assert.throws(() => validateHistory(bad,'DEMO-SYNTHETIC-002','synthetic'),/not yet available/);
});
test('visible charts respect both measurement and receipt times, separate streams and preserve long gaps', () => {
  const first = history.observations[0];
  const late = { ...first, observation_id:'late-test', available_at:'2099-01-01T00:00:00Z' };
  const future = { ...first, observation_id:'future-test', measurement_end:'2099-01-01T00:00:00Z' };
  const invalid = { ...first, observation_id:'invalid-test', validity:0 };
  assert.deepEqual(visibleObservations([first,late,future,invalid],history.finalAsOf),[first]);
  assert.notEqual(seriesKey(first),seriesKey({...first,context:'another-context'}));
  assert.notEqual(seriesKey(first),seriesKey({...first,source_series_id:'different-stream',device_id:null}));
  const later = {...first,observation_id:'later',measurement_end:new Date(Date.parse(first.measurement_end)+4*86400000).toISOString()};
  assert.deepEqual(chartSegments([first,later]).map(group=>group.length),[1,1]);
});
