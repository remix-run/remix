---
"@remix-run/dev": patch
---

Automatically optimize dependencies during development

Now Remix will tell Vite to find dependencies by crawling imports starting with your route modules.
This should resolve most (if not all) `504 Outdated Dependency` errors that could previously break HMR.

For users who were previously working around this limiation, you no longer need to explicitly add routes to Vite's `optimizeDeps.entries` nor do you need to disable the `remix-dot-server` plugin.
