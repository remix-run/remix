---
"@remix-run/dev": patch
"@remix-run/server-runtime": patch
---

Pass request handler errors to `vite.ssrFixStacktrace` in Vite dev to ensure stack traces correctly map to the original source code
