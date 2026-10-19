"""Forward engineering simulator. Frozen assumptions; no clinical validation."""
import argparse,copy,gzip,hashlib,io,json,platform,time
from contextlib import ExitStack
from pathlib import Path
import numpy as np
import pandas as pd
from calibrate_simulator_parameters_v2 import PROJECT,sha
from verify_simulator_parameters_v2 import parameters,apply_scenario,validate_package

PACKAGE=PROJECT/'config/causal_simulator_parameters_v2.json'
IMPLEMENTATION=PROJECT/'config/causal_simulator_implementation_v2.json'
TARGET='exacerbation_next_7_days'
SENSORS=['spo2_pct','heart_rate_bpm','respiratory_rate_per_min','sleep_hours','aqi_index','gait_speed_m_per_s']
SIGNALS=SENSORS+['reported_dyspnea_change','reported_cough_change']
STATIC=json.loads(IMPLEMENTATION.read_text())['static_features']
EVENT_COLUMNS=['patient_id','split','scenario','event_id','onset_day','confirmation_day','resolution_day','moderate_care_day','severe_care_day','category_close_day','category','confirmed']

def keyed_rng(seed,pid,module):
    key=f'{seed}|{pid}|{module}'.encode()
    return np.random.default_rng(int.from_bytes(hashlib.sha256(key).digest()[:8],'little'))

def random_block(ids,seed,module,days,width,normal=False,mc_seed=None):
    if mc_seed is not None:
        rng=keyed_rng(mc_seed,'independent_future',module)
        a=rng.standard_normal((days,len(ids),width)) if normal else rng.random((days,len(ids),width))
        return a.transpose(1,0,2)
    return np.stack([keyed_rng(seed,p,module).standard_normal((days,width)) if normal else keyed_rng(seed,p,module).random((days,width)) for p in ids])

def assign_splits(ids,seed,fractions):
    order=sorted(ids,key=lambda p:hashlib.sha256(f'{seed}|split|{p}'.encode()).digest())
    a=int(len(order)*fractions[0]);b=a+int(len(order)*fractions[1])
    return {p:'train' if i<a else 'validation' if i<b else 'test' for i,p in enumerate(order)}

def load_profiles(package,limit=None):
    source=PROJECT/parameters(package)['population_and_sensor_transfer']['profile_file']
    if sha(source)!=package['profile_sha256']:raise ValueError('profile changed')
    p=pd.read_csv(source,float_precision='round_trip').sort_values('source_patient_id').reset_index(drop=True)
    p['patient_id']='SIM-V2-KG-'+p.source_patient_id
    p['split']=p.patient_id.map(assign_splits(p.patient_id,package['protocol']['seed'],package['protocol']['split_fractions']))
    p['data_origin']='synthetic_v2_engineering';p['baseline_date_is_assumed']=1
    if limit is not None:p=p.iloc[:limit].copy()
    return p

def onset_flags(dyspnea,cough,v):
    rule=v['symptom_onset_rule']
    return (dyspnea>=rule['dyspnea_worsening_threshold'])&(cough>=rule['cough_worsening_threshold'])

def finalize_events(events,days,v):
    cap=v['label_maturation_cap']['days_after_first_symptom_onset']
    for e in events:
        close=e['onset_day']+cap;e['category_close_day']=close
        if not e['confirmed'] or close>=days:e['category']='unknown'
        elif e['severe_care_day'] is not None and e['severe_care_day']<=close:e['category']='Severe'
        elif e['moderate_care_day'] is not None and e['moderate_care_day']<=close:e['category']='Moderate'
        else:e['category']='untreated_or_mild'
    return events

