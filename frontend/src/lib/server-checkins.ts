import { apiJson, postJson } from './api.ts';
import type { BrowserCheckIn } from './checkins';
import type { DiaryReport } from './patient-data';
export type ServerCheckIn=Omit<BrowserCheckIn,'schema_version'|'server_received_at'|'delivery_status'|'stored_locally_at'>&{schema_version:'pulmira-server-check-in-1.0.0';server_received_at:string;delivery_status:'server_received';stored_at_server:string};
export type ExportCheckIn=BrowserCheckIn|ServerCheckIn;
export function receivedCheckIn(d:DiaryReport,patientId:string,storedAt?:string):ServerCheckIn{
 if(d.patient_id!==patientId||d.data_origin!=='synthetic'||!Number.isFinite(Date.parse(d.collected_at))||!Number.isFinite(Date.parse(d.available_at))||Date.parse(d.collected_at)>Date.parse(d.available_at)||['dyspnea_worse_than_usual','cough_worse_than_usual','sputum_change'].some(k=>d[k as keyof DiaryReport]!==null&&typeof d[k as keyof DiaryReport]!=='boolean'))throw new Error('The check-in receipt failed identity, answers or clock checks.');
 return {schema_version:'pulmira-server-check-in-1.0.0',id:d.diary_id,patient_id:patientId,data_origin:'synthetic',client_collected_at:d.collected_at,stored_at_server:storedAt||d.available_at,server_received_at:d.available_at,delivery_status:'server_received',reporter:'patient_self_report',dyspnea_worse_than_usual:d.dyspnea_worse_than_usual,cough_worse_than_usual:d.cough_worse_than_usual,sputum_change:d.sputum_change,reported_symptom_start_at:d.reported_symptom_start_at,clinical_validation:false};
}
export async function submitCheckIn(entry:BrowserCheckIn){
 const result=await postJson<{diary:DiaryReport}>(`/patients/${encodeURIComponent(entry.patient_id)}/diaries?origin=synthetic`,{collected_at:entry.client_collected_at,dyspnea_worse_than_usual:entry.dyspnea_worse_than_usual,cough_worse_than_usual:entry.cough_worse_than_usual,sputum_change:entry.sputum_change,reported_symptom_start_at:entry.reported_symptom_start_at,client_request_id:entry.id});
 return receivedCheckIn(result.diary,entry.patient_id);
}
export async function checkInHistory(patientId:string,signal?:AbortSignal){
 const asOf=new Date().toISOString();const rows:ServerCheckIn[]=[];let offset=0,total=0;
 do{const result=await apiJson<{patient_id:string;data_origin:string;total:number;items:{diary:DiaryReport;receipt_clock:string;stored_at:string}[]}>(`/patients/${encodeURIComponent(patientId)}/diaries?origin=synthetic&as_of=${encodeURIComponent(asOf)}&limit=500&offset=${offset}`,{signal});
  if(result.patient_id!==patientId||result.data_origin!=='synthetic')throw new Error('The check-in history belongs to another profile.');
  total=result.total;for(const item of result.items)if(item.receipt_clock==='server_utc')rows.push(receivedCheckIn(item.diary,patientId,item.stored_at));
  offset+=result.items.length;if(!result.items.length&&offset<total)throw new Error('The backend returned an incomplete check-in history.');
 }while(offset<total);
 return rows;
}
