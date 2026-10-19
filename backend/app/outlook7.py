"""Transparent seven-date change projection, never a calibrated COPD event probability."""
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from statistics import median
import hashlib
import json
import math

POLICY_FILE = Path(__file__).resolve().parents[1] / 'config/outlook7_v1.json'
LOCK_FILE = Path(__file__).resolve().parents[1] / 'config/outlook7_lock.json'

class PolicyError(RuntimeError):
    """Frozen formula policy or implementation could not be verified."""

def clock(value):
    if not isinstance(value,str):raise ValueError('A timezone-aware ISO timestamp is required')
    parsed=datetime.fromisoformat(value.replace('Z','+00:00'))
    if parsed.tzinfo is None:raise ValueError('A timezone-aware ISO timestamp is required')
    return parsed.astimezone(timezone.utc)

def policy():
    lock=json.loads(LOCK_FILE.read_text())
    if hashlib.sha256(POLICY_FILE.read_bytes()).hexdigest()!=lock['policy_sha256'] or hashlib.sha256(Path(__file__).read_bytes()).hexdigest()!=lock['implementation_sha256']:
        raise PolicyError('The seven-day formula package failed its SHA-256 check')
    p=json.loads(POLICY_FILE.read_text())
    assert p['horizon_days']==7 and p['is_probability'] is False and p['clinical_validation'] is False
    assert sum(c['weight'] for c in p['channels'].values())+sum(p['symptoms'].values())==100
    return p

def bound(value,lo,hi):return min(hi,max(lo,value))

def band(value,p):
    return 'elevated_change' if value>=p['score_bands']['elevated_from'] else 'moderate_change' if value>=p['score_bands']['moderate_from'] else 'limited_change'

def stream_key(r):
    return json.dumps([r['channel'],r['context'],r.get('device_id'),r['source_series_id']],separators=(',',':'))

