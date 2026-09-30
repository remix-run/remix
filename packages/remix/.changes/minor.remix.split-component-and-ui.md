BREAKING CHANGE: Most existing `remix/ui` usage now moves to `remix/component`. The component runtime, JSX runtimes, server rendering, animation, testing helpers, styles, and general-purpose mixins are available from the renamed entrypoints:

```diff
-import { createRoot, css, on } from 'remix/ui'
+import { createRoot, css, on } from 'remix/component'
```

Apply the same rename to runtime subpaths such as `remix/ui/animation`, `remix/ui/server`, `remix/ui/test`, and `remix/ui/dev/refresh`.

Applications that use the Remix JSX runtime must also update `jsxImportSource`:

```diff
 {
   "compilerOptions": {
     "jsx": "react-jsx",
-    "jsxImportSource": "remix/ui"
+    "jsxImportSource": "remix/component"
   }
 }
```

Component HMR entrypoints similarly move from `remix/ui-hmr` to `remix/component-hmr`. Rename the asset loader to `componentHmr()`:

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

If the development server uses the component HMR Node hook, rename that entrypoint too:

```diff
-node --import remix/ui-hmr/node server.ts
+node --import remix/component-hmr/node server.ts
```

The `remix` package no longer exports UI components or primitives. The visually styled components and style mixins have been removed. `@remix-run/ui` remains versioned independently in the v0.x range and is not part of the Remix 3.0 release candidate, so applications that use the remaining headless primitives must install it separately and import its flat subpaths directly:

```diff
-import * as accordion from 'remix/ui/accordion/primitives'
+import * as accordion from '@remix-run/ui/accordion'
```

This applies to all remaining primitives: `accordion`, `anchor`, `combobox`, `listbox`, `menu`, `popover`, `select`, `tabs`, and `toggle`. The previous styled `breadcrumbs`, `button`, `checkbox`, `input`, and `radio` modules have been removed.
