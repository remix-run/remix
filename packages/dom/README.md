# @remix-run/dom

DOM bindings for `@remix-run/reconciler`.

This package currently provides:

- a production-oriented `NodePolicy` implementation for DOM trees
- a DOM JSX runtime (`@remix-run/dom/jsx-runtime`)

## Usage

```ts
import { createReconciler } from '@remix-run/reconciler'
import { createDomNodePolicy } from '@remix-run/dom'

let reconciler = createReconciler(createDomNodePolicy(document), [])
let root = reconciler.createRoot(document.getElementById('app')!)
```

`tsconfig.json` example for DOM JSX:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@remix-run/dom"
  }
}
```

The DOM JSX runtime intentionally excludes framework-specific props such as
`connect`, `css`, and `animate`. Those behaviors are expected to be layered in
later via plugins.

`createDomNodePolicy(document)` implements:

- traversal (`firstChild`, `nextSibling`, `begin`, `enter`)
- node materialization (`resolveElement`, `resolveText`)
- mutations (`insert`, `move`, `remove`)
- hydration/adoption through policy-controlled resolution

More DOM-focused plugins (attributes, events, styles, refs, hydration strategy) can be layered on top of this policy through `@remix-run/reconciler` plugins.
