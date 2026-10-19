import {useEffect,useState} from 'react';
import {publicJson} from './api.ts';
import type {DemoOrigin} from './monitoring';
export function useDemoProfiles(){
 const [profiles,setProfiles]=useState<{patient_id:string;data_origin:DemoOrigin}[]|null>(null);
 useEffect(()=>{const c=new AbortController();publicJson<{public_profiles:{patient_id:string}[];patients:{patient_id:string}[]}>('/demo/identities',c.signal).then(d=>{if(!c.signal.aborted&&Array.isArray(d.public_profiles)&&Array.isArray(d.patients))setProfiles([...d.public_profiles.map(p=>({patient_id:p.patient_id,data_origin:'real_open' as const})),...d.patients.map(p=>({patient_id:p.patient_id,data_origin:'synthetic' as const}))]);}).catch(()=>{/* The authenticated archive still supplies the current scope on older backends. */});return()=>c.abort();},[]);
 return profiles;
}
