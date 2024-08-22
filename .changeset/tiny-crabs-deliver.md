---
"@remix-run/dev": patch
---

Fix `dest already exists` build errors by only moving SSR assets to the client build directory when they're not already present on disk
