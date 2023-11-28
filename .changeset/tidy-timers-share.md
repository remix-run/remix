---
"@remix-run/dev": patch
---

Remove automatic global Node polyfill installation from the built-in Vite dev server and instead allow explicit opt-in.

**This is a breaking change for projects using the unstable Vite plugin without a custom server.**

If you're not using a custom server, you should call `installGlobals` in your Vite config instead.

```diff
import { unstable_vitePlugin as remix } from "@remix-run/dev";
+import { installGlobals } from "@remix-run/node";
import { defineConfig } from "vite";

+installGlobals();

export default defineConfig({
  plugins: [remix()],
});
```
