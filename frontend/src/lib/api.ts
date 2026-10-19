/** Same-origin API only. Demo grants are scoped to the selected role; no static-data fallback. */
export interface ApiIdentity { role:'clinician'|'patient'; patientId:string }
let identity:ApiIdentity={role:'clinician',patientId:'GER-001'};
let generation=0;
let grant:Promise<{token:string;expires_at:string}>|null=null;
export const identityKey=()=>identity.role==='patient'?`patient:${identity.patientId}`:'clinician';
export function setApiIdentity(next:ApiIdentity){
 const key=identityKey();identity={...next};if(key!==identityKey()){generation++;grant=null;}
}
export class ApiError extends Error {status:number;code:string;constructor(message:string,status=0,code='connection_failed'){super(message);this.status=status;this.code=code;}}
async function raw(path:string,options:RequestInit={}){
 const timeout=AbortSignal.timeout(30000);
 try{return await fetch('/api/v1'+path,{...options,signal:options.signal?AbortSignal.any([options.signal,timeout]):timeout,headers:{Accept:'application/json',...options.headers}});}
 catch(error){if(options.signal?.aborted)throw error;throw new ApiError('Pulmira could not reach the backend. Start the local application and retry.');}
}
async function failure(response:Response):Promise<never>{
 let message=`The backend returned ${response.status}.`,code='request_failed';
 try{const value=await response.json();message=value.error?.message||message;code=value.error?.code||code;}catch{/* Non-JSON proxy errors remain explicit. */}
 throw new ApiError(message,response.status,code);
}
async function token():Promise<string>{
 if(!grant){const selected={...identity},version=generation;grant=(async()=>{
  const response=await raw('/auth/demo-session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({role:selected.role,...(selected.role==='patient'?{patient_id:selected.patientId}:{})})});
  if(!response.ok)return failure(response);const value=await response.json();
  if(typeof value.token!=='string'||!Number.isFinite(Date.parse(value.expires_at)))throw new ApiError('The demo session response was invalid.');
  return value as {token:string;expires_at:string};
 })().catch(error=>{if(version===generation)grant=null;throw error;});}
 const current=await grant;if(Date.parse(current.expires_at)<Date.now()+5000){grant=null;return token();}return current.token;
}
export async function apiResponse(path:string,options:RequestInit={}){
 const version=generation;
 for(let attempt=0;attempt<2;attempt++){
  const bearer=await token();if(version!==generation)throw new ApiError('The demo perspective changed. Reload the selected view.',409,'session_changed');
  const response=await raw(path,{...options,headers:{...options.headers,Authorization:'Bearer '+bearer}});
  if(version!==generation)throw new ApiError('The demo perspective changed. Reload the selected view.',409,'session_changed');
  if(response.status===401&&attempt===0){grant=null;continue;}
  if(!response.ok)return failure(response);return response;
 }
 throw new ApiError('The demo session expired. Enter the demo again.',401,'unauthorized');
}
export async function apiJson<T>(path:string,options:RequestInit={}):Promise<T>{
 const response=await apiResponse(path,options);
 if(!response.headers.get('content-type')?.includes('application/json'))throw new ApiError('The backend response was not JSON. Check the API proxy configuration.');
 return response.json() as Promise<T>;
}
export const postJson=<T>(path:string,body:unknown,signal?:AbortSignal)=>apiJson<T>(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal});
export async function publicJson<T>(path:string,signal?:AbortSignal):Promise<T>{const r=await raw(path,{signal});if(!r.ok)return failure(r);return r.json();}
export function downloadBlob(filename:string,blob:Blob){const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=filename;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);}
