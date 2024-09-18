---
"@remix-run/server-runtime": patch
---

Fix single-fetch types when `loader`, `action`, `clientLoader`, or `clientAction` return a mixture of bare objects, `json(...)`, `defer(...)`, and `unstable_data(...)`.
