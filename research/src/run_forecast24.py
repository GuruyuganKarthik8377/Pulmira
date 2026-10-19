"""Frozen separate synthetic next-day measurement forecast. Run once; no test-driven refits."""
import os
for name in ('OMP_NUM_THREADS','OPENBLAS_NUM_THREADS','MKL_NUM_THREADS'):os.environ.setdefault(name,'4')
import argparse,hashlib,json,sys,time
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.metrics import average_precision_score,roc_auc_score,brier_score_loss,precision_recall_curve,confusion_matrix
from threadpoolctl import threadpool_limits
import simulate_copd_v2 as sim
from verify_simulator_parameters_v2 import parameters,apply_scenario
from forecast24_features import feature_frame,runtime_gate,portable_predict,STATIC,plain

ROOT=Path(__file__).resolve().parents[1];PLAN=ROOT/'config/forecast24_v1.json';OUT=ROOT/'reports/forecast24_v1';DATA=ROOT/'data/processed/forecast24_v1';MODELS=ROOT/'models/forecast24_v1'
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def save(p,value):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(value,indent=2,allow_nan=False)+'\n')
def digest(text):return hashlib.sha256(text.encode()).hexdigest()

def membership(plan,package):
    p=sim.load_profiles(package);p['_selection']=p.source_patient_id.map(lambda x:digest(f'20261017|F24-selection|{x}'))
    p=p.sort_values('_selection').head(plan['population']['profiles']).copy()
    p['_partition']=p.source_patient_id.map(lambda x:digest(f'20261017|F24-split|{x}'));p=p.sort_values('_partition').reset_index(drop=True)
    a=plan['population']['train'];b=a+plan['population']['validation'];p['split']=['train' if i<a else 'validation' if i<b else 'test' for i in range(len(p))]
    p['patient_id']=plan['population']['namespace']+p.source_patient_id
    return p.drop(columns=['_selection','_partition'])

def generate(p,package,plan,scenario,save_examples=False):
    v=apply_scenario(parameters(package),next(s for s in package['scenarios'] if s['name']==scenario));days=plan['simulation']['generation_days']
    frames=[];metadata=[];examples=[];labels=[];gates=[]
    selected=set(sorted(p.patient_id)[:12]) if save_examples else set()
    for start in range(0,len(p),64):
        group=p.iloc[start:start+64].reset_index(drop=True)
        latent,events,bases,iu,iz=sim.latent_process(group,package,v,days,scenario,private=False)
        x,age,release=sim.observe(group,package,v,latent,bases,iu,iz,days)
        del latent,events,bases,iu,iz
        for i,row in group.iterrows():
            static={k:plain(row[k]) for k in STATIC};features=feature_frame(x[i],age[i],static)
            gate=runtime_gate(features);target=np.full(days,np.nan);future=x[i,1:,0]
            target[:-1]=np.where(np.isfinite(future),(future<90).astype(float),np.nan)
            decision=np.arange(28,180);frames.append(features.iloc[decision]);gates.append(gate[decision]);labels.append(target[decision])
            metadata.extend({'patient_id':row.patient_id,'source_patient_id':row.source_patient_id,'split':row.split,'day':int(d),'current_low':None if not np.isfinite(x[i,d,0]) else bool(x[i,d,0]<90)} for d in decision)
            if row.patient_id in selected:
                examples.append({'profile_id':row.patient_id,'source_profile_id':row.source_patient_id,'static':static,'scenario':scenario,'observations':[{'day':d,'date':(pd.Timestamp('2025-02-01')+pd.Timedelta(days=d)).strftime('%Y-%m-%d'),**{ch:plain(x[i,d,j]) for j,ch in enumerate(sim.SIGNALS)},'reported_symptom_age_days':plain(age[i,d])} for d in range(180)]})
        print(f'generated {scenario}: {min(start+64,len(p))}/{len(p)} profiles',flush=True)
    features=pd.concat(frames,ignore_index=True)
    return features.to_numpy(float),features.columns.tolist(),np.concatenate(labels),np.concatenate(gates),pd.DataFrame(metadata),examples

def prep_fit(x):
    medians=np.array([np.median(c[np.isfinite(c)]) if np.isfinite(c).any() else 0. for c in x.T]);missing=np.isnan(x);z=np.column_stack([np.where(missing,medians,x),missing.astype(float)])
    means=z.mean(axis=0);scales=z.std(axis=0);scales[scales==0]=1
    return {'medians':medians.tolist(),'means':means.tolist(),'scales':scales.tolist()}
