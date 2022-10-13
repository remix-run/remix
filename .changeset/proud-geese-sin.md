---
"remix": patch
"@remix-run/node": patch
---

Update @remix-run/web-fetch dependency. Fixes `{Request | Response}.clone()` throwing when body is null. Also adds additional Node.js specific types to `fetch()` to allow use of `agent` from `http` and `https`.
