---
"@remix-run/server-runtime": minor
---

Add `errorHeaders` parameter to the leaf `headers()` function to expose headers from thrown responses that bubble up to ancestor route boundaries. If the throwing route contains the boundary, then `errorHeaders` will be the same object as `loaderHeaders`/`actionHeaders` for that route.
