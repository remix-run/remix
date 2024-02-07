---
"@remix-run/dev": patch
---

Vite: Require `getBindingsProxy` from Wrangler for Cloudflare preset

**This is a breaking change for projects using the Cloudflare preset for the unstable Vite plugin.**

You must now pass in `getBindingsProxy` from Wrangler:

```diff
  // vite.config.ts
  import {
    unstable_vitePlugin as remix,
    unstable_cloudflarePreset as cloudflare,
  } from "@remix-run/dev";
  import { defineConfig } from "vite";
  import tsconfigPaths from "vite-tsconfig-paths";
+ import { getBindingsProxy } from "wrangler";

  export default defineConfig({
    plugins: [
      remix({
        presets: [
-         cloudflare()
+         cloudflare(getBindingsProxy)
        ],
      }),
      tsconfigPaths(),
    ],
    ssr: {
      resolve: {
        externalConditions: ["workerd", "worker"],
      },
    },
  });
```

Additionally, the `getRemixDevLoadContext` function now provides the request as part of the context:

```ts
cloudflare(getBindingsProxy, {
  getRemixDevLoadContext: ({ request, env }) => {
    // return augmented context here
  },
});
```

When using `getRemixDevLoadContext`, it's recommended that you create a `load-context.ts` file to define a shared `getLoadContext` function that you can use for both `getRemixDevLoadContext` in `vite.config.ts` as well as within `functions/[[path]].ts`.
For more, see the _Future > Vite > Cloudflare_ docs.
