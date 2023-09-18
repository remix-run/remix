---
"@remix-run/serve": patch
---

Fix error caused by partially written server build

Previously, it was possible to trigger a reimport of the app server code before the new server build had completely been written. Reimporting the partially written server build caused issues related to `build.assets` being undefined and crashing when reading `build.assets.version`.
