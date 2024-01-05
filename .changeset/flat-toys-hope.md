---
"@remix-run/dev": minor
---

Add `unstable_serverBundles` option to Vite plugin to support splitting server code into multiple request handlers.

This is an advanced feature designed for hosting provider integrations. When compiling your app into multiple server bundles, there will need to be a custom routing layer in front of your app directing requests to the correct bundle. This feature is currently unstable and only designed to gather early feedback.

**Example usage:**

```ts
import { unstable_vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    remix({
      unstable_serverBundles: ({ branch }) => {
        const isAuthenticatedRoute = branch.some(
          (route) => route.id === "routes/_authenticated"
        );

        return isAuthenticatedRoute ? "authenticated" : "unauthenticated";
      },
    }),
  ],
});
```
