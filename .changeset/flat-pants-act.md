---
"@remix-run/dev": patch
---

Automatically run `vite build --ssr` as a sub-process of the `vite build` command.

This means you no longer need to manually run `vite build --ssr` after `vite build`.

```diff
{
  "scripts": {
    "dev": "vite dev",
-    "build": "vite build && vite build --ssr"
+    "build": "vite build"
  }
}
```