def latent_process(profiles,package,v,days,scenario='source_reference',initial=None,mc_seed=None,private=True,random_change_after=None):
    """A module/day RNG is consumed regardless of branches. Future override is test-only."""
    n=len(profiles);ids=profiles.patient_id.tolist();seed=package['protocol']['seed']
    r={
      'init_u':random_block(ids,seed,'initial_uniform',1,8,mc_seed=mc_seed)[:,0],
      'init_z':random_block(ids,seed,'initial_normal',1,18,True,mc_seed=mc_seed)[:,0],
      'arrival':random_block(ids,seed,'arrivals',days,8,mc_seed=mc_seed),
      'burden_z':random_block(ids,seed,'burden_innovation',days,1,True,mc_seed=mc_seed)[:,:,0],
      'environment_z':random_block(ids,seed,'environment',days,1,True,mc_seed=mc_seed)[:,:,0],
      'symptom_z':random_block(ids,seed,'latent_symptoms',days,2,True,mc_seed=mc_seed),
      'care_u':random_block(ids,seed,'care',days,2,mc_seed=mc_seed)}
    if random_change_after is not None:
        for key,a in r.items():
            if key.startswith('init'):continue
            a[:,random_change_after:]=0 if key.endswith('_u') or key=='arrival' else 8
    frailty=r['init_z'][:,0]*v['baseline_vulnerability']['frailty_normal_sd']
    vulnerability=np.clip(np.exp(.01*(profiles.age_at_simulation_baseline.to_numpy()-65)+.08*profiles.charlson_index.to_numpy()+.20*profiles.smoking_current.to_numpy()+frailty),.5,2.)
    ref=package['descriptive_references'];baselines={}
    for j,ch in enumerate(SENSORS):
        pool=np.array(ref[ch]['between_patient_baseline_pool'])
        baselines[ch]=pool[np.minimum((r['init_u'][:,j]*len(pool)).astype(int),len(pool)-1)]
    device_fraction=v['device_error_and_bias']['device_variance_fraction']
    env_sigma=np.sqrt(1-device_fraction)*ref['aqi_index']['reference_sd_used']
    aqi=baselines['aqi_index']+env_sigma*r['init_z'][:,1]
    burden=np.full(n,v['burden_persistence']['initial_burden'],float)
    existing=np.zeros((n,10))
    if initial is not None:
        burden=np.array(initial['burden'],float);aqi=np.array(initial['aqi'],float)
        vulnerability=np.array(initial['vulnerability'],float);baselines['aqi_index']=np.array(initial['base_aqi'],float)
        existing=np.array(initial['infection_existing_future'],float)
    infection=v['infection_arrival_and_duration'];maxdur=infection['duration_days_inclusive'][1]
    amps=np.zeros((n,maxdur));durations=np.zeros((n,maxdur),int);ages=np.arange(maxdur)
    mimic=v['benign_and_mimic_process'];mdur=mimic['duration_days_inclusive'][1]
    ma=np.zeros((n,mdur));mt=np.zeros((n,mdur),int);context=np.zeros(n)
    active=np.zeros(n,bool);pending=np.full(n,-1,int);low=np.zeros(n,int)
    current=np.full(n,-1,int);willing=np.zeros(n,bool);consult=np.full(n,-1,int);care_day=np.full(n,-1,int)
    data={k:np.zeros((n,days)) for k in ['burden','aqi','dyspnea','cough','context','active_confirmed','pending_qualify','vulnerability','base_aqi','infection_drive','infection_amp_new','infection_duration_new','abrupt_increment','burden_innovation','environment_innovation','effective_rho','latent_symptom_noise_dyspnea','latent_symptom_noise_cough','care_u_willing','care_u_delay']}
    if private:data.update({f'known_infection_next_{k}':np.zeros((n,days)) for k in range(1,11)})
    events=[]
    cdf=np.cumsum(v['care_access_delay']['delay_probabilities'])
    for d in range(days):
        u=r['arrival'][:,d]
        erho=v['exposure_process']['rho']
        aqi=np.clip(erho*aqi+(1-erho)*baselines['aqi_index']+np.sqrt(1-erho**2)*env_sigma*r['environment_z'][:,d],*v['exposure_process']['bounds'])
        amps[:,1:]=amps[:,:-1];durations[:,1:]=durations[:,:-1]
        start=u[:,0]<infection['arrival_probability_per_day']*vulnerability
        amps[:,0]=np.where(start,infection['amplitude_uniform'][0]+u[:,1]*(infection['amplitude_uniform'][1]-infection['amplitude_uniform'][0]),0)
        durations[:,0]=infection['duration_days_inclusive'][0]+np.floor(u[:,2]*(maxdur-infection['duration_days_inclusive'][0]+1)).astype(int)
        drive=np.max(amps*np.minimum((ages+1)/infection['rise_days'],1)*(ages<durations),axis=1)
        if d<existing.shape[1]:drive=np.maximum(drive,existing[:,d])
        abrupt=np.where(u[:,3]<v['abrupt_deterioration_process']['arrival_probability_per_day']*vulnerability,v['abrupt_deterioration_process']['amplitude_uniform'][0]+u[:,4]*np.diff(v['abrupt_deterioration_process']['amplitude_uniform'])[0],0)
        rho=v['burden_persistence']['rho']-np.where(active&(care_day>=0)&(care_day<d),v['intervention_response']['care_burden_decay_increment'],0)
        exposure=v['exposure_burden_effect']['beta_per_100_AQI_above_100']*np.maximum(0,(aqi-100)/100)
        burden=np.clip(rho*burden+drive+abrupt+exposure+v['burden_persistence']['baseline_innovation_sd']*r['burden_z'][:,d],0,v['burden_persistence']['maximum_burden'])
        ma[:,1:]=ma[:,:-1];mt[:,1:]=mt[:,:-1]
        ms=u[:,5]<mimic['arrival_probability_per_day']
        ma[:,0]=np.where(ms,mimic['amplitude_uniform'][0]+u[:,6]*np.diff(mimic['amplitude_uniform'])[0],0)
        mt[:,0]=mimic['duration_days_inclusive'][0]+np.floor(u[:,7]*(mdur-mimic['duration_days_inclusive'][0]+1)).astype(int)
        context=np.maximum(mimic['rho_during_decay']*context,np.max(ma*(np.arange(mdur)<mt),axis=1))
        dyspnea=np.maximum(0,burden+.12*r['symptom_z'][:,d,0]);cough=np.maximum(0,.9*burden+.15*r['symptom_z'][:,d,1])
        qualifies=onset_flags(dyspnea,cough,v)
        confirmation=(~active)&qualifies&(pending==d-1)&(pending>=0)
        for i in np.flatnonzero(confirmation):
            e={'patient_id':ids[i],'split':profiles.split.iloc[i],'scenario':scenario,'event_id':f'{ids[i]}-E{pending[i]:03d}',
                'onset_day':int(pending[i]),'confirmation_day':d,'resolution_day':None,'moderate_care_day':None,'severe_care_day':None,'confirmed':1,'_index':int(i)}
            current[i]=len(events);events.append(e)
        active|=confirmation
        willing[confirmation]=r['care_u'][confirmation,d,0]<v['care_access_delay']['willingness_probability_per_episode']
        delay_indices=np.searchsorted(cdf,r['care_u'][:,d,1])
        consult[confirmation]=d+np.array(v['care_access_delay']['delay_days'])[delay_indices[confirmation]]
        care_day[confirmation]=-1
        moderate=active&willing&(consult==d)
        severe=active&willing&(dyspnea>=v['care_category_assignment']['severe_dyspnea_threshold'])
        for i in np.flatnonzero(moderate):
            if events[current[i]]['moderate_care_day'] is None:events[current[i]]['moderate_care_day']=d
        for i in np.flatnonzero(severe):
            if events[current[i]]['severe_care_day'] is None:events[current[i]]['severe_care_day']=d
        care_day[(moderate|severe)&(care_day<0)]=d
        low=np.where(active&(dyspnea<v['episode_resolution_and_recurrence']['dyspnea_below'])&(cough<v['episode_resolution_and_recurrence']['cough_below']),low+1,0)
        resolved=active&(low>=v['episode_resolution_and_recurrence']['consecutive_days'])
        for i in np.flatnonzero(resolved):events[current[i]]['resolution_day']=d
        # Resolution day is still active for care and retrospective eligibility; next day may start a candidate.
        inactive_before_resolution=~active
        pending=np.where(inactive_before_resolution&qualifies,np.where((pending>=0)&(pending==d-1),pending,d),-1)
        active[resolved]=False;willing[resolved]=False;consult[resolved]=-1;care_day[resolved]=-1
        for name,a in [('burden',burden),('aqi',aqi),('dyspnea',dyspnea),('cough',cough),('context',context),('active_confirmed',active),('pending_qualify',pending>=0),('vulnerability',vulnerability),('base_aqi',baselines['aqi_index'])]:data[name][:,d]=a
        for name,a in [('infection_drive',drive),('infection_amp_new',amps[:,0]),('infection_duration_new',np.where(start,durations[:,0],0)),('abrupt_increment',abrupt),('burden_innovation',r['burden_z'][:,d]),('environment_innovation',r['environment_z'][:,d]),('effective_rho',rho),('latent_symptom_noise_dyspnea',r['symptom_z'][:,d,0]),('latent_symptom_noise_cough',r['symptom_z'][:,d,1]),('care_u_willing',r['care_u'][:,d,0]),('care_u_delay',r['care_u'][:,d,1])]:data[name][:,d]=a
        if private:
            for k in range(1,11):data[f'known_infection_next_{k}'][:,d]=np.max(amps*np.minimum((ages+k+1)/infection['rise_days'],1)*(ages+k<durations),axis=1)
    for i in np.flatnonzero((~active)&(pending>=0)):
        events.append({'patient_id':ids[i],'split':profiles.split.iloc[i],'scenario':scenario,'event_id':f'{ids[i]}-E{pending[i]:03d}','onset_day':int(pending[i]),'confirmation_day':None,'resolution_day':None,'moderate_care_day':None,'severe_care_day':None,'confirmed':0,'_index':int(i)})
    return data,finalize_events(events,days,v),baselines,r['init_u'],r['init_z']

