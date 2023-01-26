---
"remix": patch
"@remix-run/dev": patch
---

fix flat routes on windows, so that it picks up new files and renames

fast glob will return posix style paths even on windows
