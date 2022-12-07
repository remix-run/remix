---
"remix": patch
"@remix-run/dev": patch
---

Optimize `parentRouteId` lookup in `defineConventionalRoutes`

Local runs of production Remix builds:

- Realistic project w/ 700 routes: 10-15s -> <1s (>10x faster)
- Example project w/ 1,111 routes: 27s -> 0.104s (259x faster)