def observe(profiles,package,v,latent,baselines,init_u,init_z,days,random_change_after=None):
    ids=profiles.patient_id.tolist();n=len(ids);seed=package['protocol']['seed'];ref=package['descriptive_references']
    z=random_block(ids,seed,'observation_background',days,6,True);device=random_block(ids,seed,'observation_device',days,6,True)
    mask_u=random_block(ids,seed,'observation_availability',days,6);reports_u=random_block(ids,seed,'reporting',days,2)
    report_z=random_block(ids,seed,'report_noise',days,2,True)
    if random_change_after is not None:
        for a in [z,device,mask_u,reports_u,report_z]:a[:,random_change_after:]=0
    x=np.full((n,days,8),np.nan);report_age=np.full((n,days),np.nan);release_source=np.full((n,days),-1,int)
    variance_fraction=v['device_error_and_bias']['device_variance_fraction'];sigmas=np.array([ref[ch]['reference_sd_used'] for ch in SENSORS])
    bias=init_z[:,2:8]*v['device_error_and_bias']['fixed_bias_sd_in_reference_sd_units']*sigmas
    response=v['sensor_response_and_lags'];sigma=response['patient_response_lognormal_sigma']
    scale=np.exp(sigma*init_z[:,8]-.5*sigma*sigma)
    weak=init_u[:,6];scale*=np.where(weak<response['absent_response_patient_fraction'],0,np.where(weak<response['absent_response_patient_fraction']+response['weak_response_patient_fraction'],response['weak_response_multiplier'],1))
    background=init_z[:,12:18]*np.sqrt(1-variance_fraction)*sigmas
    availability_initial=random_block(ids,seed,'availability_initial',1,6)[:,0]
    availability=availability_initial<np.array([ref[ch]['stationary_observation_fraction_of_assumed_markov_model'] for ch in SENSORS])
    availability[:,1]=availability[:,0]
    releases=[];cdf=np.cumsum(v['missingness_and_dropout']['report_delay_probabilities'])
    rho=v['observation_dispersion']['intrinsic_AR_rho'];corr=v['observation_dispersion']['shared_standardized_innovation_correlation']
    for d in range(days):
        innovations=np.sqrt(corr)*z[:,d,5,None]+np.sqrt(1-corr)*z[:,d,:5]
        physical_indices=[0,1,2,3,5]
        background[:,physical_indices]=rho*background[:,physical_indices]+np.sqrt(1-rho*rho)*np.sqrt(1-variance_fraction)*sigmas[physical_indices]*innovations
        values=np.zeros((n,6))
        for j,ch in enumerate(SENSORS):
            if ch=='aqi_index':values[:,j]=latent['aqi'][:,d]
            else:
                lag=response['lag_days'][ch];burden=np.zeros(n) if d-lag<0 else latent['burden'][:,d-lag]
                values[:,j]=baselines[ch]+scale*response['amplitude_per_burden_unit'][ch]*burden+v['benign_and_mimic_process']['sensor_loading_per_context_unit'][ch]*latent['context'][:,d]+background[:,j]
            values[:,j]+=bias[:,j]+np.sqrt(variance_fraction)*sigmas[j]*device[:,d,j]
            values[:,j]=np.clip(values[:,j],*v['device_error_and_bias']['bounds'][ch])
        policy=v['missingness_and_dropout']
        if policy['default']=='hypothetical_daily_Bernoulli':available=mask_u[:,d]<policy['daily_observation_probability']
        else:
            missing_prob=np.where(availability,np.array([ref[ch]['p_missing_after_observed'] for ch in SENSORS]),1-np.array([ref[ch]['p_observed_after_missing'] for ch in SENSORS]))
            factor=np.where(latent['dyspnea'][:,d]>=policy['illness_score_threshold'],policy['illness_missing_odds_multiplier'],1)
            missing_prob=factor[:,None]*missing_prob/(1-missing_prob+factor[:,None]*missing_prob)
            available=mask_u[:,d]>=missing_prob
        available[:,1]=available[:,0];availability=available
        x[:,d,:6]=np.where(available,values,np.nan)
        reported=reports_u[:,d,0]<policy['symptom_reporting_probability']
        delay=np.array(policy['report_delay_values_days'])[np.searchsorted(cdf,reports_u[:,d,1])]
        rv=np.stack([latent['dyspnea'][:,d],latent['cough'][:,d]],axis=1)+np.array([1.,.8])[None,:]*latent['context'][:,d,None]+policy['reported_symptom_noise_sd']*report_z[:,d]
        rv=np.maximum(0,rv)
        releases.append((d,reported,d+delay,rv))
        for source_day,has,release_day,report_values in releases[-3:]:
            due=has&(release_day==d)
            x[due,d,6:]=report_values[due];release_source[due,d]=source_day;report_age[due,d]=d-source_day
    return x,report_age,release_source

