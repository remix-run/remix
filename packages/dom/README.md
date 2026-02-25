# @remix-run/dom

DOM bindings for `@remix-run/reconciler`.

This package currently provides:

- a production-oriented `NodePolicy` implementation for DOM trees
- a DOM JSX runtime (`@remix-run/dom/jsx-runtime`)
- a DOM plugin pipeline (`createDomPlugins(document)`)
- first-class mixins (`on`, `css`, `animateLayout`) via `mixPlugin`
- `clientEntry(...)` markers/payload generation and `boot(...)` hydration runtime

## Agent-first orientation

If you are generating code:

1. Treat these files as source of truth:
   - `packages/dom/src/lib/jsx/jsx-runtime.ts`
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

## Server HTML streaming

For server rendering, use `renderToHTMLStream`:

```ts
import { renderToHTMLStream } from '@remix-run/dom'

let stream = renderToHTMLStream(<App />, {
  onError(error) {
    console.error(error)
  },
  async resolveFrame(src, signal) {
    let response = await fetch(src, { signal })
    return await response.text()
  },
})
```

Notes:

- returns `ReadableStream<Uint8Array>`
- does not require a `document`
- supports cancellation with `signal`
- supports `<frame src fallback>` async boundaries via `resolveFrame`
- includes server-side client-entry markers and `rmx-data` hydration payloads
- hydration/bootstrap options are intentionally out of scope for this server API

## Client runtime

Use `boot` in the browser to hydrate server-emitted client-entry boundaries and wire frame runtime behavior:

```ts
import { boot, RuntimeErrorEvent } from '@remix-run/dom'

let runtime = boot({
  document,
  async loadModule(moduleUrl, exportName) {
    let mod = await import(moduleUrl)
    let value = (mod as Record<string, unknown>)[exportName]
    if (typeof value !== 'function') {
      throw new Error(`Export "${exportName}" from "${moduleUrl}" is not a component function`)
    }
    return value
  },
  async resolveFrame(src, signal) {
    let response = await fetch(src, { signal })
    return await response.text()
  },
})

runtime.addEventListener('error', (event) => {
  if (event instanceof RuntimeErrorEvent) {
    console.error(event.error)
  }
})

await runtime.ready()
```

Runtime handle surface:

- `runtime.ready()` waits for initial boundary discovery + hydration
- `runtime.flush()` flushes hydrated reconciler roots
- `runtime.dispose()` tears down hydrated roots/runtime observers
- `runtime.frame` is always the root frame handle for the current URL
- `runtime.frames.get(name)` returns named frame handles (supports `await frame.reload()`)
- runtime errors are emitted as `'error'` events (`RuntimeErrorEvent` with `error` + `boundaryId`)
- runtime dispatches generic DOM lifecycle events:
  - `'dom-runtime:pre-apply'` (`DomRuntimePreApplyEvent`) before runtime applies a fragment/range update
  - `'dom-runtime:post-apply'` (`DomRuntimePostApplyEvent`) after runtime commits that update

Client runtime event notes:

- pre/post apply events are emitted on the `RuntimeHandle` (not `document`)
- pre/post apply events are generic runtime hooks (no CSS-specific semantics)
- `css` mixin uses pre-apply to adopt/remove server style tags from incoming frame fragments before insertion
- this avoids hydration/diff drift from transient server-only style nodes

### `clientEntry` SSR markers

Use `clientEntry` to annotate components that should emit hydration markers + metadata during SSR:

```ts
import { clientEntry, renderToHTMLStream } from '@remix-run/dom'

let CounterEntry = clientEntry('/entries/counter.js#Counter', (_handle) => (props: { label: string }) => (
  <button>{props.label}</button>
))

let stream = renderToHTMLStream(<CounterEntry label="Count" />)
```

Current behavior:

- wraps rendered output with `<!-- rmx:h:{id} --> ... <!-- /rmx:h -->`
- appends hydration metadata under `h` in `<script type="application/json" id="rmx-data">`
- hydrates on the client via `boot(...)`

`tsconfig.json` example for DOM JSX:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@remix-run/dom"
  }
}
```

The DOM JSX runtime supports host props like `style` and `mix`.
Event handling is expressed with mixins using `on(...)`.

Example:

```tsx
import { animateLayout, css, on } from '@remix-run/dom'

root.render(
  <button
    mix={[
      animateLayout({ duration: 240, easing: 'ease-out' }),
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
