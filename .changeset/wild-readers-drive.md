---
"@remix-run/dev": patch
---

Vite: Write Vite manifest files to `build/.vite` directory rather than being nested within `build/client` and `build/server` directories.

**This is a breaking change for consumers of Vite's `manifest.json` files.**

Vite manifest files are now written to the Remix build directory. Since all Vite manifests are now in the same directory, they're no longer named `manifest.json`. Instead, they're named `build/.vite/client-manifest.json` and `build/.vite/server-manifest.json`, or `build/.vite/server-{BUNDLE_ID}-manifest.json` when using server bundles.
