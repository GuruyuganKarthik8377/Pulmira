"""Render locked evaluation artifacts; never train, tune or change a study artifact."""
import json
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
from sklearn.metrics import precision_recall_curve

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'reports/forecast24_v1'

def main():
    record=json.loads((OUT/'test_evaluation.json').read_text())
    lock=json.loads((OUT/'model_selection_lock.json').read_text())
    e=record['results']['denser_assumed_monitoring'];s=e['selected'];sparse=record['results']['source_reference']
    labels={'constant':'Training prevalence','persistence_rule':'Current-low persistence','current_only':'Current SpO₂ only','static_only':'Static EHR only','history_only':'Prior 28-day SpO₂ mean'}
    table='\n'.join(f"| {labels[k]} | {v['accuracy']:.2%} | {v['average_precision']:.4f} | {v['recall']:.2%} | {v['brier']:.4f} |" for k,v in e['baselines'].items())
    model=json.loads((ROOT/'models/forecast24_v1/model.json').read_text());static=set(model['features'][-17:]);counts={}
    for tree in model['model']['trees']:
        for node in tree:
            if not node['is_leaf'] and node['feature']<len(model['features']):
                name=model['features'][node['feature']]
                if name in static:counts[name]=counts.get(name,0)+1
    text=f'''# Pulmira synthetic next-day measurement forecast — model card

Completed 17 October 2026. Experiment `forecast24_v1`. **Fictional engineering proof-of-concept; clinical validation false.**

## What the result supports

A working trained algorithm ingests fictional historical EHR and current/past sensor observations to forecast whether the **next calendar day's recorded simulated SpO₂ is below 90%**. Ongoing low readings are included. This is a one-day measurement-state forecast, not a seven-day COPD exacerbation model. It may demonstrate the challenge's two-stream algorithmic workflow; it does not establish reliable incident adverse-event warning or competition acceptance.

**Main limitation: recall for new low states when the current reading is not already low is only 13.48% (69 of 512 positive days).** The aggregate score is substantially driven by continuation of existing low readings. In the currently non-low subset, accuracy is 96.48%, below the 96.64% always-no-warning baseline. Do not describe the headline as 95% accurate prediction of new COPD deterioration.

## Locked study design

The plan and source hashes were saved before generation of the new trajectories. The frozen v2 simulator coefficients and original studies were not modified. A new RNG namespace `SIM-F24A-KG-` creates new fictional trajectories under that same mechanism. Source-profile membership was selected by SHA independently of coverage or outcomes; 480 training, 160 validation and 160 held-out test base IDs are disjoint. Profiles originate from the same fictional pool: this is not external validation or a new real-patient cohort.

The primary workflow explicitly assumes 85% daily observation probability (`denser_assumed_monitoring`). It is a newly declared hypothetical monitoring study for a different outcome, not a revision of the older seven-day result. Original source-style sparse monitoring is an unchanged stress test. No seeds were retried or generator effects enlarged to obtain a desired score.

Generate 181 days; evaluate decision indices 28–179 (152 per profile). Require 28-day warm-up, observed current SpO₂ and at least seven prior SpO₂ readings in 28 days. A missing next-day measurement has an unknown label and never becomes a negative. The endpoint is the recorded measurement, including measurement noise; no persistence-duration requirement or clinician-confirmed event is implied.

There are 102 raw features: 17 fictional static EHR fields and 85 dynamic/current/past fields. Train-only medians, missing indicators and scaling give 204 transformed inputs. Identifiers, split, decision-day index, future observations/missingness, private burden and event/episode labels are excluded. Each training profile has equal total weight.

Two logistic candidates (C=0.1 and C=1) and one histogram gradient boosting candidate were declared. Highest validation average precision selected `{lock['selected']['name']}` (160 trees, depth 3, learning rate 0.06). The warning threshold `{lock['threshold']}` maximizes validation F1 subject to declared recall, precision and alert-rate constraints. Model/threshold/source hashes were locked before test trajectories were generated. No calibration was fitted on test and no test-driven refit occurred. Candidate validation results are retained in `model_selection_lock.json`.

## Held-out synthetic results

160 profiles; 24,320 calendar decisions; 20,600 runtime-eligible decisions (**84.70% coverage**). Of eligible decisions, 17,442 had an observed next-day label (**84.67% ascertainment**); 3,158 future labels remain unknown. The 17,442 evaluated rows include 2,228 low next-day readings (12.77%). Rows are repeated daily decisions, not independent patients or events.

| Metric | Selected model |
| --- | ---: |
| Accuracy | {s['accuracy']:.2%} |
| Always-no-warning accuracy | {s['always_no_warning_accuracy']:.2%} |
| Precision | {s['precision']:.2%} |
| Recall | {s['recall']:.2%} |
| Balanced accuracy | {s['balanced_accuracy']:.2%} |
| Average precision | {s['average_precision']:.4f} |
| ROC AUC | {s['roc_auc']:.4f} |
| Brier score | {s['brier']:.4f} |
| Warning fraction among evaluable decisions | {s['alert_fraction']:.2%} |
| True positive / false positive / false negative / true negative | 1718 / 318 / 510 / 14896 |

| Predeclared baseline | Accuracy | Average precision | Recall | Brier ↓ |
| --- | ---: | ---: | ---: | ---: |
{table}

All declared demo checks passed. Accuracy was not an acceptance criterion. The full model AP exceeds the current-only and prior-mean baselines, but no paired significance test or full-minus-EHR ablation was predeclared. Static-only versus full is not evidence of incremental EHR benefit. Actual fitted split usage includes {len(counts)} static fields ({', '.join(sorted(counts))}); that establishes input use, not benefit or causality.

Whole-profile bootstrap (300 draws, fixed seed) gives a 95% accuracy interval of 93.40–96.65%, precision 74.29–90.70%, recall 63.65–83.94%, AP 0.7901–0.9383 and Brier 0.0256–0.0438. Intervals describe sampling within this fictional mechanism, not uncertainty about clinical transfer. `test_evaluation.json` retains all bins and intervals. The reliability plot is descriptive; no post-test probability calibration was applied.

## Observation coverage stress test

With source-reference sparse monitoring, only 256 of 24,320 decision days are runtime eligible (**1.05% coverage**). Only 94 have a future observed label. Conditional accuracy of 93.62% on these 94 selected rows is not a usable service-level result. Recall for new low states is 0 of 3. Sparse archive applicability remains unsupported.

## Independent verification and serving

`verify_forecast24.py` independently recomputes tied-rank AP/AUC, confusion metrics and Brier using NumPy, checks disjoint source IDs and frozen hashes, confirms portable predictions (1,000 primary and 256 sparse rows), reconstructs all 1,824 feature decisions for the 12 visible examples, verifies next-day label construction, and performs 72 prefix/future-truncation checks. It does not rerun fitting or adjust thresholds.

The backend uses numeric JSON trees, NumPy and pandas; it never loads a pickle or requires sklearn for serving. SHA checks bind model, observation fixtures and exact frozen feature code. The 12 visible held-out examples were selected by lexical ID membership before their outcomes were viewed; display order follows the generated profile order. Their API contains only observations through the requested day, current inputs and the model output. Label/latent/audit files are not served.

Authenticated endpoints: `GET /api/v1/research/forecast24` and `GET /api/v1/research/forecast24/profiles/{{profile_id}}?day=90&origin=synthetic_forecast24`. IDs outside the fictional namespace return 404; real origins return 422. Warm-up or missing-current decisions return null score/warning and explicit reasons. Real-patient seven-day probabilities remain null. CSV is the human-facing export; Advanced JSON retains the selected prefix for technical reproducibility.

## Reproduction

Use Python 3.12, NumPy 2.3.5, pandas 2.2.3 and sklearn 1.7.2, with the locked dependency file. In the complete project, run `./.venv/bin/python src/verify_forecast24.py` to verify existing audit artifacts. The portable archive includes a self-contained `research/` snapshot and instructions for a fresh-directory replay. Do not overwrite locked reports/models to try alternative thresholds or seeds; register a new experiment version instead.

## Provenance and scope

Plan SHA-256: `{record['plan_sha256']}`

Model SHA-256: `{record['model_sha256']}`

The [official challenge listing](https://api.unstop.com/hackathons/digital-twin-challenge-2026-happiest-health-1757873) allows simulated EHR and simulated/open sensor series and asks for a localized predictive output; it does not prescribe a seven-day horizon. This is a narrower engineering demonstration and does not prove all submission requirements are complete.

The 90% cutoff is an illustrative study definition. [A published COPD wearable-oximetry observational study](https://pmc.ncbi.nlm.nih.gov/articles/PMC6594211/) reports time below 90%, which provides measurement-context background only. It does not validate a one-day forecast, the simulator, a COPD event definition or any treatment recommendation.
'''
    (OUT/'MODEL_CARD.md').write_text(text)
    a=np.load(ROOT/'data/processed/forecast24_v1/denser_assumed_monitoring_test_audit.npz');mask=a['gate']&np.isfinite(a['y'])
    precision,recall,_=precision_recall_curve(a['y'][mask],a['probability'][mask])
    plt.rcParams.update({'font.family':'DejaVu Sans','font.size':10,'axes.spines.top':False,'axes.spines.right':False})
    fig,ax=plt.subplots(1,3,figsize=(14,4.2),layout='constrained');color='#8260a1'
    ax[0].plot(recall,precision,color=color,label=f"Full model AP {s['average_precision']:.3f}");ax[0].axhline(s['prevalence'],ls='--',color='#888',label='Prevalence');ax[0].set(xlabel='Recall',ylabel='Precision',title='Next-day state forecast',xlim=(0,1),ylim=(0,1.02));ax[0].legend(loc='lower left')
    bins=[b for b in e['calibration_bins'] if b['rows']];ax[1].plot([0,1],[0,1],ls='--',color='#aaa');ax[1].plot([b['mean_probability'] for b in bins],[b['observed_fraction'] for b in bins],'o-',color=color);ax[1].set(xlabel='Mean model probability',ylabel='Observed low-state fraction',title='Descriptive reliability (unequal bin sizes)',xlim=(0,1),ylim=(0,1))
    values=[s['recall'],e['current_not_low_subset']['recall'],e['runtime_coverage'],sparse['runtime_coverage']];ax[2].barh(['All-state recall','New-low recall','Dense coverage','Sparse coverage'],values,color=[color,'#be842b',color,'#be842b']);ax[2].invert_yaxis();ax[2].set(xlim=(0,1.13),xlabel='Fraction',title='The limits behind the headline')
    for i,v in enumerate(values):ax[2].text(v+.02,i,f'{v:.2%}',va='center')
    fig.suptitle('Pulmira — held-out fictional profiles only; not clinical validation',fontweight='bold');fig.savefig(OUT/'evaluation.png',dpi=180);plt.close(fig)

if __name__=='__main__':main()
