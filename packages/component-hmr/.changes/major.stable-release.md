First stable release.

The `@remix-run/component-hmr` package provides Remix component HMR runtimes, browser transforms, and Node module hooks.

Applications previously using component HMR from `@remix-run/ui-hmr` should replace that dependency with `@remix-run/component-hmr`:

```diff
 {
   "devDependencies": {
-    "@remix-run/ui-hmr": "^0.1.1"
+    "@remix-run/component-hmr": "^1.0.0"
   }
 }
```

Applications using the `remix` package should rename `remix/ui-hmr` entrypoints to `remix/component-hmr`.

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

Direct-package consumers should use `@remix-run/component-hmr/node` instead. The browser and server runtime subpaths have moved in the same way.
