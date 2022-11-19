---
"remix": patch
"@remix-run/node": patch
---

Update `@remix-run/web-fetch`. This addresses two bugs:
- It fixes a memory leak caused by unregistered listeners
- It adds support for custom `"credentials"` values (Remix does nothing with these at the moment, but they pass through for the consumer of the request to access if needed)
