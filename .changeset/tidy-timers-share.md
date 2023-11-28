---
"@remix-run/dev": patch
---

Allow consumers to opt-in to global Node polyfills by removing automatic polyfill installation from the Vite Node adapter which is used in the built-in dev server.

**This is a breaking change for projects using the unstable Vite plugin with the built-in Vite dev server.**

Instead, consumers who aren't using a custom server should call `installGlobals` in their Vite config.

```diff
import { unstable_vitePlugin as remix } from "@remix-run/dev";
+import { installGlobals } from "@remix-run/node";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

+installGlobals();

export default defineConfig({
  plugins: [remix(), tsconfigPaths()],
});
```
