# @remix-run/dom

DOM bindings for `@remix-run/reconciler`.

This package currently provides:

- a production-oriented `NodePolicy` implementation for DOM trees
- a DOM JSX runtime (`@remix-run/dom/jsx-runtime`)
- a DOM plugin pipeline (`createDomPlugins(document)`)
- first-class mixins (`on`, `css`) via `mixPlugin`

## Usage

```ts
import { createReconciler } from '@remix-run/reconciler'
import { createDomNodePolicy, createDomPlugins } from '@remix-run/dom'

let reconciler = createReconciler({
  policy: createDomNodePolicy(document),
  plugins: createDomPlugins(document),
})
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

The DOM JSX runtime supports host props like `style`, `connect`, and `mix`.
Event handling is expressed with mixins using `on(...)`.

Example:

```tsx
import { css, on } from '@remix-run/dom'

root.render(
  <button
    mix={[
      css({
        padding: '10px 14px',
        borderRadius: 8,
        backgroundColor: '#1f2937',
        color: '#fff',
      }),
      on('click', (event) => {
        console.log(event.currentTarget.tagName)
      }),
    ]}
  >
    Click
  </button>,
)
```

`createDomNodePolicy(document)` implements:

- traversal (`firstChild`, `nextSibling`, `begin`, `enter`)
- node materialization (`resolveElement`, `resolveText`)
- mutations (`insert`, `move`, `remove`)
- lifecycle hooks and mount metadata through `prepareHostMount`

## DOM plugin pipeline

`createDomPlugins(document)` returns:

- `createDocumentStatePlugin(document)`
- `mixPlugin`
- `stylePropsPlugin`
- `basicPropsPlugin`

`mixPlugin` powers declarative host behavior composition through `props.mix`.
