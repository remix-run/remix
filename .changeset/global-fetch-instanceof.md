---
"remix": patch
"@remix-run/node": patch
---

ensures fetch() return is instanceof global Response by removing extended classes for NodeRequest and NodeResponse in favor of custom interface type cast.
