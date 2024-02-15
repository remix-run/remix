---
"@remix-run/cloudflare-pages": minor
"@remix-run/dev": minor
---

Vite: Cloudflare Proxy as a Vite plugin

**This is a breaking change for projects relying on Cloudflare support from the unstable Vite plugin**

The Cloudflare preset (`unstable_cloudflarePreset`) as been removed and replaced with a new Vite plugin:

```diff
 import {
    unstable_vitePlugin as remix,
-   unstable_cloudflarePreset as cloudflare,
+   cloudflareDevProxyVitePlugin as remixCloudflareDevProxy,
  } from "@remix-run/dev";
  import { defineConfig } from "vite";

  export default defineConfig({
    plugins: [
+     remixCloudflareDevProxy(),
+     remix(),
-     remix({
-       presets: [cloudflare()],
-     }),
    ],
-   ssr: {
-     resolve: {
-       externalConditions: ["workerd", "worker"],
-     },
-   },
  }); 
```

`remixCloudflareDevProxy` must come _before_ the `remix` plugin so that it can override Vite's dev server middleware to be compatible with Cloudflare's proxied environment.

Because it is a Vite plugin, `remixCloudflareDevProxy` can set `ssr.resolve.externalConditions` to be `workerd`-compatible for you.

`remixCloudflareDevProxy` accepts a `getLoadContext` function that replaces the old `getRemixDevLoadContext`.
If you were using a `nightly` version that required `getBindingsProxy` or `getPlatformProxy`, that is no longer required.
Any options you were passing to `getBindingsProxy` or `getPlatformProxy` should now be passed to `remixCloudflareDevProxy` instead.

This API also better aligns with future plans to support Cloudflare with a framework-agnostic Vite plugin that makes use of Vite's (experimental) Runtime API.
