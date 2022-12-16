---
"remix": patch
"@remix-run/architect": patch
"@remix-run/netlify": patch
---

improve performance of `isBinaryType` in the netlify and architect adapters

previous implementation from arc itself has a complexity of O(N\*includesComplexity), where as now it is O(includesComplexity).
