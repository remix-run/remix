---
"remix": patch
"@remix-run/dev": patch
---

update entry.client, requestIdleCallback/setTimeout doesn't really do anything more than startTransition.
