---
"@remix-run/server-runtime": minor
---

Add `errorHeaders` parameter to `headers()` functions to expose headers from thrown responses that bubble up to ancestor route boundaries.  If the throwing route contains the boundary, then `errorHeaders` will be the same object from `loaderHeaders`/`actionHeaders` for that route.
