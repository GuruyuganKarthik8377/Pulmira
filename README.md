# Pulmira
### An observation-led respiratory digital twin for COPD monitoring

**Digital Twin Challenge 2026 - hackathon research prototype**

Pulmira connects a respiratory monitoring workspace, a Python observation engine, a transparent seven-day formula outlook, a fictional scenario simulator and a separate experimental next-day ML forecast. It makes the distinction between recorded observations, assumptions and predictive evidence visible to the user.

> This is a research demonstration, not a clinical service. The seven-day outlook reports **projected change points**, not exacerbation probability. No clinically validated seven-day COPD predictor or treatment recommendation is provided.

## Team details

| Team member | Institution |
| --- | --- |
| Guruyugan Karthik | Chennai Institute of Technology |
| Harishram B | Chennai Institute of Technology |
| Harihara Srinivas T | Chennai Institute of Technology |

**College:** Chennai Institute of Technology, Chennai, India.

## Problem statement

Respiratory measurements and symptom reports often arrive from different devices, contexts and clocks. A single dashboard score can conceal sparse observations, stale readings and uncertain event labels. Pulmira explores how a patient-specific digital representation can preserve this context, show descriptive changes and support a review workflow while being explicit about what the available data cannot establish.

## Healthcare use case

A COPD monitoring research workflow: a reviewer examines available oxygen saturation, heart rate, respiratory rate and symptom history; checks observation coverage; inspects a formula-based seven-day outlook; records review acknowledgements; and exports a monitoring summary. A patient demonstration submits symptom check-ins for an explicitly fictional profile. Fictional simulator scenarios explore engineering assumptions independently of real-patient care.

## Submission materials

