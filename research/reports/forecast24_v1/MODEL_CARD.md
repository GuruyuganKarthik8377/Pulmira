# Pulmira synthetic next-day measurement forecast — model card

Completed 17 October 2026. Experiment `forecast24_v1`. **Fictional engineering proof-of-concept; clinical validation false.**

## What the result supports

A working trained algorithm ingests fictional historical EHR and current/past sensor observations to forecast whether the **next calendar day's recorded simulated SpO₂ is below 90%**. Ongoing low readings are included. This is a one-day measurement-state forecast, not a seven-day COPD exacerbation model. It may demonstrate the challenge's two-stream algorithmic workflow; it does not establish reliable incident adverse-event warning or competition acceptance.

**Main limitation: recall for new low states when the current reading is not already low is only 13.48% (69 of 512 positive days).** The aggregate score is substantially driven by continuation of existing low readings. In the currently non-low subset, accuracy is 96.48%, below the 96.64% always-no-warning baseline. Do not describe the headline as 95% accurate prediction of new COPD deterioration.

## Locked study design

The plan and source hashes were saved before generation of the new trajectories. The frozen v2 simulator coefficients and original studies were not modified. A new RNG namespace `SIM-F24A-KG-` creates new fictional trajectories under that same mechanism. Source-profile membership was selected by SHA independently of coverage or outcomes; 480 training, 160 validation and 160 held-out test base IDs are disjoint. Profiles originate from the same fictional pool: this is not external validation or a new real-patient cohort.

The primary workflow explicitly assumes 85% daily observation probability (`denser_assumed_monitoring`). It is a newly declared hypothetical monitoring study for a different outcome, not a revision of the older seven-day result. Original source-style sparse monitoring is an unchanged stress test. No seeds were retried or generator effects enlarged to obtain a desired score.

Generate 181 days; evaluate decision indices 28–179 (152 per profile). Require 28-day warm-up, observed current SpO₂ and at least seven prior SpO₂ readings in 28 days. A missing next-day measurement has an unknown label and never becomes a negative. The endpoint is the recorded measurement, including measurement noise; no persistence-duration requirement or clinician-confirmed event is implied.

There are 102 raw features: 17 fictional static EHR fields and 85 dynamic/current/past fields. Train-only medians, missing indicators and scaling give 204 transformed inputs. Identifiers, split, decision-day index, future observations/missingness, private burden and event/episode labels are excluded. Each training profile has equal total weight.

Two logistic candidates (C=0.1 and C=1) and one histogram gradient boosting candidate were declared. Highest validation average precision selected `hist_depth3` (160 trees, depth 3, learning rate 0.06). The warning threshold `0.34907053131031723` maximizes validation F1 subject to declared recall, precision and alert-rate constraints. Model/threshold/source hashes were locked before test trajectories were generated. No calibration was fitted on test and no test-driven refit occurred. Candidate validation results are retained in `model_selection_lock.json`.

## Held-out synthetic results

160 profiles; 24,320 calendar decisions; 20,600 runtime-eligible decisions (**84.70% coverage**). Of eligible decisions, 17,442 had an observed next-day label (**84.67% ascertainment**); 3,158 future labels remain unknown. The 17,442 evaluated rows include 2,228 low next-day readings (12.77%). Rows are repeated daily decisions, not independent patients or events.

| Metric | Selected model |
| --- | ---: |
| Accuracy | 95.25% |
| Always-no-warning accuracy | 87.23% |
| Precision | 84.38% |
| Recall | 77.11% |
| Balanced accuracy | 87.51% |
| Average precision | 0.8965 |
| ROC AUC | 0.9698 |
| Brier score | 0.0334 |
| Warning fraction among evaluable decisions | 11.67% |
| True positive / false positive / false negative / true negative | 1718 / 318 / 510 / 14896 |

| Predeclared baseline | Accuracy | Average precision | Recall | Brier ↓ |
| --- | ---: | ---: | ---: | ---: |
| Training prevalence | 87.23% | 0.1277 | 0.00% | 0.1115 |
| Current-low persistence | 94.15% | 0.6236 | 77.02% | 0.0511 |
| Current SpO₂ only | 94.99% | 0.8647 | 72.40% | 0.0395 |
| Static EHR only | 15.50% | 0.1227 | 93.81% | 0.1150 |
| Prior 28-day SpO₂ mean | 94.72% | 0.8811 | 74.51% | 0.0354 |

