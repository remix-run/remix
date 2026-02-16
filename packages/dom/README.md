# @remix-run/dom

DOM bindings for `@remix-run/reconciler`.

This package currently provides:

- a production-oriented `NodePolicy` implementation for DOM trees
- a DOM JSX runtime (`@remix-run/dom/jsx-runtime`)
- a Tier 1 DOM plugin pipeline for HTML/SVG props

## Usage

```ts
import { createReconciler } from '@remix-run/reconciler'
import { createDomNodePolicy, createDomPlugins } from '@remix-run/dom'

let reconciler = createReconciler(createDomNodePolicy(document), createDomPlugins())
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

## DOM plugin pipeline

`createDomPlugins()` currently returns this ordered pipeline:

- `innerHTMLPlugin`
- `stylePropsPlugin`
- `formStatePlugin`
- `svgNormalizationPlugin`
- `ariaDataAttributePlugin`
- `domPropertyOrAttributePlugin`
- `attributeFallbackPlugin`

The ownership model is explicit: each plugin should delete props it handles, and
`attributeFallbackPlugin` handles whatever is left.

Custom stacks can compose the same plugins directly:

```ts
import {
  attributeFallbackPlugin,
  createDomNodePolicy,
  domPropertyOrAttributePlugin,
  formStatePlugin,
  stylePropsPlugin,
} from '@remix-run/dom'
import { createReconciler } from '@remix-run/reconciler'

let reconciler = createReconciler(createDomNodePolicy(document), [
  stylePropsPlugin,
  formStatePlugin,
  domPropertyOrAttributePlugin,
  attributeFallbackPlugin,
])
```