| Required item | Link / status |
| --- | --- |
| Team details | [Three team members](#team-details) |
| College/incubator information | [Chennai Institute of Technology](#team-details) |
| Project title | [Pulmira](#pulmira) |
| Problem statement | [Problem statement](#problem-statement) |
| Healthcare use case | [COPD monitoring research workflow](#healthcare-use-case) |
| Technical stack | [Frontend, backend and research tools](#technical-stack) |
| AI/ML model or framework details | [Formula, trained model and simulator](#aiml-model-and-formula-details) |
| 15-20 minute unlisted YouTube demo | [Watch the 15-minute narrated demo](https://youtu.be/yFkJaLO3df0) |
| Open-source license details | [MIT license for team-authored software](LICENSE); [data, dependency and artwork notices](THIRD_PARTY_NOTICES.md) |
| Architecture diagram in PDF/PPT format | [Architecture PDF](docs/Pulmira_Architecture.pdf) |
| Presentation covering project details and outcomes in PDF/PPT format | [PDF presentation](docs/Pulmira_Presentation.pdf) / [editable PowerPoint](docs/Pulmira_Presentation.pptx) |
| Access without additional permissions | Public repository and documents; demo is Unlisted and viewable without signing in. |

### Demo video

[**Watch Pulmira's complete working demonstration on YouTube**](https://youtu.be/yFkJaLO3df0) 

The recording uses the original integrated workspace, including historical TOLIFE/BIDMC views. This public repository provides the fictional monitoring demo, simulator and trained-model inference; participant-level clinical source archives are excluded, so those original source views are not populated in a fresh public clone. See [public distribution and privacy](#public-distribution-and-privacy).

## Implemented components

- A consistent React interface: homepage, demo entry, command centre, patient workspace, seven-day outlook, data quality/devices, review queue, simulator, recordings, reports, patient check-in, evidence/help and settings.
- FastAPI with signed demo sessions, clinician/patient role boundaries and a durable local SQLite ledger.
- Availability-aware historical reconstruction: measurements enter a decision only after both measurement and availability time; source contexts and unknown values remain distinct.
- Seven-day formula outlook with minimum-history/freshness gates, robust slopes, capped projections and explicit unknown-input ranges.
- Frozen fictional scenario comparisons and on-demand Python simulation with version/hash checks. Private simulated state and future labels are excluded from API responses.
- A bundled trained next-day model, portable inference, synthetic held-out examples and declared evaluation records.
- PDF monitoring summaries, CSV analysis exports and optional technical JSON exports.

## Public distribution and privacy

This repository is a reviewed **public export** of the integrated local project. It includes the frontend, backend, formula implementation, numeric trained model, simulator source and fictional fixtures. It excludes local databases, passwords/session secrets, environment files, personal home-directory paths, raw health datasets, TOLIFE participant-level observations/registry, BIDMC numeric recordings, old logs, backups, dependencies and video/audio files.

The default workspace uses `DEMO-SYNTHETIC-002`. The TOLIFE source selector is unavailable and the recordings catalogue is empty because real-person records are intentionally absent. Historical research aggregates remain clearly labelled; they do not describe the number of patients included in this public clone. No substitute fictional records are relabelled as TOLIFE or BIDMC patients. See [data and privacy policy](docs/DATA_AND_PRIVACY.md).

The original project used TOLIFE public observations and a separate BIDMC relative-clock monitoring demonstration. These populations, clocks and targets were never merged. Source references are retained for context; downloading additional clinical data is not needed to run the fictional demo.

## Technical stack

| Layer | Tools |
| --- | --- |
| Frontend | React 19, TypeScript 6, Vite 8, Tailwind CSS 4, Framer Motion, Lucide icons |
| Reports | jsPDF and jsPDF AutoTable; CSV and JSON exports |
| Backend | Python 3.12, FastAPI, Pydantic, Uvicorn, SQLite |
| Observation engine / formula | Python, versioned JSON policies, SHA-256 integrity checks |
| Simulation and model inference | NumPy 2.3.5, pandas 2.2.3; portable JSON tree model |
| Offline model research | scikit-learn; pinned environment in `research/requirements-forecast24-lock.txt` |
| Verification | pytest, Node test runner, TypeScript build, Oxlint, publication scanner |

Exact dependency versions are recorded in `frontend/package-lock.json` and the Python requirements lockfiles. No paid API, cloud credential or external AI service is required.

## AI/ML model and formula details

### Seven-day formula outlook

`backend/app/outlook7.py` and `backend/config/outlook7_v1.json` implement a transparent, **unvalidated formula**. It requires eligible recent history (at least four daily observations spanning three days within a 14-day lookback, with recent readings), oxygen saturation plus another vital signal, and keeps device/context streams separate. It projects bounded changes across seven future dates using robust slopes and combines declared weights for oxygen saturation, respiratory rate, heart rate and symptom answers.

Outputs are **0-100 change points**, never event percentages. Unknown inputs contribute an explicit possible range; this is not a statistical confidence interval. Its historical reference is not a clinically verified stable baseline. Predictive accuracy is **not established**. The original clinical seven-day probability fields remain null. Open **7-day outlook** in the sidebar for the fictional profile.

### Separate synthetic next-day ML experiment

| Item | Specification |
| --- | --- |
| Target | Next-day **simulated recorded SpO2 below 90%** |
| Model | Histogram gradient boosting, 160 iterations/trees, depth 3 |
| Inputs | 102 features: 17 static historical EHR inputs and 85 current/past dynamic features |
| Partition | 800 fictional base profiles: 480 training / 160 validation / 160 held-out test |
| Selection | Threshold selected on validation data and frozen before test evaluation |
| Primary scenario | Hypothetical denser monitoring; not measured real-world availability |
| Evaluable test decisions | 17,442 eligible days with observed next-day target |
| Test accuracy | **95.25%**; always-no-warning baseline **87.23%** |
| Test precision / recall | **84.38% / 77.11%** |
| Runtime prediction coverage | **84.70%** of 24,320 assessed calendar decisions |
| Key limitation | Recall for newly low readings from a currently non-low state is only **13.48%** |

These are frozen **synthetic experiment** results, not clinical COPD accuracy. Continuing low readings contribute heavily to performance; early incident deterioration prediction is not established. Unknown future readings are excluded from the labelled accuracy denominator. Static EHR incremental benefit has not been established by a predeclared ablation. The model does not predict seven-day COPD exacerbations.

The actual trained numeric model is included at [`backend/vendor/forecast24/model.json`](backend/vendor/forecast24/model.json). Its files are checked against [`manifest.json`](backend/vendor/forecast24/manifest.json) before serving. Research code, aggregate evaluation and the model card are in [`research/`](research/) and [`research/reports/forecast24_v1/MODEL_CARD.md`](research/reports/forecast24_v1/MODEL_CARD.md). The backend serves 12 held-out fictional profiles, uses a 28-day warmup and exposes only the selected available observation prefix.

### Fictional simulator

The frozen v2 generator provides 16 engineering sensitivity scenarios. Effects and thresholds are assumptions, not identified clinical causal effects. Paired streams and file hashes support reproducibility; they do not establish that a scenario improves patient outcomes. The starting profiles derive from [Sergey Nefedov's synthetic EHR dataset](https://www.kaggle.com/datasets/sergionefedov/patient-records-100k-patients-15-conditions), version 3, listed under **Apache-2.0**. All five raw-file hashes and reconstructed COPD input-table hashes were verified; see [source verification](docs/KAGGLE_SOURCE_VERIFICATION.json) and [third-party notices](THIRD_PARTY_NOTICES.md).

## Run locally

Prerequisites: **Python 3.12**, [uv](https://docs.astral.sh/uv/), and **Node.js 22.18+** (or a compatible newer version) with npm. The simulator requires the pinned NumPy/pandas versions; use the lockfile rather than upgrading them independently.

```sh
git clone https://github.com/GuruyuganKarthik8377/Pulmira.git
cd Pulmira
python3 run_pulmira.py
```

The launcher creates an isolated backend environment, installs the locked dependencies, builds the frontend and opens the demo. It binds only to `127.0.0.1`, normally port 8000, and chooses a free port up to 8010 if needed. Open the printed `/demo` URL; API documentation is at `/docs` on the same server. Stop with Ctrl+C.

Optional:

```sh
python3 run_pulmira.py --port 8010 --no-browser
```

Runtime data is generated locally under `backend/data/` and excluded from Git. No `.env` file or API key is required. The launcher creates its own local signing secret; never share that directory. `.env.example` documents optional environment settings and is not loaded automatically.

### Suggested demo route

1. Homepage: introduce the problem and the illustrative design notice.
2. Enter the fictional clinician workspace; open `DEMO-SYNTHETIC-002`.
3. Review observations, history and data coverage.
4. Open **7-day outlook**, explain its formula and unknown-input range.
5. Open the simulator, compare reference with denser monitoring, then run a fictional scenario.
6. Select the separate next-day ML tab and inspect a held-out profile after warmup.
7. Review notices, export a summary, then switch to the fictional patient check-in.
8. Close with evidence, limitations and the validation roadmap.

Homepage named profiles, risk percentages and charts are illustrative design examples; use the connected workspace for actual prototype outputs. This public demo has no physical wearable pairing, clinical messaging, production identity service or clinical deployment.

## Verification

```sh
cd frontend
npm ci
npm test
npm run lint
npm run build
cd ../backend
uv venv .venv --python 3.12
uv pip install --python .venv/bin/python -r requirements-lock.txt -r requirements-dev.txt
.venv/bin/python -m pytest -q tests ../research/tests
cd ..
python3 tools/check_publication.py
```

[Verification results](docs/VERIFICATION.md) distinguish functional/integrity checks from clinical validation. Tests use fictional fixtures; omitted private/source archives are not prerequisites. The research scripts include original cohort replay code, but recreating the full original training study requires its declared source inputs and environment. Runtime inference of the bundled model does not retrain it.

## Repository layout

```text
frontend/       React application, styles, assets and fictional test fixtures
backend/app/    API, roles, persistence, formula and inference adapters
backend/vendor/ Versioned observation engine, simulator and portable trained model
research/       Training/replay code, experiment configs and aggregate results
docs/           Architecture PDF, presentation PDF, privacy and verification notes
tools/          Public-distribution checks
```

## Open-source license and attribution

Team-authored software is released under the [MIT License](LICENSE). Dependencies retain their own licences. This does not relicense external datasets, fictional EHR source material, model/data exports or artwork; read [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for verified dataset attribution, modification notices and the scope of the team-owned illustrations. The team confirms ownership of the respiratory illustrations; the software MIT grant does not separately license the artwork. Real-person clinical datasets are not redistributed here.

## Next steps

For clinical prediction, obtain event-linked longitudinal data with verified onset, availability and surveillance; predeclare a patient-separated experiment; assess coverage, incident-event recall and calibration; then seek independent clinical validation. More synthetic rows alone do not establish clinical accuracy.