All declared demo checks passed. Accuracy was not an acceptance criterion. The full model AP exceeds the current-only and prior-mean baselines, but no paired significance test or full-minus-EHR ablation was predeclared. Static-only versus full is not evidence of incremental EHR benefit. Actual fitted split usage includes 9 static fields (age_at_simulation_baseline, bmi, charlson_index, dx_type2_diabetes, historical_copd_adherence_pct, historical_valid_admissions, latest_creatinine, latest_glucose_fasting, smoking_current); that establishes input use, not benefit or causality.

Whole-profile bootstrap (300 draws, fixed seed) gives a 95% accuracy interval of 93.40–96.65%, precision 74.29–90.70%, recall 63.65–83.94%, AP 0.7901–0.9383 and Brier 0.0256–0.0438. Intervals describe sampling within this fictional mechanism, not uncertainty about clinical transfer. `test_evaluation.json` retains all bins and intervals. The reliability plot is descriptive; no post-test probability calibration was applied.

## Observation coverage stress test

With source-reference sparse monitoring, only 256 of 24,320 decision days are runtime eligible (**1.05% coverage**). Only 94 have a future observed label. Conditional accuracy of 93.62% on these 94 selected rows is not a usable service-level result. Recall for new low states is 0 of 3. Sparse archive applicability remains unsupported.

## Independent verification and serving

`verify_forecast24.py` independently recomputes tied-rank AP/AUC, confusion metrics and Brier using NumPy, checks disjoint source IDs and frozen hashes, confirms portable predictions (1,000 primary and 256 sparse rows), reconstructs all 1,824 feature decisions for the 12 visible examples, verifies next-day label construction, and performs 72 prefix/future-truncation checks. It does not rerun fitting or adjust thresholds.

The backend uses numeric JSON trees, NumPy and pandas; it never loads a pickle or requires sklearn for serving. SHA checks bind model, observation fixtures and exact frozen feature code. The 12 visible held-out examples were selected by lexical ID membership before their outcomes were viewed; display order follows the generated profile order. Their API contains only observations through the requested day, current inputs and the model output. Label/latent/audit files are not served.

Authenticated endpoints: `GET /api/v1/research/forecast24` and `GET /api/v1/research/forecast24/profiles/{profile_id}?day=90&origin=synthetic_forecast24`. IDs outside the fictional namespace return 404; real origins return 422. Warm-up or missing-current decisions return null score/warning and explicit reasons. Real-patient seven-day probabilities remain null. CSV is the human-facing export; Advanced JSON retains the selected prefix for technical reproducibility.

## Reproduction

Use Python 3.12, NumPy 2.3.5, pandas 2.2.3 and sklearn 1.7.2, with the locked dependency file. In the complete project, run `./.venv/bin/python src/verify_forecast24.py` to verify existing audit artifacts. The portable archive includes a self-contained `research/` snapshot and instructions for a fresh-directory replay. Do not overwrite locked reports/models to try alternative thresholds or seeds; register a new experiment version instead.

## Provenance and scope

Plan SHA-256: `a3a431f23fe8390ef0aee3625f1c23d376ad6e987ac07da04e0bbaf491606dbc`

Model SHA-256: `35ff2d82923641eb63e63ee6ad91fb9b6203cf7afa707a7b2a5a17cb9f11a807`

The [official challenge listing](https://api.unstop.com/hackathons/digital-twin-challenge-2026-happiest-health-1757873) allows simulated EHR and simulated/open sensor series and asks for a localized predictive output; it does not prescribe a seven-day horizon. This is a narrower engineering demonstration and does not prove all submission requirements are complete.

The 90% cutoff is an illustrative study definition. [A published COPD wearable-oximetry observational study](https://pmc.ncbi.nlm.nih.gov/articles/PMC6594211/) reports time below 90%, which provides measurement-context background only. It does not validate a one-day forecast, the simulator, a COPD event definition or any treatment recommendation.
