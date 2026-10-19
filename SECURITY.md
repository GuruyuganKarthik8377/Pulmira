# Security and responsible demonstration

This is a local research prototype with public demo sessions. It is not an internet-facing clinical application. Do not submit real patient data to the demonstration or include credentials/patient exports in an issue.

No external API credentials are needed. Runtime secrets, databases and environment files are ignored by Git. Run `python3 tools/check_publication.py` before committing. Never place a key in frontend source or a `VITE_` environment variable: frontend values can be visible in the browser.

To report a vulnerability, use the repository owner's GitHub profile to arrange a private report; describe the affected component without posting secrets or health records publicly. An exposed real key must be revoked/rotated with its issuer even after removing it from code.
