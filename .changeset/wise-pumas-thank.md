---
"@remix-run/dev": patch
---

Vite: Errors at build-time when client imports .server default export

Remix already stripped .server file code before ensuring that server code never makes it into the client.
That results in errors when client code tries to import server code, which is exactly what we want!
But those errors were happening at runtime for default imports.
A better experience is to have those errors happen at build-time so that you guarantee that your users won't hit them.
