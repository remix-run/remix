---
"@remix-run/node": patch
---

Fix fileStorage session delete so it doesn't destroy the entire session directory when destroying an empty file session.
