---
"@remix-run/dev": patch
---

Remove `@remix-run/node` from Vite plugin's `optimizeDeps.include` list since it was unnecessary and resulted in Vite warnings when not depending on this package.
