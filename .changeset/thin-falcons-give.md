---
"@remix-run/dev": patch
---

Vite: Only write Vite manifest files if `build.manifest` is enabled within the Vite config

**This is a breaking change for consumers of Vite's `manifest.json` files.**

To explicitly enable generation of Vite manifest files, you must set `build.manifest` to `true` in your Vite config.

```ts
export default defineConfig({
  build: { manifest: true },
  // ...
})
```
