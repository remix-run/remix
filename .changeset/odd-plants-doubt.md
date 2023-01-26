---
"remix": patch
"@remix-run/react": patch
---

`<Link to>` can now accept absolute URLs. When the `to` value is an absolute URL, the underlying anchor element will behave as normal, and its URL will not be prefetched.