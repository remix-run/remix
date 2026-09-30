Add the initial `@remix-run/component-hmr` package for Remix component HMR runtimes, browser transforms, and Node module hooks.

Applications previously using component HMR from `@remix-run/ui-hmr` should replace that dependency with `@remix-run/component-hmr`:

```diff
 {
   "devDependencies": {
-    "@remix-run/ui-hmr": "^0.1.1"
+    "@remix-run/component-hmr": "^0.1.0"
   }
 }
```

Applications using the `remix` umbrella package should rename `remix/ui-hmr` entrypoints to `remix/component-hmr`.

Rename the asset loader to `componentHmr()`:

```diff
-import { uiHmr } from 'remix/ui-hmr/assets'
+import { componentHmr } from 'remix/component-hmr/assets'

 let assetServer = createAssetServer({
   scripts: {
-    loaders: [uiHmr()],
+    loaders: [componentHmr()],
   },
})
```

Rename the Node import loader used by development servers:

```diff
-node --import remix/ui-hmr/node server.ts
+node --import remix/component-hmr/node server.ts
```

Direct-package consumers should use `@remix-run/component-hmr/node` instead. The browser and server runtime subpaths have moved in the same way. Rename the import-source type when it is referenced directly:

```diff
-import type { UiHmrImportSource } from '@remix-run/ui-hmr'
+import type { ComponentHmrImportSource } from '@remix-run/component-hmr'
```
