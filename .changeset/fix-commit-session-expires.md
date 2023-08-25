---
"@remix-run/server-runtime": patch
---

Ensure `maxAge`/`expires` options passed to `commitSession` take precedence over the original `cookie.expires` value ([#6598](https://github.com/remix-run/remix/pull/6598))
