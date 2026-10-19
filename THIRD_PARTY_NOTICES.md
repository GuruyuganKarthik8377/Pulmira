# Third-party, model and data notices

## Scope of MIT

The root MIT license applies to team-authored application/research software and new submission documentation. It does not override third-party package licences or grant rights to external data, exported model/data materials or inherited artwork. Dependencies are installed from pinned lockfiles with their upstream licences; no dependency installation is vendored.

## Historical real-data references (not redistributed)

- TOLIFE Clinical Study A v2: https://zenodo.org/records/23263785 . Existing project metadata identifies CC BY 4.0. Patient-level source records, registry and saved states are excluded from this public export. Consult the source record for its authors, current release and licence before separate acquisition.
- BIDMC PPG and Respiration Dataset 1.0.0: https://physionet.org/content/bidmc/1.0.0/ . Existing project metadata identifies Open Data Commons Attribution License 1.0. Recordings are excluded. Reference: Pimentel et al., *Towards a Robust Estimation of Respiratory Rate from Pulse Oximeters*, DOI 10.1109/TBME.2016.2613124.

## Verified fictional EHR source

**Sergey Nefedov**, *Patient Records 100K patients - 15 conditions*, Kaggle account `sergionefedov`, **version 3**, released **1 May 2026**. Source: https://www.kaggle.com/datasets/sergionefedov/patient-records-100k-patients-15-conditions . Kaggle lists **Apache License 2.0**. A full copy is retained in [`licenses/Apache-2.0.txt`](licenses/Apache-2.0.txt).

Verification on 19 October 2026: a fresh version 3 download matched all five user-supplied original CSV files byte for byte using SHA-256. Independently extracting `dx_copd == 1` reconstructed all five frozen simulator input-table hashes. Those hashes identify the filtered COPD tables, not the complete 100K raw tables. See [`docs/KAGGLE_SOURCE_VERIFICATION.json`](docs/KAGGLE_SOURCE_VERIFICATION.json) for the file-level evidence. The older project audit script also records this exact source URL.

The dataset publisher describes synthetic EHR data. It is not a clinical COPD forecasting cohort. Pulmira selected 8,450 fictional COPD profiles and excluded 29 with a recorded synthetic death before the simulation anchor, leaving 8,421 initialization profiles.

### Pulmira transformations and attribution

Pulmira filtered and linked the five tables, created historical baseline features, renamed fictional identifiers and generated separate simulated daily trajectories. It also trained an experimental next-day low-SpO2 model using those synthetic simulations. The retained CSV profile tables, scenario exports, model and feature examples are transformed or generated project materials, not unmodified Kaggle source files. Original numerical artifacts and frozen scientific hashes remain unchanged by this documentation update.

The raw 100K source tables are not redistributed in this repository. The Apache-2.0 source attribution and licence accompany the derived materials. The root MIT grant covers team-authored software and does not replace the upstream dataset licence. Directory-level `SOURCE_NOTICE.md` files identify the modified/generated materials without altering the hash-locked CSV/JSON numerical contents. No separate upstream NOTICE file was present in the verified five-file download. Preserve the upstream attribution, licence copy and modification notices when redistributing covered materials.

## Frontend artwork

The respiratory illustrations in `frontend/public/assets` were supplied as part of the existing project frontend. Their original creation/source licence was not documented in the supplied project. They are retained as provided for the project demonstration and are excluded from the scope of the team-code MIT grant. Confirm ownership/source rights before reusing the illustrations separately.

## Main dependency families

React, Vite, TypeScript, Tailwind, Framer Motion, Lucide, jsPDF, FastAPI, Pydantic, Uvicorn, NumPy, pandas and scikit-learn are third-party dependencies. Their own package licence files govern their use. Exact resolved versions are in the committed lockfiles. This notice is not an assertion that every dependency shares a single licence.
