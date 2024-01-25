---
"@remix-run/dev": minor
"@remix-run/server-runtime": minor
---

Add `future.v3_throwAbortReason` flag to throw `request.signal.reason` when a request is aborted instead of an `Error` such as `new Error("query() call aborted: GET /path")`
