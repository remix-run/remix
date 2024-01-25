---
"@remix-run/dev": patch
---

Vite: Write Vite manifest files to `build/.vite` directory rather than being nested within `build/client` and `build/server` directories.

They are now written to the top-level build directory, named `build/.vite/client-manifest.json` and `build/.vite/server-manifest.json`, or `build/.vite/server-{BUNDLE_ID}-manifest.json` when using server bundles.