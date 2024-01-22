---
"@remix-run/dev": patch
---

Vite: Add new `buildDirectory` option with a default value of `"build"`. This replaces the old `assetsBuildDirectory` and `serverBuildDirectory` options which defaulted to `"build/client"` and `"build/server"` respectively.

**This is a breaking change for consumers of the Vite plugin that were using the `assetsBuildDirectory` and `serverBuildDirectory` options.**

The Remix Vite plugin now builds into a single directory containing `client` and `server` directories. If you've customized your build output directories, you'll need to migrate to the new `buildDirectory` option, e.g.

```diff
import { unstable_vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    remix({
-      serverBuildDirectory: "dist/server",
-      assetsBuildDirectory: "dist/client",
+      buildDirectory: "dist",
    })
  ],
});
```
