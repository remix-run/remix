BREAKING CHANGE: The core component APIs provided by `@remix-run/ui` have now moved to `@remix-run/component`. `@remix-run/ui` now provides headless, accessible UI primitives and animation utilities for Remix components.

The package root and its JSX runtime, server-rendering, test, development-refresh, and styled-component exports are no longer available. Move runtime imports to `@remix-run/component` or `remix/component`:

```diff
-import { createRoot, css, on } from '@remix-run/ui'
+import { createRoot, css, on } from '@remix-run/component'
```

If `jsxImportSource` currently points to `@remix-run/ui` or `remix/ui`, move it to the corresponding component entrypoint:

```diff
 {
   "compilerOptions": {
     "jsx": "react-jsx",
-    "jsxImportSource": "@remix-run/ui"
+    "jsxImportSource": "@remix-run/component"
   }
 }
```

Primitive APIs retain their existing contracts but now use flat package subpaths:

```diff
-import * as accordion from '@remix-run/ui/accordion/primitives'
+import * as accordion from '@remix-run/ui/accordion'
```

The package exports the `accordion`, `anchor`, `animation`, `combobox`, `listbox`, `menu`, `popover`, `select`, `tabs`, and `toggle` subpaths. The previous styled `breadcrumbs`, `button`, `checkbox`, `input`, and `radio` modules have been removed.

`@remix-run/ui` is currently unstable and versioned independently. It is not available through the `remix` package and must be installed and imported directly. For an application that otherwise uses the `remix` package:

```sh
npm i remix @remix-run/ui
```

If the asset server restricts imports with `allowPackages`, add `@remix-run/ui` now that these APIs are imported from the standalone package:

```diff
 {
   "assets": {
-    "allowPackages": ["remix"]
+    "allowPackages": ["@remix-run/ui", "remix"]
   }
 }
```

Direct-package consumers should install both `@remix-run/component` and `@remix-run/ui` when they use the component runtime with the primitives or animation utilities.
