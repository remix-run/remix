---
'@remix-run/ui': patch
---

Fix server rendering for `<textarea value>`, `<textarea defaultValue>`, `<input defaultValue>`, and `<input defaultChecked>` so initial form control content matches client rendering, and disallow textarea children in JSX types.
