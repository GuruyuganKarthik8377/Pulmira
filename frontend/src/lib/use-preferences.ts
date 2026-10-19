import { useSyncExternalStore } from 'react';
import { clearPreferences, DEFAULT_PREFERENCES, PREFERENCES_KEY, readPreferences, writePreferences } from './preferences.ts';
import type { DisplayPreferences } from './preferences';
interface PreferenceSnapshot { preferences:DisplayPreferences;saved:boolean;error:string }
let snapshot:PreferenceSnapshot={preferences:{...DEFAULT_PREFERENCES},saved:false,error:''};
let initialized=false;
const listeners=new Set<()=>void>();
function errorText(reason:unknown){return reason instanceof Error?reason.message:'Browser storage is unavailable.';}
export function reloadPreferences(){
  try{snapshot={...readPreferences(localStorage),error:''};}catch(reason){snapshot={preferences:{...DEFAULT_PREFERENCES},saved:false,error:errorText(reason)};}
  initialized=true;listeners.forEach(fn=>fn());
}
export function getPreferenceSnapshot(){if(!initialized&&typeof window!=='undefined')reloadPreferences();return snapshot;}
function storageChanged(event:StorageEvent){if(event.key===PREFERENCES_KEY||event.key===null)reloadPreferences();}
function subscribe(listener:()=>void){listeners.add(listener);if(listeners.size===1)window.addEventListener('storage',storageChanged);return()=>{listeners.delete(listener);if(!listeners.size)window.removeEventListener('storage',storageChanged);};}
export function saveDisplayPreferences(preferences:DisplayPreferences){
  try{const confirmed=writePreferences(localStorage,preferences);snapshot={...confirmed,error:''};initialized=true;listeners.forEach(fn=>fn());return {ok:true,error:''};}catch(reason){return {ok:false,error:errorText(reason)};}
}
export function resetDisplayPreferences(){
  try{snapshot={...clearPreferences(localStorage),error:''};initialized=true;listeners.forEach(fn=>fn());return {ok:true,error:''};}catch(reason){return {ok:false,error:errorText(reason)};}
}
export const usePreferences=()=>useSyncExternalStore(subscribe,getPreferenceSnapshot,()=>snapshot);
