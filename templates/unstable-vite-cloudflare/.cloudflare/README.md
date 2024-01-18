This directory provides a temporary implementation of CloudFlare's [`getBindingsProxy` API][get-bindings-proxy].

Once [CloudFlare ships that feature][get-bindings-proxy], Remix will export a CloudFlare adapter that you can use:

```ts
// vite.config.ts
import { adapter as cloudflare } from "@remix-run/cloudflare";
import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    remix({
      adapter: cloudflare({
        bindings: {
          /* ... */
        },
      }),
    }),
  ],
});
```

[get-bindings-proxy]: https://github.com/cloudflare/workers-sdk/pull/4523
