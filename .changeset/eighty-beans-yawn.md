---
"@remix-run/serve": patch
---

Remove redundant '@remix-run/node/install' import from `remix-serve` because it manually calls `installGlobals` separately
