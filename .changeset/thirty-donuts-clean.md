---
"@remix-run/dev": patch
---

Fix issue where consumers who had added Remix packages to Vite's `ssr.noExternal` option were being overridden by the Remix Vite plugin adding Remix packages to Vite's `ssr.external` option.
