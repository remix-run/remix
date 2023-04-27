---
"@remix-run/cloudflare": patch
"@remix-run/deno": patch
"@remix-run/dev": patch
"@remix-run/node": patch
"@remix-run/server-runtime": patch
---

add logDevReady as replacement for platforms that can't initialize async I/O outside of the request response lifecycle.
