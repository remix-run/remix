# Reconciler Architecture

This document describes the intended architecture for `packages/reconciler` as a design target for a new branch rewrite.

The primary motivations are:

- **Modularity**: behavior is composed from plugins rather than a monolithic reconciler.
- **Encapsulation**: each feature owns its own state, lifecycle, and cleanup.
- **Performance**: hot paths avoid unnecessary work, especially allocations and host setup for non-participating nodes.

## Design Goals

- Keep the reconciler focused on tree diffing, node lifecycle, and scheduling.
- Keep host semantics in the node policy and plugins, not in reconciler conditionals.
- Make plugin participation explicit and lazy:
  - no host plugin setup for nodes that do not match.
  - no per-node feature state allocations until a plugin is active for that node.
- Ensure deterministic cleanup when participation ends or a node unmounts.
- Preserve a small, ergonomic authoring surface for plugin writers.

## Non-Goals

- Recreating a centralized monolith of feature conditionals in the reconciler.
- Forcing shared semantic operations across policies (plugins can perform direct host work).
- Eagerly allocating feature-specific state for all nodes.

## Core API Surface

## `createReconciler(...)`

`createReconciler` constructs a reconciler instance from:

- a **node policy** (host operations),
- a list of **plugins** (feature modules).

At runtime it returns root objects that can render, flush, remove, and dispose.

Responsibilities:

- schedule and execute reconciliation work,
- diff and patch child trees,
- invoke plugin host lifecycles in a stable order,
- route all host operations through the node policy,
- report errors with context (phase, root, plugin/node metadata).

## Node Policy

The node policy is the host abstraction layer. It defines how the reconciler reads and mutates the host tree.

Expected operations include:

- structure traversal (`begin`, `enter`, `firstChild`, `nextSibling`),
- placement (`insert`, `move`, `remove`),
- node resolution (`resolveElement`, `resolveText`).

Principles:

- policy methods are minimal, predictable primitives,
- reconciler does not embed DOM-specific behavior,
- plugins can use direct host node operations in `commit` where appropriate.

## `definePlugin(...)`

`definePlugin` is the authoring entrypoint for modular behavior.

Conceptually, a plugin has:

- **plugin scope** (root-level lifetime, shared state, root event listeners),
- **host scope factory** (per-host behavior contract),
- **host instance lifecycle** (activated only when participating).

High-level shape:

- `definePlugin(root => { ...; return () => ({ match, setup }) })`

Where:

- plugin scope initializes once per root,
- host scope defines how to test/activate per host node participation.

## Plugin API Shape

The target plugin shape is:

- `match(input)` decides whether the host node participates.
- `setup()` runs only when participation begins and returns host lifecycle handlers.
- `commit(input, node)` runs for active hosts after insertion/reconciliation.
- `remove(node)` runs when:
  - the node unmounts, or
  - participation transitions from active to inactive.

Design intent:

- `match` is a **participation gate** (for example, `'style' in input.props`).
- `setup` is **lazy**, so host state is not created for non-participating nodes.
- `commit` is the operational hot path for active hosts.
- `remove` guarantees teardown and prevents leaked state/listeners.

## Lifecycle Model

For a host node over time:

1. Reconciler produces host input.
2. Plugin `match(input)` is evaluated.
3. If `false`, no setup/state allocation occurs for that plugin on that host.
4. If `true` and not active, `setup()` is called once to create host-local lifecycle handlers.
5. While active, `commit(input, node)` runs on each relevant commit.
6. If participation ends, `remove(node)` is called and host-local state is released.
7. On unmount, `remove(node)` is called for any active plugin instances.

This model preserves plugin encapsulation while keeping inactive features near-zero cost.

## Performance Strategy

Performance is a first-class architectural concern, not a later optimization pass.

### Participation-First Execution

- Fast rejection for non-participating hosts via `match`.
- No host setup object creation unless `match` is true.
- No plugin-local maps/sets/closures allocated for hosts that do not use that feature.

### Allocation Discipline

- Reuse buffers and state where possible in reconciler internals.
- Avoid creating wrapper objects in hot loops when stable structures can be reused.
- Keep data flow linear and branch-light in commit paths.

### Plugin Isolation Without Runtime Tax

- Modular plugins should not imply "all plugins run on all nodes."
- Dispatch should be shaped so only potentially relevant plugins are checked.
- Active plugin instances should be tracked explicitly for O(active) cleanup.

## Ordering and Determinism

- Plugin declaration order defines execution order for matching plugins.
- Cleanup ordering is deterministic and stable across updates.
- Transition rules (inactive -> active, active -> inactive, unmount) are explicit and testable.

## Error Handling

- Errors are surfaced with phase context (reconcile/plugin/root task lifecycle).
- Plugin failures should isolate to the failing phase and preserve debuggability.
- Root-level event hooks (`beforeCommit`, `afterCommit`) remain available for instrumentation and orchestration.

## Why This Shape

This architecture preserves the plugin ergonomics that make feature work pleasant:

- clear scope boundaries,
- feature-local state and lifecycle,
- composability without spreading conditionals across reconciler internals.

At the same time, it addresses the key performance requirement:

- if a host is not participating in a feature, the runtime should do as close to **nothing** as possible for that feature (no setup, no state allocation, no teardown bookkeeping).

---

Example plugins:

### `documentState` plugin (root-scoped behavior)

This example shows a plugin that reacts to root commit lifecycle events and keeps document-level state in plugin scope. It does not require host participation.

```ts
// captures focus/scroll positions
let documentStatePlugin = definePlugin<Document>((root) => {
  let docState

  root.addEventListener('beforeCommit', () => {
    docState = captureDocumentState()
  })

  root.addEventListener('afterCommit', () => {
    restoreDocumentState(docState)
    docState = null
  })

  // No host behavior needed for this plugin, so return nothing
  // then the plugin doesn't participate at all in node reconciliation
})
```

### `on` prop plugin (host-participating behavior)

This example shows an event plugin that only participates for hosts with an `on` prop. Host setup is lazy and only allocated for participating nodes.

```ts
import { createContainer } from '@remix-run/interaction'
import type { EventsContainer } from '@remix-run/interaction'

let onPlugin = definePlugin<EventTarget>((root) => {
  return () => ({
    match(input) {
      return 'on' in input.props
    },

    setup() {
      // host scope: allocated only when match(input) is true
      let container: null | EventsContainer<EventTarget> = null

      return {
        commit(input, node) {
          let listeners = input.props.on
          if (!container) {
            container = createContainer(node)
          }

          container.set(listeners ?? {})
          delete input.props.on
        },

        remove() {
          container?.dispose()
          container = null
        },
      }
    },
  })
})
```
