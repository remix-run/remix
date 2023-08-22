---
"@remix-run/dev": minor
"@remix-run/server-runtime": minor
---

detect built mode via `build.mode`

Prevents mode mismatch between built Remix server entry and user-land server.
Additionally, all runtimes (including non-Node runtimes) can use `build.mode` to determine if HMR should be performed.
