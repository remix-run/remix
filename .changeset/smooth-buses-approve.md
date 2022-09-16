---
"@remix-run/architect": patch
"@remix-run/express": patch
"@remix-run/netlify": patch
"@remix-run/vercel": patch
---

Ensured that requests are properly aborted on closing of a `Response` instead of `Request`
