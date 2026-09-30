BREAKING CHANGE: `@remix-run/ui` now contains only headless, accessible UI primitives. Most existing `@remix-run/ui` usage is part of the component runtime and must move to `@remix-run/component`. The visually styled components and style mixins have been removed without replacements.

The package root and its JSX runtime, animation, server-rendering, test, development-refresh, and styled-component exports are no longer available. Move runtime imports to `@remix-run/component` or `remix/component`:

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

The package exports only the `accordion`, `anchor`, `combobox`, `listbox`, `menu`, `popover`, `select`, `tabs`, and `toggle` subpaths. The previous styled `breadcrumbs`, `button`, `checkbox`, `input`, and `radio` modules have been removed without replacements.

`@remix-run/ui` is currently unstable and versioned independently. It is not available through the `remix` package and must be installed and imported directly. For an application that otherwise uses the `remix` package:

```sh
npm i remix @remix-run/ui
```

Direct-package consumers should install both `@remix-run/component` and `@remix-run/ui` when they use the component runtime and the primitives.
