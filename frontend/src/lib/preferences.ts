export const DISPLAY_ZONES = { UTC:'UTC', 'Asia/Kolkata':'India · Asia/Kolkata', 'Europe/London':'United Kingdom · Europe/London', 'America/New_York':'US Eastern · America/New_York' } as const;
export type DisplayZone = keyof typeof DISPLAY_ZONES;
export interface DisplayPreferences { timeZone:DisplayZone; motion:'system'|'reduce'; spacing:'comfortable'|'compact' }
export const DEFAULT_PREFERENCES:Readonly<DisplayPreferences> = Object.freeze({timeZone:'UTC',motion:'system',spacing:'comfortable'});
export const PREFERENCES_KEY='pulmira-display-preferences-v1';
export interface PreferenceStore { getItem:(key:string)=>string|null;setItem:(key:string,value:string)=>void;removeItem:(key:string)=>void }
export function validatePreferences(value:unknown):asserts value is DisplayPreferences{
  const p=value as DisplayPreferences;
  if(!p||Object.keys(p).sort().join('|')!=='motion|spacing|timeZone'||!Object.hasOwn(DISPLAY_ZONES,p.timeZone)||!['system','reduce'].includes(p.motion)||!['comfortable','compact'].includes(p.spacing))throw new Error('Saved display preferences have an unsupported format. They have not been overwritten.');
}
export function readPreferences(store:PreferenceStore):{preferences:DisplayPreferences;saved:boolean}{
  const raw=store.getItem(PREFERENCES_KEY);if(raw===null)return {preferences:{...DEFAULT_PREFERENCES},saved:false};
  let value:unknown;try{value=JSON.parse(raw);}catch{throw new Error('Saved display preferences could not be read. They have not been overwritten.');}
  const envelope=value as {schema?:string;preferences?:unknown};if(!envelope||envelope.schema!=='pulmira-display-preferences-1.0.0')throw new Error('Saved display preferences have an unsupported version. They have not been overwritten.');
  validatePreferences(envelope.preferences);return {preferences:envelope.preferences,saved:true};
}
export function writePreferences(store:PreferenceStore,preferences:DisplayPreferences){
  validatePreferences(preferences);readPreferences(store); // Do not silently overwrite corrupt existing records.
  store.setItem(PREFERENCES_KEY,JSON.stringify({schema:'pulmira-display-preferences-1.0.0',preferences}));
  const confirmed=readPreferences(store);if(!confirmed.saved||JSON.stringify(confirmed.preferences)!==JSON.stringify(preferences))throw new Error('The browser did not confirm saving these display preferences.');
  return confirmed;
}
export function clearPreferences(store:PreferenceStore){store.removeItem(PREFERENCES_KEY);if(store.getItem(PREFERENCES_KEY)!==null)throw new Error('The browser did not confirm resetting display preferences.');return {preferences:{...DEFAULT_PREFERENCES},saved:false};}
export function detailedTimestamp(value:string,timeZone:DisplayZone='UTC'){
  if(!Number.isFinite(Date.parse(value)))return 'Unknown time';
  return new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone}).format(new Date(value))+` ${timeZone}`;
}
