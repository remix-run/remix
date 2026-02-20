# @remix-run/reconciler

A plugin-driven reconciler runtime with a strict separation of responsibilities:

- the reconciler owns tree diffing and scheduling
- policies own platform-specific node operations
- plugins own behavior and feature composition

This package is platform-agnostic by design and currently ships with testing helpers
(`TestNodePolicy` and a testing JSX runtime).

## Design overview

### `createReconciler(nodePolicy, plugins)`

Creates a reconciler instance from:

- a `NodePolicy` implementation (platform adapter)
- a plugin pipeline (feature layer)
- an internal runtime and scheduler

```ts
import { createReconciler } from '@remix-run/reconciler'

let reconciler = createReconciler(myNodePolicy, [myPlugin])
```

### `createRoot(container)`

Returns a root `EventTarget` with:

- `render(renderable)` to schedule work
- `branch(container)` to create a child root anchored to this root
- `flush()` to force a sync flush
- `remove()` to remove rendered content
- `dispose()` to remove content and stop scheduling

```ts
let root = reconciler.createRoot(container)
let nested = root.branch(nestedContainer)

root.render(<app>Hello</app>)
nested.render(<panel>Hi</panel>)
root.flush()
```

### Runtime and scheduler

The runtime handles:

- normalization of render values to internal nodes
- component resolution and per-instance setup/render lifecycle
- keyed and unkeyed child reconciliation
- mounting, patching, moving, and removing host nodes through `NodePolicy`
- host task execution and root task execution

The scheduler handles:

- batching root updates
- plugin lifecycle hooks (`beforeFlush` / `afterFlush`)
- cascading update guardrails

### Plugin model

Plugins can:

- register lifecycle listeners on plugin handles
- register host listeners (`insert` / `remove`)
- transform host input
- queue host tasks and schedule updates

Component recursion is reconciler-owned. By the time plugins run, node input has
already been resolved to host elements.

Plugins should stay small and composable. The reconciler core should remain feature-agnostic.

### Built-in `use` directives

`usePlugin()` provides a small directive system you can reuse across platforms. A
directive has three scopes:

- plugin scope (created once per plugin instance)
- host scope (created once per mounted host node)
- render scope (called every render with directive args)

```ts
import { createDirective, usePlugin } from '@remix-run/reconciler'

let focus = createDirective((_plugin) => (host) => (enabled: boolean) => {
  if (!enabled) return
  host.queueTask((node) => {
    if ('focus' in (node as object)) {
      ;(node as { focus?: () => void }).focus?.()
    }
  })
})
```

Use it from host props with `use={[...]}`:

```ts
let reconciler = createReconciler(nodePolicy, [usePlugin(), myPropsPlugin])
root.render(<input use={[focus(true)]} />)
```

### Creating mixins

Mixins are lightweight, composable host behaviors powered by `mixPlugin`.
Create them with `createMixin(...)`, then pass descriptors on `props.mix`.

Mixin scope model:

- factory scope: `createMixin((handle, type) => ...)` runs once per mounted host path
- render scope: returned function runs on each host commit with mixin args and composed props
- lifecycle scope: `handle` emits `commit` and `remove` events for side effects and teardown

```ts
import { createMixin, createReconciler, mixPlugin } from '@remix-run/reconciler'

let appendClass = createMixin<[name: string], EventTarget>((handle, _type) => {
  return (name, currentProps) => {
    let current = typeof currentProps.className === 'string' ? currentProps.className : ''
    let className = current ? `${current} ${name}` : name
    return {
      $rmx: true,
      type: handle.element,
      key: null,
      props: {
        ...currentProps,
        className,
      },
    }
  }
})

let reconciler = createReconciler(nodePolicy, [mixPlugin, myPropsPlugin])
let root = reconciler.createRoot(container)
root.render(<button mix={[appendClass('primary')]} />)
```

Notes:

- mixin render can return `void`/`null` for no-op
- mixins must return a reconciler element with the same host type (`handle.element`)
- returning `props.mix` from a mixin composes nested mixins
- `handle.update()` schedules the next render cycle
- `handle.queueTask((node, signal) => ...)` runs after commit with the materialized host node
- use `handle.addEventListener('remove', ...)` for teardown

## Error model

Root `error` events (`ReconcilerErrorEvent`) are the single reconciler error
surface for reconciler-owned execution paths (for example reconcile, scheduler,
root tasks, and host tasks).

```ts
root.addEventListener('error', (event) => {
  let reconcilerError = event as ReconcilerErrorEvent
  console.error(reconcilerError.context.phase, reconcilerError.error)
})
```

Important behavior:

- plugin and host listener throws are captured and dispatched on root as `error` events
- plugins can still dispatch additional custom root events when needed

## Writing a `NodePolicy`

A `NodePolicy` is the platform adapter. It defines how the reconciler reads and mutates host nodes.

Implement these capabilities:

- tree operations: `insert`, `move`, `remove`
- traversal: `begin`, `enter`, `firstChild`, `nextSibling`
- node materialization: `resolveText`, `resolveElement`

```ts
let nodePolicy = {
  resolveText(_parent, traversal, value) {
    // reuse from traversal when possible; otherwise create a text node
    return { node: createText(value), next: traversal }
  },
  resolveElement(_parent, traversal, type) {
    // reuse from traversal when possible; otherwise create an element node
    return { node: createElement(type), next: traversal }
  },
  // plus traversal and insert/move/remove methods
}
```

Guidelines:

- keep operations deterministic and focused on host tree mutations
- do not embed feature behavior in the policy
- treat policy nodes as host implementation details

## Writing plugins

A plugin receives a plugin handle and root, and can optionally return a host factory.

Typical plugin patterns:

- transform host props before patching
- respond to host insert/remove events
- queue host tasks for imperative work
- call `update()` for follow-up renders

```ts
let plugin = definePlugin((_pluginHandle, root) => (host) => {
  host.addEventListener('insert', (event) => {
    let insertEvent = event as HostInsertEvent<MyElementNode>
    insertEvent.node.attributes.id = String(insertEvent.input.props.id ?? '')
  })

  // Optional custom event.
  root.dispatchEvent(new Event('plugin-ready'))

  return (input) => input
})
```

Guidelines:

- keep plugin scope narrow (single concern)
- avoid cross-plugin coupling
- dispatch explicit root events only for domain-level plugin signals
- delete handled props so later plugins can iterate without extra guards

## Minimal flow

```ts
let reconciler = createReconciler(nodePolicy, [myPlugin])
let root = reconciler.createRoot(container)

root.addEventListener('error', (event) => {
  let errorEvent = event as ReconcilerErrorEvent
  console.error(errorEvent.context.phase, errorEvent.error)
})

root.render(<app />)
root.flush()
```

## Testing and JSX runtime

For tests, use:

- `@remix-run/reconciler/testing` helpers
- `createTestNodePolicy()` and `createTestContainer()`
- testing-only JSX runtime
- shared `Component<setup, props>` type for setup-aware component factories

`tsconfig.json` example:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@remix-run/reconciler/testing"
  }
}
```

Setup-aware component example:

```ts
import type { Component } from '@remix-run/reconciler'

let Counter: Component<{ start: number }, { label: string }> = (handle, setup) => {
  let count = setup.start
  return (props) => <host>{props.label}: {count}</host>
}

root.render(<Counter setup={{ start: 1 }} label="Clicks" />)
```
