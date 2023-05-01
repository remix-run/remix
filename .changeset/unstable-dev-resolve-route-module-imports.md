---
"@remix-run/dev": patch
---

Resolve imports from route modules across the graph back to the virtual module created by the v2 routes plugin. This fixes issues where we would duplicate portions of route modules that were imported.
