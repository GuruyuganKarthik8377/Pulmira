import { apiJson, postJson } from './api.ts';
import { SIM_CHANNELS, SIM_REPORT_KEYS } from './simulator-data.ts';
import type { SimRow } from './simulator-data';
interface Trace {synthetic_profile_id:string;scenario_id:string;scenario_version:string;clinical_validation:false;fictional:true;series:{channel:string;points:{day:number;simulated_date:string;value:number|null;observed:boolean}[]}[]}
export function simulationRows(trace:Trace,profile:string,scenario:string):SimRow[]{
 if(trace.synthetic_profile_id!==profile||trace.scenario_id!==scenario||trace.scenario_version!=='synthetic_copd_v2'||trace.clinical_validation!==false||trace.fictional!==true)throw new Error('The simulator response does not match the selected fictional run.');
 const channels=[...Object.keys(SIM_CHANNELS),...SIM_REPORT_KEYS];
 if(trace.series.length!==channels.length||new Set(trace.series.map(s=>s.channel)).size!==channels.length||trace.series.some(s=>!channels.includes(s.channel)))throw new Error('The run has missing or non-observable channels.');
 const rows=Array.from({length:180},(_,day)=>({day,date:new Date(Date.parse('2025-02-01T00:00:00Z')+day*86400000).toISOString().slice(0,10)}) as SimRow);
 for(const series of trace.series){if(series.points.length!==180)throw new Error('The selected run calendar is incomplete.');for(let i=0;i<180;i++){const p=series.points[i];if(p.day!==i||p.simulated_date!==rows[i].date||p.observed!==(p.value!==null)||(p.value!==null&&!Number.isFinite(p.value)))throw new Error('The run has invalid dates, values or observation flags.');rows[i][series.channel as keyof typeof SIM_CHANNELS]=p.value;}}
 return rows;
}
export async function runComparison(profile:string,scenario:string,signal?:AbortSignal){
 const runs=[];
 for(const name of [...new Set(['source_reference',scenario])])runs.push(await postJson<{status:string;cached:boolean;run_id:string|null}>(`/demo/scenarios/${encodeURIComponent(name)}/runs`,{profile_id:profile},signal));
 const get=async(name:string)=>simulationRows(await apiJson<Trace>(`/demo/scenarios/${encodeURIComponent(name)}/trace?profile_id=${encodeURIComponent(profile)}&scenario_version=synthetic_copd_v2&from_day=0&to_day=179`,{signal}),profile,name);
 const reference=await get('source_reference'),variant=scenario==='source_reference'?reference:await get(scenario);
 return {profile,scenario,reference,variant,runs};
}