def transform(x,prep):
    missing=np.isnan(x);z=np.column_stack([np.where(missing,np.array(prep['medians']),x),missing.astype(float)])
    return (z-np.array(prep['means']))/np.array(prep['scales'])
def weights(ids):
    _,inverse,counts=np.unique(ids,return_inverse=True,return_counts=True);w=1/counts[inverse];return w/w.mean()
def fit_model(candidate,x,y,w):
    if candidate['family']=='logistic':model=LogisticRegression(C=candidate['C'],max_iter=1500,random_state=20261017)
    else:model=HistGradientBoostingClassifier(**{k:v for k,v in candidate.items() if k not in ('name','family')},random_state=20261017)
    with threadpool_limits(limits=4):model.fit(x,y,sample_weight=w)
    return model
def export_model(model):
    if isinstance(model,LogisticRegression):return {'family':'logistic','coefficients':model.coef_[0].tolist(),'intercept':float(model.intercept_[0])}
    trees=[]
    for group in model._predictors:
        tree=[]
        for n in group[0].nodes:tree.append({'is_leaf':bool(n['is_leaf']),'value':float(n['value']),'feature':int(n['feature_idx']),'threshold':float(n['num_threshold']),'left':int(n['left']),'right':int(n['right'])})
        trees.append(tree)
    return {'family':'hist_gradient_boosting','baseline':float(model._baseline_prediction[0,0]),'trees':trees}
def metrics(y,p,threshold):
    warning=p>=threshold;tn,fp,fn,tp=confusion_matrix(y,warning,labels=[0,1]).ravel();recall=tp/(tp+fn) if tp+fn else 0;spec=tn/(tn+fp) if tn+fp else 0
    return {'rows':len(y),'positive_days':int(y.sum()),'prevalence':float(y.mean()),'average_precision':float(average_precision_score(y,p)) if y.sum() else None,'roc_auc':float(roc_auc_score(y,p)) if len(np.unique(y))==2 else None,'brier':float(brier_score_loss(y,p)),'accuracy':float((warning==y).mean()),'always_no_warning_accuracy':float(1-y.mean()),'precision':float(tp/(tp+fp)) if tp+fp else 0.,'recall':float(recall),'specificity':float(spec),'balanced_accuracy':float((recall+spec)/2),'alert_fraction':float(warning.mean()),'tp':int(tp),'fp':int(fp),'fn':int(fn),'tn':int(tn),'threshold':float(threshold)}
def threshold(y,p):
    precision,recall,t=precision_recall_curve(y,p);precision=precision[:-1];recall=recall[:-1];f1=2*precision*recall/np.maximum(precision+recall,1e-15)
    frac=(len(p)-np.searchsorted(np.sort(p),t,side='left'))/len(p);ok=(recall>=.6)&(precision>=.5)&(frac<=.35)
    eligible=np.flatnonzero(ok) if ok.any() else np.arange(len(t));index=eligible[np.argmax(f1[eligible])]
    return float(t[index]),bool(ok.any())
def subset_metrics(y,p,t):return metrics(y,p,t) if len(y) else {'rows':0,'status':'no_labels'}

