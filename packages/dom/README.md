# @remix-run/dom

DOM bindings for `@remix-run/reconciler`.

This package currently provides:

- a production-oriented `NodePolicy` implementation for DOM trees
- a DOM JSX runtime (`@remix-run/dom/jsx-runtime`)
- a DOM plugin pipeline (`createDomPlugins(document)`)
- first-class mixins (`on`, `css`) via `mixPlugin`

## Agent-first orientation

If you are generating code:

1. Treat these files as source of truth:
   - `packages/dom/src/jsx-runtime.ts`
   - `packages/dom/src/lib/dom-reconciler.ts`
   - `packages/dom/src/lib/dom-plugins.ts`
   - `packages/reconciler/src/lib/types.ts`
2. Use plugins for DOM policy semantics and mixins for reusable behavior (including app code).
3. Prefer strongly-typed `ComponentHandle` for component setup functions.

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

Important boundary:

- DOM plugins define meaning for DOM node-policy behavior (platform semantics)
- mixins are the reusable composition surface for both platform code and applications

DOM plugins follow the reconciler's scope-return model:

- root scope: register root lifecycle listeners (`beforeCommit`, `afterCommit`)
- node setup scope: `setup(handle)` runs once per active host node
- node lifecycle scope: return `{ commit(event), remove() }`

`stylePropsPlugin` and `basicPropsPlugin` are reference implementations of this pattern.

## Authoring components

Components use reconciler setup/render shape:

- setup function receives `ComponentHandle` and optional `setup` input
- setup returns a render function
- call `handle.update()` to schedule rerender
- use `handle.queueTask(...)` for post-commit side effects

```tsx
import type { ComponentHandle } from '@remix-run/dom'
import { on } from '@remix-run/dom'

function Counter(handle: ComponentHandle, _setup: unknown) {
  let count = 0
  return () => (
    <button
      mix={[
        on('click', () => {
          count++
          void handle.update()
        }),
      ]}
    >
      Count: {count}
    </button>
  )
}
```

Prefer mixins for reusable host behavior (app + platform) and keep component setup focused on local state orchestration.
