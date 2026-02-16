# @remix-run/dom

DOM bindings for `@remix-run/reconciler`.

This package currently provides a production-oriented `NodePolicy` implementation for DOM trees.

## Usage

```ts
import { createReconciler } from '@remix-run/reconciler'
import { createDomNodePolicy } from '@remix-run/dom'

let reconciler = createReconciler(createDomNodePolicy(document), [])
let root = reconciler.createRoot(document.getElementById('app')!)
```

`createDomNodePolicy(document)` implements:

- traversal (`firstChild`, `nextSibling`, `begin`, `enter`)
- node materialization (`resolveElement`, `resolveText`)
- mutations (`insert`, `move`, `remove`)
- hydration/adoption through policy-controlled resolution

More DOM-focused plugins (attributes, events, styles, refs, hydration strategy) can be layered on top of this policy through `@remix-run/reconciler` plugins.
