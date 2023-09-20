---
"@remix-run/dev": patch
---

Fix server builds where serverBuildPath extension is `.cjs`.

Fix a bug that caused the server build file to be emitted into the assets directory if the value of `serverBuildPath` ended in `.cjs`.
