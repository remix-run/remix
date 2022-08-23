---
"@remix-run/server-runtime": patch
---

Make the loadContext parameter not optional so that augmenting AppLoadContext does not require checking if the context is undefined
