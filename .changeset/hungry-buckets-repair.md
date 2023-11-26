---
"@remix-run/dev": patch
---

Remove `unstable_createViteServer` and `unstable_loadViteServerBuild` which were only minimal wrappers around Vite's `createServer` and `ssrLoadModule` functions when using a custom server.

**This is a breaking change for projects using the unstable Vite plugin with a custom server.**

Instead, we now provide `unstable_viteServerBuildModuleId` so that custom servers interact with Vite directly rather than via Remix APIs, for example:

```diff
-import {
-  unstable_createViteServer,
-  unstable_loadViteServerBuild,
-} from "@remix-run/dev";
+import { unstable_viteServerBuildModuleId } from "@remix-run/dev";
```

Creating the Vite server in middleware mode:

```diff
const vite =
  process.env.NODE_ENV === "production"
    ? undefined
-    : await unstable_createViteServer();
+    : await import("vite").then(({ createServer }) =>
+        createServer({
+          server: {
+            middlewareMode: true,
+          },
+        })
+      );
```

Loading the Vite server build in the request handler:

```diff
app.all(
  "*",
  createRequestHandler({
    build: vite
-      ? () => unstable_loadViteServerBuild(vite)
+      ? () => vite.ssrLoadModule(unstable_viteServerBuildModuleId)
      : await import("./build/server/index.js"),
  })
);
```
