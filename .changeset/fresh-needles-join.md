---
"remix": patch
"@remix-run/dev": patch
---

use `index` without leading underscore for colocation

when using flat routes with folder colocation, use `index` without leading underscore for route

before:

```
  app_.projects.$id.roadmap/
    _index.tsx
    chart.tsx
    update-timeline.server.tsx
```

after:

```
  app_.projects.$id.roadmap/
    index.tsx
    chart.tsx
    update-timeline.server.tsx
```
