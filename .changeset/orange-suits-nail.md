---
"@remix-run/architect": patch
"@remix-run/express": patch
---

- Switch to `headers.entries()` instead of non-spec-compliant `headers.raw()` in `sendRemixResponse`
- Update to `@remix-run/web-fetch@4.3.7`
