---
"@remix-run/react": patch
---

Ensure route modules are loaded even in failure cases. This addresses a long standing issue where you would end up in your root catch boundary if a form transition to another route threw. This no longer occurs, and you end up in the contextual boundary you'd expect.
