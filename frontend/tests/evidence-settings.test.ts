import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {clearPreferences,DEFAULT_PREFERENCES,detailedTimestamp,PREFERENCES_KEY,readPreferences,validatePreferences,writePreferences} from '../src/lib/preferences.ts';
import type {PreferenceStore} from '../src/lib/preferences.ts';
import {FAQS,searchHelp,validateProjectEvidence} from '../src/lib/evidence-content.ts';
const evidence=JSON.parse(readFileSync(new URL('../public/data/project-evidence.json',import.meta.url),'utf8'));
const archive=JSON.parse(readFileSync(new URL('../public/data/pulmira-archive.json',import.meta.url),'utf8'));
function store():PreferenceStore{const values=new Map<string,string>();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>{values.set(key,value);},removeItem:key=>{values.delete(key);}};}

test('display preferences round-trip with source-safe defaults and a verified saved state',()=>{
 const s=store();assert.deepEqual(readPreferences(s),{preferences:DEFAULT_PREFERENCES,saved:false});
 const p={timeZone:'Asia/Kolkata',motion:'reduce',spacing:'compact'} as const;
 assert.deepEqual(writePreferences(s,p),{preferences:p,saved:true});assert.deepEqual(readPreferences(s).preferences,p);
 assert.throws(()=>validatePreferences({...p,timeZone:'Unknown/Zone'}),/unsupported/);
 assert.throws(()=>validatePreferences({...p,probability:0.8}),/unsupported/);
});
test('storage errors, silent writes and corrupt preferences cannot produce a confirmed save',()=>{
 const denied={getItem:()=>null,setItem:()=>{throw new Error('Quota denied');},removeItem:()=>{}};
 assert.throws(()=>writePreferences(denied,{...DEFAULT_PREFERENCES}),/Quota/);
 const silent={getItem:()=>null,setItem:()=>{},removeItem:()=>{}};assert.throws(()=>writePreferences(silent,{...DEFAULT_PREFERENCES}),/did not confirm/);
 const broken=store();broken.setItem(PREFERENCES_KEY,'{bad');assert.throws(()=>writePreferences(broken,{...DEFAULT_PREFERENCES}),/not been overwritten/);assert.equal(broken.getItem(PREFERENCES_KEY),'{bad');
});
test('reset removes only display preferences, retaining check-ins, review marks and unrelated data',()=>{
 const s=store();s.setItem('pulmira-review-seen-v1','seen');s.setItem('pulmira-check-ins','checkins');s.setItem('other','unrelated');writePreferences(s,{timeZone:'Europe/London',motion:'reduce',spacing:'compact'});
 assert.deepEqual(clearPreferences(s),{preferences:DEFAULT_PREFERENCES,saved:false});assert.equal(s.getItem('pulmira-review-seen-v1'),'seen');assert.equal(s.getItem('pulmira-check-ins'),'checkins');assert.equal(s.getItem('other'),'unrelated');
});
test('timestamp display handles half-hour offsets, date rollover and DST without changing the source instant',()=>{
 const source='2025-03-01T23:30:00Z',original=source;
 assert.equal(detailedTimestamp(source,'Asia/Kolkata'),'2 Mar 2025, 05:00 Asia/Kolkata');
 assert.equal(detailedTimestamp('2025-01-01T13:00:00Z','America/New_York'),'1 Jan 2025, 08:00 America/New_York');
 assert.equal(detailedTimestamp('2025-07-01T13:00:00Z','America/New_York'),'1 Jul 2025, 09:00 America/New_York');
 assert.equal(detailedTimestamp(source,'UTC'),'1 Mar 2025, 23:30 UTC');assert.equal(source,original);assert.equal(detailedTimestamp('bad'),'Unknown time');
});
test('evidence source counts and hashes match the current frontend while earlier research stays distinct',()=>{
 validateProjectEvidence(evidence);assert.equal(evidence.source.participants,archive.sourceStates.length);assert.equal(evidence.source.archiveSha256,archive.sourceSha256);assert.equal(evidence.source.fictionalExamples,archive.syntheticStates.length);
 assert.equal(evidence.experiments[0].rows,1056);assert.equal(evidence.experiments[0].positiveWindows,26);assert.equal(evidence.experiments[0].recall,0);assert.ok(evidence.experiments[0].accuracy<evidence.experiments[0].noEventAccuracy);assert.match(evidence.experiments[0].cohort,/74-participant/);
 assert.equal(evidence.experiments[1].origin,'synthetic');assert.equal(evidence.simulator.liveExecution,false);
});
test('evidence rejects clinical-validation claims, source substitutions and invalid research metrics',()=>{
 const bad=structuredClone(evidence);bad.clinicalValidation=true;assert.throws(()=>validateProjectEvidence(bad),/source or version/);
 const count=structuredClone(evidence);count.source.participants=74;assert.throws(()=>validateProjectEvidence(count),/source or version/);
 const metric=structuredClone(evidence);metric.experiments[0].recall=NaN;assert.throws(()=>validateProjectEvidence(metric),/metrics/);
});
test('help search combines categories, preserves answer identity and handles empty results',()=>{
 assert.equal(searchHelp('', 'All').length,FAQS.length);assert.ok(searchHelp('FORECAST','Interpretation').some(row=>row.id==='forecast'));assert.ok(searchHelp('browser','Privacy').every(row=>row.category==='Privacy'));assert.deepEqual(searchHelp('zzqnonexistent'),[]);assert.equal(new Set(FAQS.map(row=>row.id)).size,FAQS.length);
});
