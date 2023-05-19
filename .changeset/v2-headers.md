---
"@remix-run/server-runtime": minor
---

Added a new `future.v2_headers` future flag to opt into automatic inheriting of ancestor route `headers` functions so you do not need to export a `headers` function from every possible leaf route if you don't wish to.
