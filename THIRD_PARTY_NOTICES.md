# Third-party, model and data notices

## Scope of MIT

The root MIT license applies to team-authored application/research software and new submission documentation. It does not override third-party package licences or grant rights to external data, exported model/data materials or inherited artwork. Dependencies are installed from pinned lockfiles with their upstream licences; no dependency installation is vendored.

## Historical real-data references (not redistributed)

- TOLIFE Clinical Study A v2: https://zenodo.org/records/23263785 . Existing project metadata identifies CC BY 4.0. Patient-level source records, registry and saved states are excluded from this public export. Consult the source record for its authors, current release and licence before separate acquisition.
- BIDMC PPG and Respiration Dataset 1.0.0: https://physionet.org/content/bidmc/1.0.0/ . Existing project metadata identifies Open Data Commons Attribution License 1.0. Recordings are excluded. Reference: Pimentel et al., *Towards a Robust Estimation of Respiratory Rate from Pulse Oximeters*, DOI 10.1109/TBME.2016.2613124.

## Fictional EHR provenance - attribution/licence pending

The historical project imported five user-supplied Kaggle synthetic EHR CSVs (`patients`, `diagnoses`, `lab_results`, `medications`, `outcomes`). It selected 8,421 surviving fictional COPD profiles for initialization. Raw files are excluded. The exact Kaggle publisher, dataset URL and redistribution licence were not recorded in the supplied local provenance. They must be supplied and verified; **do not assume these materials are CC0 or covered by MIT**.

The retained baseline profile tables, fictional simulator exports, portable trained model and demonstration feature profiles derive from that synthetic experiment. Their original hashes and scientific provenance are preserved. The MIT software licence does not grant an additional data/model redistribution licence. Public access to files is not evidence that source data has an open licence. Reusers must verify the original terms before redistribution or other use. This unresolved attribution is a submission limitation, not a completed licensing check.

## Frontend artwork

The respiratory illustrations in `frontend/public/assets` were supplied as part of the existing project frontend. Their original creation/source licence was not documented in the supplied project. They are retained as provided for the project demonstration and are excluded from the scope of the team-code MIT grant. Confirm ownership/source rights before reusing the illustrations separately.

## Main dependency families

React, Vite, TypeScript, Tailwind, Framer Motion, Lucide, jsPDF, FastAPI, Pydantic, Uvicorn, NumPy, pandas and scikit-learn are third-party dependencies. Their own package licence files govern their use. Exact resolved versions are in the committed lockfiles. This notice is not an assertion that every dependency shares a single licence.
