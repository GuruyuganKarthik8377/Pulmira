# Public data and privacy boundary

This repository is a separate public export. The original integrated working project is preserved locally.

## Included

- Team member names and institution explicitly supplied for public hackathon submission.
- Team-authored application/research source, versioned policies, and aggregate metrics.
- The explicitly fictional contract illustration `DEMO-SYNTHETIC-002`.
- Fictional scenario observations, synthetic baseline profiles and held-out synthetic ML examples. These contain simulated clinical values, not verified real patient records. The exact Kaggle version 3 source is verified by file hashes and attributed to Sergey Nefedov under the publisher-listed Apache-2.0 licence; see the third-party notice.
- Two additional handwritten fictional test fixtures for multiple contexts and missing readings. They are test-only and never presented as real source patients.

## Excluded

Real-person TOLIFE observations, participant registry and final patient states; BIDMC recordings and source subject tokens; raw source CSV/ZIP files; SQLite databases; saved users/password hashes, signing secrets and sessions; `.env` files; old logs/exports/backups; personal home-directory paths; dependency environments; videos and audio.

The empty real-source inputs are explicit zero-row markers. Real-source catalogues are empty in a new public-demo database. No fictional substitute is labelled `real_open`. Original source counts shown in historical research narratives describe the earlier private working archive, not the population shipped here.

## Local demonstration access

Demo sessions are deliberately obtainable without an account. Signed role checks restrict patient sessions to the fictional example. The launcher binds to loopback. This is not production authentication or a hosted patient portal. Do not enter real patient information, and do not expose the demo server to the internet without a separate security/deployment design.

The signing secret is generated at launch and stored only in ignored `backend/data/`. Passwords created through local administration are hashed. No external API key is needed. Exclusion does not revoke an exposed credential: if a real credential was shared elsewhere, its owner must rotate it through the issuing service.

## Review scope

Publication checks inspect all Git-tracked text, gzip payloads and image metadata for high-confidence credentials, personal local paths, private addresses and disallowed runtime files. Tests inspect origin boundaries and absence of real-person runtime rows. These checks reduce known publication risk; they are not a guarantee against every possible secret or a clinical privacy certification.
