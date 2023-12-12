---
"@remix-run/dev": patch
---

Remove `unstable_viteServerBuildModuleId` in favor of manually referencing virtual module name `"virtual:remix/server-build"`.

**This is a breaking change for projects using the unstable Vite plugin with a custom server.**

This change was made to avoid issues where `@remix-run/dev` could be inadvertently required in your server's production dependencies.

Instead, you should manually write the virtual module name `"virtual:remix/server-build"` when calling `ssrLoadModule` in development.

```diff
-import { unstable_viteServerBuildModuleId } from "@remix-run/dev";

// ...

app.all(
  "*",
  createRequestHandler({
    build: vite
-      ? () => vite.ssrLoadModule(unstable_viteServerBuildModuleId)
+      ? () => vite.ssrLoadModule("virtual:remix/server-build")
      : await import("./build/server/index.js"),
  })
);
```
