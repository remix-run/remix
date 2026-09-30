BREAKING CHANGE: The component runtime previously published from `@remix-run/ui` is now available from `@remix-run/component`. This package owns rendering, server rendering, JSX runtimes, animation, testing helpers, styles, and general-purpose mixins.

Most applications only need to rename their existing runtime imports:

```diff
-import { createRoot, css, on } from '@remix-run/ui'
+import { createRoot, css, on } from '@remix-run/component'
```

Apply the same rename to direct-package runtime subpaths such as `@remix-run/ui/animation`, `@remix-run/ui/server`, `@remix-run/ui/test`, and `@remix-run/ui/dev/refresh`. Applications using the `remix` package should make the equivalent move from `remix/ui` to `remix/component` and its subpaths.

The package now owns the JSX runtime, so direct-package consumers must also update TypeScript's JSX source:

```diff
 {
   "compilerOptions": {
     "jsx": "react-jsx",
-    "jsxImportSource": "@remix-run/ui"
+    "jsxImportSource": "@remix-run/component"
   }
 }
```

Replace an explicit `@remix-run/ui` runtime dependency with `@remix-run/component`. Keep `@remix-run/ui` only if the application also uses its remaining headless primitives:

```diff
 {
   "dependencies": {
-    "@remix-run/ui": "^0.11.0"
+    "@remix-run/component": "^0.8.0"
   }
 }
```

If you are upgrading directly from `@remix-run/component@0.7`, note that the runtime continued to evolve while it was published from `@remix-run/ui`. The `addEventListeners`, `keysEvents`, `pressEvents`, and `PressEvent` root exports are no longer available, and animation APIs are now imported from `@remix-run/component/animation` or `remix/component/animation` when using the `remix` package.
