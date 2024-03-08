---
"@remix-run/react": patch
---

Fix the use of mergeRefs in `NavLink` and `Link` by using useCallback to avoid redundant ref calls.