def main():
    parser=argparse.ArgumentParser();parser.add_argument('stage',choices=['fit','evaluate']);args=parser.parse_args()
    plan=json.loads(PLAN.read_text());assert sha(PLAN)==json.loads((OUT/'preregistration_lock.json').read_text())['plan_sha256']
    for path,want in plan['simulation']['sources_sha256'].items():assert sha(ROOT/path)==want,path
    package=json.loads(sim.PACKAGE.read_text());p=membership(plan,package)
    DATA.mkdir(exist_ok=True,parents=True);MODELS.mkdir(exist_ok=True,parents=True)
    if args.stage=='fit':
        if (OUT/'model_selection_lock.json').exists():raise RuntimeError('Selection is already locked; refusing refit')
        p[['source_patient_id','patient_id','split']].to_csv(OUT/'membership.csv',index=False)
        trainval=p.loc[p.split.ne('test')].copy();raw,names,y,gate,meta,_=generate(trainval,package,plan,plan['simulation']['primary_scenario'])
        valid=gate&np.isfinite(y);train=valid&meta.split.eq('train').to_numpy();val=valid&meta.split.eq('validation').to_numpy()
        np.savez_compressed(DATA/'train_validation.npz',x=raw,y=y,gate=gate);meta.to_csv(DATA/'train_validation_metadata.csv',index=False)
        prep=prep_fit(raw[train]);x=transform(raw,prep);w=weights(meta.patient_id.to_numpy()[train]);results=[];models=[]
        for candidate in plan['candidates']:
            model=fit_model(candidate,x[train],y[train],w);prob=model.predict_proba(x[val])[:,1];m=metrics(y[val],prob,.5);results.append({'candidate':candidate,'validation':m});models.append(model);print('candidate',candidate['name'],m,flush=True)
        index=min(range(len(results)),key=lambda i:(-results[i]['validation']['average_precision'],results[i]['validation']['brier'],i));model=models[index];prob=model.predict_proba(x[val])[:,1];cut,meets=threshold(y[val],prob)
        artifact={'schema_version':'pulmira-forecast24-model-1.0.0','domain':'synthetic_only','clinical_validation':False,'plan_sha256':sha(PLAN),'features':names,**prep,'model':export_model(model),'threshold':cut,'target':plan['target'],'eligibility':plan['eligibility']}
        check=portable_predict(raw[val],artifact);error=float(np.max(np.abs(check-prob)));assert error<1e-10,error
        save(MODELS/'model.json',artifact)
        # Train comparable baselines without looking at validation/test labels for their fitting.
        baselines={'constant':{'probability':float(np.mean(y[train]))}}
        low=meta.current_low.to_numpy();baselines['persistence_rule']={'probabilities':{str(b):float(np.mean(y[train&(low==b)])) for b in [False,True]}}
        for name,columns in [('current_only',['spo2_pct_current']),('static_only',STATIC),('history_only',['spo2_pct_prior28_mean'])]:
            indices=[names.index(n) for n in columns];rp=prep_fit(raw[train][:,indices]);z=transform(raw[:,indices],rp);bm=fit_model({'family':'logistic','C':1.0},z[train],y[train],w)
            bp=bm.predict_proba(z[val])[:,1];bt,_=threshold(y[val],bp)
            baselines[name]={'indices':indices,'features':columns,**rp,'model':export_model(bm),'threshold':bt,'validation':metrics(y[val],bp,bt)}
        save(MODELS/'baselines.json',baselines)
        save(OUT/'model_selection_lock.json',{'plan_sha256':sha(PLAN),'code_sha256':{name:sha(ROOT/name) for name in ['src/run_forecast24.py','src/forecast24_features.py']},'selected':results[index]['candidate'],'candidates':results,'threshold':cut,'validation_threshold_meets_constraints':meets,'portable_max_absolute_error':error,'model_sha256':sha(MODELS/'model.json'),'baselines_sha256':sha(MODELS/'baselines.json'),'test_trajectories_generated':False,'no_test_outcomes_used':True,'train_profiles':int(meta.loc[train,'patient_id'].nunique()),'validation_profiles':int(meta.loc[val,'patient_id'].nunique()),'train_rows':int(train.sum()),'validation_rows':int(val.sum())})
        print('Selection locked before test generation',flush=True);return
    lock=json.loads((OUT/'model_selection_lock.json').read_text());assert sha(MODELS/'model.json')==lock['model_sha256'];assert sha(MODELS/'baselines.json')==lock['baselines_sha256']
    for name,want in lock['code_sha256'].items():assert sha(ROOT/name)==want,name
    if (OUT/'test_evaluation.json').exists():raise RuntimeError('Test results already exist; refusing another evaluation')
    artifact=json.loads((MODELS/'model.json').read_text());baselines=json.loads((MODELS/'baselines.json').read_text());heldout=p.loc[p.split.eq('test')].copy();results={};example_packets=[]
    for scenario in [plan['simulation']['primary_scenario'],plan['simulation']['stress_scenario']]:
        raw,names,y,gate,meta,examples=generate(heldout,package,plan,scenario,save_examples=scenario==plan['simulation']['primary_scenario']);assert names==artifact['features'];valid=gate&np.isfinite(y)
        probability=np.full(len(y),np.nan);probability[gate]=portable_predict(raw[gate],artifact);cut=artifact['threshold'];m=metrics(y[valid],probability[valid],cut);benchmark={}
        for name,b in baselines.items():
            if name=='constant':bp=np.full(valid.sum(),b['probability']);bt=.5
            elif name=='persistence_rule':bp=np.array([b['probabilities'][str(bool(v))] for v in meta.loc[valid,'current_low']]);bt=.5
            else:bp=portable_predict(raw[valid][:,b['indices']],b);bt=b['threshold']
            benchmark[name]=metrics(y[valid],bp,bt)
        # Current-not-low subset isolates future low readings instead of hiding them in ongoing lows.
        newlow=valid&meta.current_low.eq(False).to_numpy();ongoing=valid&meta.current_low.eq(True).to_numpy()
        bins=[]
        for lo,hi in zip(np.arange(0,1,.1),np.arange(.1,1.01,.1)):
            idx=valid&(probability>=lo)&(probability<hi if hi<1 else probability<=1)
            bins.append({'lower':round(float(lo),1),'upper':round(float(hi),1),'rows':int(idx.sum()),'mean_probability':float(probability[idx].mean()) if idx.any() else None,'observed_fraction':float(y[idx].mean()) if idx.any() else None})
        row={'scenario':scenario,'profiles':len(heldout),'calendar_decisions':len(y),'runtime_prediction_days':int(gate.sum()),'runtime_coverage':float(gate.mean()),'labelled_prediction_days':int(valid.sum()),'label_ascertainment_among_runtime':float(valid.sum()/gate.sum()) if gate.sum() else 0.,'unknown_future_labels':int((gate&~np.isfinite(y)).sum()),'selected':m,'baselines':benchmark,'current_not_low_subset':subset_metrics(y[newlow],probability[newlow],cut),'current_low_subset':subset_metrics(y[ongoing],probability[ongoing],cut),'false_warning_days_per100_calendar_days':float(m['fp']/len(y)*100),'calibration_bins':bins}
        if scenario==plan['simulation']['primary_scenario']:
            rng=np.random.default_rng(20261018);ids=sorted(meta.patient_id.unique());groups=[np.flatnonzero(valid&meta.patient_id.eq(pid).to_numpy()) for pid in ids];draws=[]
            for _ in range(300):
                idx=np.concatenate([groups[j] for j in rng.integers(0,len(ids),len(ids))]);d=metrics(y[idx],probability[idx],cut);draws.append([d[k] for k in ['average_precision','accuracy','precision','recall','brier']])
            row['patient_bootstrap_95pct']={k:np.percentile(np.array(draws)[:,i],[2.5,97.5]).tolist() for i,k in enumerate(['average_precision','accuracy','precision','recall','brier'])}
            gate_checks={'ap_above_prevalence':m['average_precision']>=m['prevalence']+.05,'recall':m['recall']>=.60,'precision':m['precision']>=.50,'balanced_accuracy':m['balanced_accuracy']>=.65,'coverage':row['runtime_coverage']>=.60,'label_ascertainment':row['label_ascertainment_among_runtime']>=.60,'brier_below_constant':m['brier']<benchmark['constant']['brier'],'competitive_with_current_only':m['average_precision']>=benchmark['current_only']['average_precision']-.01,'beats_static_ap':m['average_precision']>benchmark['static_only']['average_precision']}
            row['demo_acceptance_checks']=gate_checks;row['demo_accepted']=all(gate_checks.values());example_packets=examples
            for example in example_packets:example['split']='heldout_test';example['data_origin']='synthetic_forecast24'
            save(DATA/'observable_demo_profiles.json',{'schema_version':'pulmira-forecast24-observations-1.0.0','profiles':example_packets,'clinical_validation':False})
        results[scenario]=row
        np.savez_compressed(DATA/(scenario+'_test_audit.npz'),x=raw,y=y,gate=gate,probability=probability);meta.to_csv(DATA/(scenario+'_test_metadata.csv'),index=False)
        print('test',scenario,json.dumps(row,allow_nan=False),flush=True)
    save(OUT/'test_evaluation.json',{'plan_sha256':sha(PLAN),'model_sha256':sha(MODELS/'model.json'),'results':results,'clinical_validation':False,'data_domain':'synthetic_only','seven_day_exacerbation_prediction':False})
    print('Frozen evaluation complete',flush=True)

if __name__=='__main__':main()