def build_outlook(patient_id,origin,as_of,observations,diaries):
    p=policy();now=clock(as_of);today=now.date();start=today-timedelta(days=p['lookback_days']-1)
    groups=defaultdict(list);seen={}
    for r in observations:
        if r.get('patient_id')!=patient_id or r.get('data_origin')!=origin:raise ValueError('Mixed patient/source inputs rejected')
        channel=r.get('channel');value=r.get('value')
        if channel not in p['channels'] or r.get('validity')!=1 or isinstance(value,bool) or not isinstance(value,(int,float)) or not math.isfinite(value):continue
        try:end=clock(r['measurement_end']);available=clock(r['available_at'])
        except (ValueError,KeyError):continue
        # Future values are discarded before identity deduplication or any numerical calculation.
        if end>now or available>now or not start<=end.date()<=today:continue
        c=p['channels'][channel]
        if r.get('units')!=c['units'] or not c['minimum_value']<=value<=c['maximum_value']:continue
        oid=r['observation_id'];canonical=json.dumps(r,sort_keys=True)
        if oid in seen:
            if seen[oid]!=canonical:raise ValueError('Conflicting observation identity')
            continue
        seen[oid]=canonical;groups[stream_key(r)].append((end,available,r))
    streams=[]
    for key,rows in sorted(groups.items()):
        rows.sort(key=lambda x:(x[0],x[1],x[2]['observation_id']));r=rows[-1][2];c=p['channels'][r['channel']]
        daily=defaultdict(list)
        for end,_,row in rows:daily[end.date()].append(row['value'])
        days=sorted(daily);values=[median(daily[d]) for d in days];age=(now-rows[-1][0]).total_seconds()/3600
        span=(days[-1]-days[0]).days;reasons=[]
        if len(days)<p['minimum_observed_days']:reasons.append('fewer_than_4_observed_days_in_14')
        if span<p['minimum_span_days']:reasons.append('less_than_3_days_span')
        if age>p['maximum_measurement_age_hours']:reasons.append('latest_measurement_older_than_48_hours')
        slopes=[(values[j]-values[i])/(days[j]-days[i]).days for i in range(len(days)) for j in range(i+1,len(days))]
        raw_slope=median(slopes) if slopes else None
        used=bound(raw_slope,-c['slope_cap'],c['slope_cap']) if raw_slope is not None else None
        streams.append({'key':key,'channel':r['channel'],'context':r['context'],'source_series_id':r['source_series_id'],'device_id':r.get('device_id'),'units':c['units'],'eligible':not reasons,'reasons':reasons,'observed_days':len(days),'span_days':span,'latest_measurement_end':rows[-1][0].isoformat().replace('+00:00','Z'),'latest_available_at':max(t[1] for t in rows).isoformat().replace('+00:00','Z'),'measurement_age_hours':age,'last_day':days[-1].isoformat(),'current_daily_median':values[-1],'reference_median':median(values[:-1]) if len(values)>1 else None,'raw_slope_per_day':raw_slope,'used_slope_per_day':used,'slope_capped':raw_slope!=used,'weight':c['weight'],'change_scale':c['change_scale'],'selected':False,'observed_daily_values':[{'date':d.isoformat(),'value':v} for d,v in zip(days,values)],'observation_ids':[x[2]['observation_id'] for x in rows],'time_evidence':sorted(set(x[2]['time_evidence'] for x in rows))})
    selected={}
    for channel,c in p['channels'].items():
        eligible=[s for s in streams if s['channel']==channel and s['eligible']]
        def order(s):
            priorities=c['context_priority'];return (priorities.index(s['context']) if s['context'] in priorities else len(priorities),-clock(s['latest_measurement_end']).timestamp(),s['key'])
        if eligible:selected[channel]=min(eligible,key=order);selected[channel]['selected']=True
    diary_candidates=[]
    for diary in diaries:
        if diary.get('patient_id')!=patient_id or diary.get('data_origin')!=origin:raise ValueError('Mixed diary patient/source inputs rejected')
        try:collected=clock(diary['collected_at']);available=clock(diary['available_at'])
        except (ValueError,KeyError):continue
        if collected<=now and available<=now:diary_candidates.append((collected,available,diary['diary_id'],diary))
    latest=max(diary_candidates,key=lambda x:x[:3]) if diary_candidates else None
    fresh_diary=latest is not None and (now-latest[0]).total_seconds()/3600<=p['maximum_diary_age_hours']
    symptoms=[{'field':field,'weight':weight,'value':latest[3].get(field) if fresh_diary and isinstance(latest[3].get(field),bool) else None} for field,weight in p['symptoms'].items()]
    ready=p['required_channel'] in selected and len(selected)>=p['minimum_sensor_channels'];reasons=[]
    if p['required_channel'] not in selected:reasons.append('eligible_spo2_history_required')
    if len(selected)<p['minimum_sensor_channels']:reasons.append('at_least_two_eligible_sensor_channels_required')
    known_weight=sum(p['channels'][k]['weight'] for k in selected)+sum(s['weight'] for s in symptoms if s['value'] is not None)
    days=[]
    for d in range(1,8):
        target=today+timedelta(days=d);components=[];projected={}
        for channel,c in p['channels'].items():
            source=selected.get(channel);value=None;clipped=False;lo=0.;hi=float(c['weight'])
            if source:
                raw=source['current_daily_median']+source['used_slope_per_day']*(target-datetime.fromisoformat(source['last_day']).date()).days
                value=bound(raw,c['minimum_value'],c['maximum_value']);clipped=value!=raw
                lo=hi=c['weight']*bound(c['direction']*(value-source['reference_median'])/c['change_scale'],0,1)
            projected[channel]=value
            components.append({'factor':channel,'weight':c['weight'],'minimum':lo,'maximum':hi,'projected_value':value,'value_capped':clipped,'source_key':source['key'] if source else None})
        for s in symptoms:
            value=s['value'];components.append({'factor':s['field'],'weight':s['weight'],'minimum':float(s['weight']) if value is True else 0.,'maximum':0. if value is False else float(s['weight']),'held_constant':True})
        lo=sum(c['minimum'] for c in components);hi=sum(c['maximum'] for c in components)
        days.append({'day':d,'date':target.isoformat(),'score_min':lo if ready else None,'score_max':hi if ready else None,'score_band':band(lo,p) if ready and band(lo,p)==band(hi,p) else 'indeterminate' if ready else 'unavailable','projected_values':projected,'components':components})
    worst_lo=max(d['score_min'] for d in days) if ready else None;worst_hi=max(d['score_max'] for d in days) if ready else None
    summary_band=band(worst_lo,p) if ready and band(worst_lo,p)==band(worst_hi,p) else 'indeterminate' if ready else 'unavailable'
    return {'schema_version':'pulmira-outlook7-1.0.0','method_version':p['version'],'patient_id':patient_id,'data_origin':origin,'as_of':now.isoformat().replace('+00:00','Z'),'horizon_days':7,'window_start':days[0]['date'],'window_end':days[-1]['date'],'method':'formula_based_trend_projection','status':'available' if ready and known_weight==100 else 'partial' if ready else 'unavailable','clinical_validation':False,'predictive_accuracy':None,'is_probability':False,'probability_next_7_days':None,'score_unit':'points_out_of_100','score_meaning':'Projected change from an observed historical reference under an unchanged-trend assumption; not exacerbation probability or absolute illness severity.','score_min':worst_lo,'score_max':worst_hi,'score_band':summary_band,'known_weight':known_weight,'unknown_weight':100-known_weight,'eligible_channels':list(selected),'reasons':reasons,'days':days,'streams':streams,'symptoms':symptoms,'diary':{'status':'fresh' if fresh_diary else 'stale' if latest else 'not_observed','diary_id':latest[3]['diary_id'] if latest else None,'collected_at':latest[3]['collected_at'] if latest else None,'available_at':latest[3]['available_at'] if latest else None},'policy':p,'policy_sha256':hashlib.sha256(POLICY_FILE.read_bytes()).hexdigest(),'implementation_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest()}
