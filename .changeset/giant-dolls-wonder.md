---
"@remix-run/react": patch
"@remix-run/server-runtime": patch
---

Properly handle status codes that cannot have a body in single fetch responses (204, etc.)
