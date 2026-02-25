# @remix-run/reconciler

A plugin-driven reconciler runtime with a strict separation of responsibilities:

- the reconciler owns tree diffing and scheduling
- policies own platform-specific node operations
- plugins define semantic interpretation for policy-backed host nodes
- mixins provide composable behavior for both platform packages and application code

This package is platform-agnostic by design and currently ships with testing helpers
(`TestNodePolicy` and a testing JSX runtime).

## Agent-first orientation

If you are generating code:

1. Treat these files as source of truth over prose examples:
   - `packages/reconciler/src/lib/types.ts`
   - `packages/reconciler/src/lib/root.ts`
   - `packages/reconciler/src/lib/mix-plugin.ts`
2. Prefer small, composable plugins and mixins over adding feature logic to reconciler core.
3. Keep application behavior in components/mixins; reserve plugins for policy semantics.
4. Keep host/platform behavior in `NodePolicy`, not in generic reconciler code.

## Design overview

### `createReconciler({ policy, plugins })`

Creates a reconciler instance from:

- a `NodePolicy` implementation (`policy`) for host operations
- an optional plugin pipeline (`plugins`) that gives meaning to host props for that policy
- an internal runtime and scheduler

```ts
import { createReconciler } from '@remix-run/reconciler'

let reconciler = createReconciler({
  policy: myNodePolicy,
  plugins: [myPlugin],
})
```

### `createRoot(target)`

Returns a root `EventTarget` with:

- `render(renderable)` to schedule work
- `flush()` to force a sync flush
- `remove()` to remove rendered content
- `dispose()` to remove content and stop scheduling

`target` can be either:

- a single parent/container node
- a range tuple: `[startBoundary, endBoundary]`

```ts
let root = reconciler.createRoot(container)
root.render(<app>Hello</app>)
root.flush()
```

### `createStreamingRenderer({ policy, plugins })`

Creates a target-agnostic streaming renderer for server output:

- `policy` defines how host nodes become stream chunks
- `plugins` define prop semantics for that policy (same `special`/`terminal` model)

```ts
import { createStreamingRenderer } from '@remix-run/reconciler'

let renderer = createStreamingRenderer({
  policy: myStreamingPolicy,
  plugins: [myStreamingPlugin],
})
let root = renderer.createRoot(<app />)
let stream = root.stream()
```

Streaming lifecycle guarantees:

- emits `beforeCommit` before render traversal begins
- emits `afterCommit` after traversal + queued tasks + policy finalization
- dispatches `error` with `cause` when traversal/policy/plugin work throws
- `abort(reason)` cancels pending async work and errors the stream

Streaming root store:

- each `StreamingRendererRoot` exposes a root-scoped shared store
- use `root.getStore(key)`, `root.setStore(key, value)`, and `root.getOrCreateStore(key, create)`
- this is the intentional channel for policy/plugin coordination without out-of-band module state

Ordering guarantees:

- chunks from a node are emitted in traversal order
- promise-backed children emit after they resolve, preserving parent/child order

### Runtime and scheduler

The runtime handles:

- normalization of render values to internal nodes
- component resolution and per-instance setup/render lifecycle
- keyed and unkeyed child reconciliation
- mounting, patching, moving, and removing host nodes through `NodePolicy`
- host task execution and root task execution

The scheduler handles:

- batching root updates
- root lifecycle events (`beforeCommit` / `afterCommit`)
- cascading update guardrails

### Plugin model

Plugins are root-scoped factories with per-node setup scopes.

Component recursion is reconciler-owned. By the time plugins run, node input has
already been resolved to host elements.

Plugins should stay small and composable. The reconciler core should remain feature-agnostic.
Plugins are policy-level semantics, not application-level feature modules.

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
    return <handle.element {...currentProps} className={className} />
  }
})

let reconciler = createReconciler({
  policy: nodePolicy,
  plugins: [mixPlugin, myPropsPlugin],
})
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
  console.error(reconcilerError.cause)
})
```

Important behavior:

- plugin and host listener throws are captured and dispatched on root as `error` events
- plugins can still dispatch additional custom root events when needed

## Writing a `NodePolicy`

A `NodePolicy` is the platform adapter. It defines how the reconciler reads and mutates host nodes.

Implement these capabilities:

- host creation: `createElement`, `createText`, `setText`
- host traversal/introspection: `getParent`, `getType`, `firstChild`, `nextSibling`
- host mutations: `insert`, `move`, `remove`
- optional mount preprocessing: `prepareHostMount`

```ts
import { createNodePolicy } from '@remix-run/reconciler'

let nodePolicy = createNodePolicy(() => {
  return {
    createText(value) {
      return document.createTextNode(value)
    },
    setText(node, value) {
      node.nodeValue = value
    },
    createElement(_parent, type) {
      return document.createElement(type)
    },
    getType(node) {
      return node.tagName.toLowerCase()
    },
    getParent(node) {
      return node.parentNode
    },
    firstChild(parent) {
      return parent.firstChild
    },
    nextSibling(node) {
      return node.nextSibling
    },
    insert(parent, node, anchor) {
      parent.insertBefore(node, anchor)
    },
    move(parent, node, anchor) {
      parent.insertBefore(node, anchor)
    },
    remove(parent, node) {
      parent.removeChild(node)
    },
  }
})
```

Guidelines:

- keep operations deterministic and focused on host tree mutations
- do not embed feature behavior in the policy
- treat policy nodes as host implementation details

## Writing plugins

Plugins are intended to define **policy semantics** (for example, how a host prop is interpreted
for a given node policy). They are not the primary app-layer extension surface.
A plugin uses three intentional scopes:

- root scope: `definePlugin(root => ({ ... }))` (runs once when the reconciler is created)
- node setup scope: `setup(handle)` (runs once per active plugin+host pair)
- node lifecycle scope: returned object methods `commit(event)` and `remove()`

Use root lifecycle events directly when you need whole-tree coordination:

```ts
let plugin = definePlugin((root) => {
  root.addEventListener('beforeCommit', () => {
    // root-level snapshot work
  })
  root.addEventListener('afterCommit', () => {
    // root-level restore/finalize work
  })

  return {
    phase: 'special',
    keys: ['style'],
    shouldActivate(context) {
      return typeof context.delta.nextProps.style === 'object'
    },
    setup(handle) {
      let previous: null | Record<string, unknown> = null
      return {
        commit(event) {
          let next = event.delta.nextProps.style as Record<string, unknown>
          // diff/apply changes
          previous = next
          event.consume('style')
        },
        remove() {
          // teardown
          previous = null
        },
      }
    },
  }
})
```

Guidelines:

- keep each plugin focused on one concern
- use `keys` + `shouldActivate` for deterministic routing
- treat `commit(event)` as a snapshot; mutate via explicit methods (`replaceProps`, `consume`)
- use `handle.queueTask((node, signal) => ...)` for post-commit imperative work
- use `remove()` for node teardown, and root events for global lifecycle behavior
- do not put application-specific feature logic in plugins; encode app behavior in components/mixins

## Minimal flow

```ts
let reconciler = createReconciler({
  policy: nodePolicy,
  plugins: [myPlugin],
})
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
