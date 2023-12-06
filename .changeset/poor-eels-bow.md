---
"@remix-run/dev": patch
---

Add `vite:dev` and `vite:build` commands to the Remix CLI.

In order to handle upcoming Remix features where your plugin options can impact the number of Vite builds required, you should now run your Vite `dev` and `build` processes via the Remix CLI.

```diff
{
  "scripts": {
-    "dev": "vite dev",
-    "build": "vite build && vite build --ssr"
+    "dev": "remix vite:dev",
+    "build": "remix vite:build"
  }
}
```
