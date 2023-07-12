---
"@remix-run/node": patch
---

- Upgrade to [`@remix-run/web-fetch@4.3.5`](https://github.com/remix-run/web-std-io/releases/tag/%40remix-run%2Fweb-fetch%404.3.5).   Submitted empty file inputs are now correctly parsed out as empty `File` instances instead of being surfaced as an empty string via `request.formData()`
