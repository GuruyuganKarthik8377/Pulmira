# Public distribution verification

Verified locally on 19 October 2026. These are software and integrity checks, not clinical validation.

| Check | Result |
| --- | --- |
| Frontend tests | 50 passed, 0 failed, 0 skipped |
| Backend + research tests | 25 passed, 0 failed, 0 skipped in a fresh Git clone using a newly installed Python 3.12 environment |
| Frontend production build | Passed in a fresh Git clone after npm ci |
| Frontend lint | Passed with 2 existing Fast Refresh organization warnings in PatientContext.tsx |
| Public default imports | One fictional monitoring profile, 87 observations, 1 archived diary; zero real-person patients/recordings |
| Seven-day formula parity | Fictional final historical decision produces 21.8-28.8 change points, partial status reflecting an unknown input, seven future dates, null event probability |
| Role boundaries | Unauthenticated requests rejected; patient sessions cannot access another identity, clinical review queue or run simulator scenarios |
| Frozen simulator | All 32 frontend trace byte hashes match the frozen manifest |
| On-demand simulator | Reference and denser-monitoring runs reproduce each exposed frozen observable value |
| Model/formula integrity | Test fixtures verify numeric outputs, domain/clock boundaries and refusal of altered policy/generator files |
| Current check-in | Persists with true/false/null answers; retries are idempotent; a current submission does not change the historical outlook |
| Source privacy | Zero-row markers and absence of real-person source imports verified independently |
| Browser smoke check | Fictional source selected by default, real-source selector disabled, command centre and seven-day outlook load |
| Publication scan | Custom tracked-file privacy/credential scan and Gitleaks scan found no matching credentials in reviewed export |
| Image metadata | Frontend JPEG files have no EXIF fields |
| Submission documents | Architecture PDF and 11-page presentation visually reviewed; editable PowerPoint passed package/layout/font/import validation |

The Starlette test client emits one dependency deprecation warning. This does not fail the suite. All test credentials are clearly named local fixtures; they do not access a service.

A fresh clone was built from committed files only, with no dependency on the original project path. Locked frontend and backend dependencies installed successfully. All 75 tests passed again. Local npm installation reported zero known vulnerabilities at the time of verification.

The original local project has additional source-data checks. They do not count toward this public distribution's result because real-person archives are excluded. The public frontend tests use explicitly fictional fixtures for multi-context and missing-data cases rather than redistributing real-patient histories.

## Limits and outstanding items

- The final narrated unlisted YouTube video has not been uploaded, so the mandatory demo link remains pending.
- The inherited illustration source rights still need confirmation. The original Kaggle version 3 source is now verified by exact file hashes and reconstructed COPD-cohort hashes; the publisher lists Apache-2.0. Attribution and the licence copy are included, without relicensing the upstream data as MIT.
- Clinical seven-day event prediction, clinical calibration and independent clinical validation remain unavailable. Synthetic accuracy cannot establish those outcomes.
- Automated scanning cannot guarantee detection of every possible secret or sensitive fact. Runtime databases/secrets and raw health data are excluded from Git entirely.

## Dataset verification follow-up, 19 October 2026

A fresh download from Sergey Nefedov's Kaggle dataset version 3 matched all five original user-downloaded CSVs byte for byte. Re-extracting the 8,450-profile COPD subset reproduced every recorded input-table SHA-256 in the frozen simulator provenance. The apparent full-file hash difference was expected because the frozen inputs were filtered tables. See KAGGLE_SOURCE_VERIFICATION.json. This follow-up changes documentation and licence notices only; it does not retrain or alter the model, simulator assumptions, numerical profiles or scientific hash locks.
