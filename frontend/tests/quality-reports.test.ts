import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { availableRecords,dailyPresence,qualityRows,recentUtcDays,sourceInventory } from '../src/lib/quality.ts';
import { buildMonitoringReport,reportTextValue } from '../src/lib/report-data.ts';
import { patientPath,qualityPath,reportPath,snapshotIndex } from '../src/lib/record-routes.ts';
import type { PatientHistory } from '../src/lib/patient-data.ts';
import type { Archive } from '../src/lib/monitoring.ts';

const history=(id:string)=>JSON.parse(readFileSync(new URL(`../public/data/patients/${id}.json`,import.meta.url),'utf8')) as PatientHistory;
const real=JSON.parse(readFileSync(new URL('./fixtures/multi-history.json',import.meta.url),'utf8')) as PatientHistory,fictional=history('DEMO-SYNTHETIC-002'),empty=JSON.parse(readFileSync(new URL('./fixtures/empty-history.json',import.meta.url),'utf8')) as PatientHistory;
const archive=JSON.parse(readFileSync(new URL('../public/data/pulmira-archive.json',import.meta.url),'utf8')) as Archive;
const generated='2026-10-16T19:00:00.000Z';

test('quality preserves separate heart-rate contexts and does not count source IDs as devices',()=>{
  const state=real.snapshots.at(-1)!;
  const rows=qualityRows(state,real.observations);
  assert.equal(rows.filter(row=>row.channel==='heart_rate_bpm').length,3);
  const inventory=sourceInventory(state);assert.equal(inventory.length,3);assert.ok(inventory.every(row=>row.deviceId===null));
  assert.equal(sourceInventory(fictional.snapshots.at(-1)!).length,1);
});
test('missing channels remain rows with unknown streams, not fabricated normal measurements',()=>{
  const rows=qualityRows(empty.snapshots[0],empty.observations);
  assert.equal(rows.length,6);assert.ok(rows.every(row=>row.status==='missing'&&row.stream===null));
  assert.ok(dailyPresence(empty.snapshots[0],[]).every(row=>row.days.every(day=>day.present===false)));
});
test('daily presence respects measurement AND availability time, UTC boundaries and validity',()=>{
  const state=structuredClone(fictional.snapshots.at(-1)!);state.as_of='2025-03-01T13:00:00Z';
  const row=fictional.observations[0];
  const available={...row,measurement_end:'2025-03-01T00:30:00+02:00',available_at:'2025-03-01T12:00:00Z'};
  const late={...row,observation_id:'late',measurement_end:'2025-03-01T12:00:00Z',available_at:'2025-03-01T14:00:00Z'};
  const future={...row,observation_id:'future',measurement_end:'2025-03-02T12:00:00Z',available_at:'2025-03-01T12:00:00Z'};
  const invalid={...row,observation_id:'invalid',measurement_end:'2025-03-01T11:00:00Z',available_at:'2025-03-01T12:00:00Z',validity:0};
  assert.deepEqual(availableRecords([available,late,future,invalid],state),[available,invalid]);
  const days=dailyPresence(state,[available,late,future,invalid]).find(item=>item.channel===row.channel)!.days;
  assert.equal(days.find(day=>day.date==='2025-02-28')!.present,true);
  assert.equal(days.find(day=>day.date==='2025-03-01')!.present,false);
  assert.deepEqual(recentUtcDays(state.as_of),['2025-02-23','2025-02-24','2025-02-25','2025-02-26','2025-02-27','2025-02-28','2025-03-01']);
});
test('historical links preserve exact identity/time and reject unavailable decisions instead of substituting final',()=>{
  const time=real.snapshots[0].as_of;
  for(const link of [patientPath('GER-002',time),qualityPath('GER-002',time),reportPath('GER-002',time)])assert.equal(new URL(link,'https://example.test').searchParams.get('asOf'),time);
  assert.equal(snapshotIndex(real,time),0);assert.equal(snapshotIndex(real,null),real.snapshots.length-1);
  assert.equal(snapshotIndex(real,''),-1);assert.equal(snapshotIndex(real,'2099-01-01T00:00:00Z'),-1);assert.equal(snapshotIndex(real,'not-a-date'),-1);
});
test('report exports preserve the full selected state, unavailable risk and independent client generation clock',()=>{
  const before=JSON.stringify(real);
  const report=buildMonitoringReport(real,0,archive,generated);
  assert.deepEqual(report.state,real.snapshots[0]);assert.equal(report.as_of,real.snapshots[0].as_of);
  assert.equal(report.generated_at_client,generated);assert.equal(report.state.channels.length,real.snapshots[0].channels.length);
  assert.equal(report.state.risk.probability_next_7_days,null);assert.equal(report.clinician_reviewed,false);assert.equal(report.server_connected,false);
  assert.equal(report.browser_demo_check_ins_included,false);assert.equal(JSON.stringify(real),before);
  report.state.channels[0].value=-123;assert.notEqual(real.snapshots[0].channels[0].value,-123);
});
test('report construction rejects mismatched identity, future observations, future diaries and clinical-risk claims',()=>{
  const bad=structuredClone(real);bad.patientId='ITA-004';assert.throws(()=>buildMonitoringReport(bad,0,archive,generated),/does not match/);
  const future=structuredClone(real);future.snapshots[0].channels[0].available_at='2099-01-01T00:00:00Z';assert.throws(()=>buildMonitoringReport(future,0,archive,generated),/unavailable/);
  const diary=structuredClone(fictional);(diary.snapshots.at(-1)!.symptom_diary.latest as {available_at:string}).available_at='2099-01-01T00:00:00Z';assert.throws(()=>buildMonitoringReport(diary,diary.snapshots.length-1,archive,generated),/diary/);
  const risk=structuredClone(real);risk.snapshots[0].risk.clinical_validation=true as never;assert.throws(()=>buildMonitoringReport(risk,0,archive,generated),/forecast/);
});
test('report diary preserves false/null, excludes current browser entries and changes reference by decision',()=>{
  const first=buildMonitoringReport(fictional,0,archive,generated),last=buildMonitoringReport(fictional,fictional.snapshots.length-1,archive,generated);
  assert.equal(first.state.symptom_diary.latest,null);assert.notEqual(first.reference,last.reference);
  assert.equal(reportTextValue(false),'No');assert.equal(reportTextValue(null),'Unknown / unsure');
  const diary=last.state.symptom_diary.latest as {cough_worse_than_usual:boolean;sputum_change:null};
  assert.equal(diary.cough_worse_than_usual,false);assert.equal(diary.sputum_change,null);assert.equal(last.browser_demo_check_ins_included,false);
});
