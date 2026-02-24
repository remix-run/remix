# Reconciler Architecture (Current Runtime)

This document is a practical guide for coding agents and contributors working on
`packages/reconciler` today.

> Note: older proposal terms like `routing`, `mountHost`, `commitHost`,
> `unmountHost`, and `branch()` are not current APIs.

## Source of Truth

When docs and code disagree, trust these files:

- `packages/reconciler/src/lib/types.ts`
- `packages/reconciler/src/lib/root.ts`
- `packages/reconciler/src/lib/mix-plugin.ts`

## Core Responsibilities

The reconciler owns:

- render normalization and tree diffing
- keyed/unkeyed child reconciliation
- component setup/render/update lifecycle
- plugin lifecycle dispatch (`setup`, `commit`, `remove`)
- scheduling and task flushing (`update`, `queueTask`)
- root lifecycle events (`beforeCommit`, `afterCommit`, `error`)

Host/platform-specific behavior stays in `NodePolicy`.

Separation of concerns:

- plugins provide policy semantics (how host props/lifecycle are interpreted)
- mixins are composable behavior units for both library/platform code and application code

## Runtime Shapes

### `createReconciler({ policy, plugins })`

Creates a reconciler instance from:

- `policy: NodePolicy<...>`
- `plugins?: PluginDefinition<any>[]`

### `ReconcilerRoot`

`createRoot(container)` returns an `EventTarget` with:

- `render(value)`
- `flush()`
- `remove()`
- `dispose()`

Error handling is event-based:

- root dispatches `ReconcilerErrorEvent` with `event.cause`

## Plugin Model

Plugins are defined with `definePlugin(...)` and run in two scopes:

1. **Root scope** (optional): `definePlugin((root) => ({ ...plugin }))`
   - register root listeners via `root.addEventListener(...)`
2. **Node scope**: `setup(handle)` returns `PluginNodeScope`
   - `commit(event)` runs each host commit while active
   - `remove()` runs when plugin deactivates or host unmounts

Current plugin contract:

- `phase: 'special' | 'terminal'`
- `priority?: number`
- `keys?: string[]`
- `shouldActivate?(context)`
- `setup?(handle) => void | { commit?, remove? }`

### Commit mutation model

`commit(event)` receives `PluginCommitEvent`, which exposes:

- `event.delta`
- `event.consume(key)`
- `event.isConsumed(key)`
- `event.remainingPropsView()`
- `event.replaceProps(nextProps)`

There is no `mergeProps` API.

## Mixin Model

Mixins are implemented by `mixPlugin` and authored with `createMixin(...)`.

Mixin scope model:

1. factory: `createMixin((handle, type) => renderFn)`
2. render: `renderFn(...args, props) => <handle.element ... />`
3. lifecycle: `handle` emits `commit`/`remove`

Important guarantees:

- mixins compose in order via `props.mix`
- each mixin receives current composed props
- final mixin output determines final host props
- `handle.queueTask((node, signal) => ...)` receives materialized host node

## NodePolicy Contract

A policy (created with `createNodePolicy(...)`) implements host operations used by reconciliation:

- node creation/text updates: `createElement`, `createText`, `setText`
- traversal/introspection: `getParent`, `getType`, `firstChild`, `nextSibling`
- placement/removal: `insert`, `move`, `remove`
- optional preprocessing: `prepareHostMount`

Keep policy methods deterministic and host-focused.

## Performance Notes

The current runtime optimizes for:

- key-based plugin candidate routing (`keys`)
- lazy plugin setup per host only when active
- deterministic teardown of active plugin scopes
- batched scheduler flush behavior

## Agent Guidelines

When generating code:

1. For app behavior, use components + mixins first; for policy semantics, use plugins.
2. Prefer explicit lifecycle handling (`commit`/`remove`, root events) over ad-hoc state mutation.
3. Use `replaceProps` + explicit object spreads when you need merge semantics.
4. Write behavior-first tests through public APIs; avoid internal-state coupling.
