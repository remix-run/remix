---
"@remix-run/dev": patch
---

Vite: Add `manifest` option to Vite plugin to enable writing a `.remix/manifest.json` file to the build directory

**This is a breaking change for consumers of the Vite plugin's "server bundles" feature.**

The `build/server/bundles.json` file has been superseded by the more general `build/.remix/manifest.json`. While the old server bundles manifest was always written to disk when generating server bundles, the build manifest file must be explicitly enabled via the `manifest` option.
