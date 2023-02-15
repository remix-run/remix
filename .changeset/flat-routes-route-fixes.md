---
"remix": patch
"@remix-run/dev": patch
---

fixes flat route inconsistencies where `route.{ext}` wasn't always being treated like `index.{ext}` when used in a folder
