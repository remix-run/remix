---
"remix": patch
"@remix-run/dev": patch
---

Ignore failed clean up attempts for dev server,
since cleanups are purely optimizations.
Worst-case, the next rebuild triggers a cleanup.

Do the same for `unstable_dev`.
