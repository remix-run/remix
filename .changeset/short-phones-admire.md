---
"@remix-run/dev": patch
---

Improve Vite plugin performance

- Parallelize detection of route module exports
- Disable `server.preTransformRequests` in Vite child compiler since it's only used to process route modules
