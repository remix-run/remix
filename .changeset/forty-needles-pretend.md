---
"@remix-run/serve": patch
---

Fix HMR for CJS projects using `remix-serve` and manual mode (`remix dev --manual`)

By explicitly busting the `require` cache, `remix-serve` now correctly reimports new server changes in CJS.
ESM projects were already working correctly and are not affected by this.