def temporal_features(x,report_age,profile):
    f=pd.DataFrame(x,columns=SIGNALS);out=f.copy()
    for ch in SIGNALS:
        s=f[ch]
        for width in [3,7,14,28]:out[f'{ch}_mean{width}']=s.rolling(width,min_periods=1).mean()
        out[f'{ch}_std7']=s.rolling(7,min_periods=2).std()
        out[f'{ch}_count7']=s.rolling(7,min_periods=1).count()
        out[f'{ch}_prior28_baseline']=s.shift().rolling(28,min_periods=1).mean()
        out[f'{ch}_prior28_count']=s.shift().rolling(28,min_periods=1).count().fillna(0)
        out[f'{ch}_delta7']=s-s.shift(7)
    out['reported_symptom_age_days']=report_age
    for col in STATIC:out[col]=profile[col]
    return out

def labels_and_eligibility(days,events,features,package,v):
    t=np.arange(days);h=package['target']['horizon_days'];cap=v['label_maturation_cap']['days_after_first_symptom_onset']
    observed=t+h+cap<days;primary=np.zeros(days);secondary=np.zeros(days);episode=np.zeros(days,bool)
    for e in events:
        if not e['confirmed']:continue
        end=e['resolution_day'] if e['resolution_day'] is not None else days-1
        episode[e['onset_day']:min(days,end+1)]=True
        if e['category'] in ['Moderate','Severe']:primary[(t<e['onset_day'])&(t+h>=e['onset_day'])]=1
        care=[d for d in [e['moderate_care_day'],e['severe_care_day']] if d is not None]
        if care:
            day=min(care);secondary[(t<day)&(t+h>=day)]=1
    primary[~observed]=np.nan;secondary[~observed]=np.nan
    warm=t<package['protocol']['warmup_days'];forecast=t<package['simulation_design']['forecast_calendar_days']
    ready=np.zeros(days,int)
    for ch in v['population_and_sensor_transfer']['core_channels']:
        ready+=np.isfinite(features[ch])&(features[f'{ch}_prior28_count']>=package['protocol']['minimum_baseline_readings'])
    available=ready>=package['protocol']['minimum_current_core_channels']
    eligible=observed&forecast&~warm&~episode&available
    return primary,secondary,observed,episode,warm,forecast,available,eligible

