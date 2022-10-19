---
"remix": patch
"@remix-run/node": patch
---

Updated the `@remix-run/web-fetch` dependency. This fixes issues with `{Request | Response}.clone()` throwing when body is `null`. This update also adds additional Node.js-specific types to `fetch()` to support the use of `agent` from `http` and `https`.
