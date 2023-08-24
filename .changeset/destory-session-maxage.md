---
"@remix-run/server-runtime": patch
---

Fix `destroySession` for sessions using a `maxAge` cookie. The data in the cookie was always properly destroyed but when using `maxAge`, the cookie itself wasn't deleted because `Max-Age` takes precedence over `Expires` in the cookie spec.