class Sink:
    def __init__(self,path,stack):
        raw=stack.enter_context(Path(path).open('wb'))
        stream=stack.enter_context(gzip.GzipFile(filename='',mode='wb',fileobj=raw,mtime=0,compresslevel=1)) if str(path).endswith('.gz') else raw
        self.stream=stack.enter_context(io.TextIOWrapper(stream,encoding='utf-8',newline=''));self.first=True
    def write(self,f):
        f.to_csv(self.stream,index=False,header=self.first,float_format='%.17g',lineterminator='\n');self.first=False

def build(out,limit=None,block_size=256,scenario_names=None):
    out=Path(out)
    if out.exists() and any(out.iterdir()):raise ValueError('Use an empty new output directory')
    if block_size<1 or (limit is not None and limit<1):raise ValueError('Positive block size and patient limit required')
    lock=json.loads((PROJECT/'reports/simulator_parameters_v2/parameterization_lock.json').read_text())
    for path,value in lock['frozen_files_sha256'].items():
        if sha(PROJECT/path)!=value:raise ValueError('Frozen parameter deliverable changed: '+path)
    package=json.loads(PACKAGE.read_text());spec=json.loads((PROJECT/'config/causal_simulator_spec_v2.json').read_text());validate_package(package,spec)
    profiles=load_profiles(package,limit);out.mkdir(parents=True,exist_ok=True)
    profiles.to_csv(out/'patients.csv',index=False,float_format='%.17g',lineterminator='\n')
    profiles[['patient_id','source_patient_id','split']].to_csv(out/'patient_split.csv',index=False)
    scenarios=[s for s in package['scenarios'] if scenario_names is None or s['name'] in scenario_names]
    if not scenarios:raise ValueError('no scenarios')
    schemas=None;all_events=[];summary={};start=time.monotonic()
    with ExitStack() as stack:
        for scenario in scenarios:
            name=scenario['name'];v=apply_scenario(parameters(package),scenario)
            selected=profiles if scenario['role']=='default' else profiles.loc[profiles.split.eq('test')]
            days=package['simulation_design']['forecast_calendar_days']+v['label_maturation_cap']['additional_label_followup_days']
            sinks={k:Sink(out/f'{name}_{k}.csv.gz',stack) for k in ['observations','modeling','private']}
            counts={'patients':len(selected),'observation_days':0,'eligible_days':0,'positive_windows':0,'events':0,'unknown_categories':0,'eligible_runtime_days':0,'core_available_forecast_days':0,'forecast_days':0}
            for start_i in range(0,len(selected),block_size):
                p=selected.iloc[start_i:start_i+block_size].reset_index(drop=True)
                latent,events,bases,iu,iz=latent_process(p,package,v,days,name)
                x,age,releases=observe(p,package,v,latent,bases,iu,iz,days)
                grouped={pid:[] for pid in p.patient_id}
                for e in events:grouped[e['patient_id']].append(e)
                date=pd.date_range(package['simulation_design']['simulation_start'],periods=days).strftime('%Y-%m-%d')
                frames={k:[] for k in sinks}
                for i,profile in p.iterrows():
                    f=temporal_features(x[i],age[i],profile)
                    y,ycare,seen,episode,warm,forecast,available,eligible=labels_and_eligibility(days,grouped[profile.patient_id],f,package,v)
                    # Runtime gate uses only released symptoms and actual past care, never episode truth.
                    known_care=np.zeros(days,bool)
                    for e in grouped[profile.patient_id]:
                        care=[d for d in [e['moderate_care_day'],e['severe_care_day']] if d is not None]
                        for d in care:known_care[d:min(days,d+package['protocol']['cooldown_days'])]=True
                    latest=pd.DataFrame(x[i,:,6:],columns=['dysp','cough']).ffill()
                    active_report=(latest.dysp>=v['symptom_onset_rule']['dyspnea_worsening_threshold'])&(latest.cough>=v['symptom_onset_rule']['cough_worsening_threshold'])
                    runtime=seen&forecast&~warm&available&~known_care&~active_report.fillna(False).to_numpy()
                    meta=pd.DataFrame({'patient_id':profile.patient_id,'split':profile.split,'scenario':name,'date':date,'day':np.arange(days)})
                    obs=pd.concat([meta,pd.DataFrame(x[i],columns=SIGNALS)],axis=1)
                    obs['reported_symptom_collection_day']=releases[i];obs['reported_symptom_age_days']=age[i]
                    for col,a in [(TARGET,y),('care_event_next_7_days',ycare),('label_observed',seen),('episode_truth',episode),('warmup',warm),('forecast_day',forecast),('available_for_prediction',available),('eligible_for_modeling',eligible),('runtime_gate',runtime)]:obs[col]=a.astype(int) if a.dtype==bool else a
                    obs['data_origin']='synthetic_v2_engineering';frames['observations'].append(obs)
                    model=pd.concat([meta,f],axis=1);model[TARGET]=y
                    frames['modeling'].append(model.loc[eligible])
                    private_frame=pd.concat([meta,pd.DataFrame({k:a[i] for k,a in latent.items()})],axis=1)
                    frames['private'].append(private_frame)
                    if schemas is None:schemas={'features':list(f.columns),'static_features':STATIC,'signals':SIGNALS,'target':TARGET,'clinical_validation':False,'exclude':['day','date','patient_id','split','scenario','episode_truth','runtime_gate','private_truth','event_register'],'purpose':'engineering_simulation_only'}
                    counts['observation_days']+=days;counts['eligible_days']+=int(eligible.sum());counts['positive_windows']+=int(np.nansum(y[eligible]));counts['eligible_runtime_days']+=int(runtime.sum());counts['core_available_forecast_days']+=int((available&forecast&~warm).sum());counts['forecast_days']+=int((forecast&~warm).sum())
                for key,frameset in frames.items():sinks[key].write(pd.concat(frameset,ignore_index=True))
                all_events+=events
            counts['events']=sum(e['confirmed'] for e in all_events if e['scenario']==name)
            counts['unknown_categories']=sum(e['category']=='unknown' for e in all_events if e['scenario']==name)
            summary[name]=counts
            print(json.dumps({'scenario_complete':name,**counts,'elapsed_seconds':round(time.monotonic()-start,1)}),flush=True)
    registry=pd.DataFrame(all_events,columns=EVENT_COLUMNS);registry.to_csv(out/'events.csv',index=False,lineterminator='\n')
    (out/'input_schema.json').write_text(json.dumps(schemas,indent=2)+'\n')
    source_files=[Path(__file__),IMPLEMENTATION,PACKAGE,PROJECT/'config/causal_simulator_spec_v2.json',PROJECT/'src/verify_simulator_parameters_v2.py',PROJECT/'src/calibrate_simulator_parameters_v2.py']
    provenance={'version':'synthetic_copd_v2','clinical_validation':False,'generation_scope':'engineering_simulation','package_sha256':sha(PACKAGE),'sources_sha256':{str(f.relative_to(PROJECT)):sha(f) for f in source_files},'source_profiles_sha256':package['profile_sha256'],'summary':summary,'runtime':{'python':platform.python_version(),'numpy':np.__version__,'pandas':pd.__version__},'output_sha256':{f.name:sha(f) for f in sorted(out.iterdir()) if f.is_file()}}
    (out/'provenance.json').write_text(json.dumps(provenance,indent=2)+'\n')
    return provenance

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--out',type=Path,default=PROJECT/'data/processed/synthetic_copd_v2');parser.add_argument('--limit',type=int);parser.add_argument('--block-size',type=int,default=256);parser.add_argument('--scenario',action='append')
    args=parser.parse_args();build(args.out,args.limit,args.block_size,args.scenario)
