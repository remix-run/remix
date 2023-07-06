---
"@remix-run/react": patch
"@remix-run/server-runtime": patch
---

Properly handle `?_data` HTTP/Network errors that don't reach the Remix server and ensure they bubble to the `ErrorBoundary`
