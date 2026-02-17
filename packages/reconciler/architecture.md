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

Conceptually, a plugin declares:

- **phase**: `'special' | 'terminal'`
- **priority**: deterministic intra-phase ordering
- **routing hints**: key-based candidate routing for fast participation checks
- **slot lifecycle**: mount/commit/unmount host participation without per-host closures

## Plugin API Shape

The target plugin shape is:

- `phase: 'special' | 'terminal'`
- `priority?: number`
- `routing?: { keys?: string[] }`
- `shouldActivate?(context)` optional participation gate
- `mountHost?(context)` lazy slot allocation for host-local state
- `commitHost?(context, slot)` operational hot path for active hosts
- `unmountHost?(context, slot)` deterministic teardown when participation ends/unmounts

Design intent:

- routing makes candidate selection cheap and explicit,
- mount/commit/unmount avoids per-host closure/object churn,
- active slots are tracked by plugin id for O(active) teardown,
- plugins consume props through context helpers (`consume`, `isConsumed`, `remainingPropsView`) instead of mutating `input.props`.

## Lifecycle Model

For a host node over time:

1. Reconciler builds host input (`props`, `propKeys`, children).
2. Route table selects candidate `special` plugins from key hints.
3. If no candidates and no active slots, reconciler takes a zero-allocation fast path.
4. Candidate plugins evaluate `shouldActivate` and lazily `mountHost` when needed.
5. Active plugins run `commitHost`.
6. `special` phase records consumed props; terminal behavior reads the remaining props view.
7. If participation ends, `unmountHost` runs and slot state is released.
8. On host unmount, active slots are torn down in deterministic order.

This model preserves plugin encapsulation while keeping inactive features near-zero cost.

## Performance Strategy

Performance is a first-class architectural concern, not a later optimization pass.

### Participation-First Execution

- Fast rejection for non-participating hosts via route-table key hints.
- No slot allocation unless participation is active.
- No plugin-local per-host closure allocation for hosts that do not use that feature.

### Allocation Discipline

- Reuse buffers and state where possible in reconciler internals.
- Avoid creating wrapper objects in hot loops when stable structures can be reused.
- Keep data flow linear and branch-light in commit paths.

### Plugin Isolation Without Runtime Tax

- Modular plugins should not imply "all plugins run on all nodes."
- Dispatch checks only routed candidates plus currently-active slots.
- Active slot instances are tracked explicitly for O(active) cleanup.

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

### `special` plugin with consumed props

```ts
let specialPlugin = definePlugin({
  phase: 'special',
  priority: 0,
  routing: { keys: ['style', 'connect'] },
  shouldActivate(context) {
    return 'style' in context.input.props || 'connect' in context.input.props
  },
  mountHost() {
    return { mounted: true }
  },
  commitHost(context) {
    if ('style' in context.input.props) context.consume('style')
    if ('connect' in context.input.props) context.consume('connect')
  },
  unmountHost() {},
})
```

### `terminal` plugin with remaining props

```ts
let terminalPlugin = definePlugin({
  phase: 'terminal',
  priority: 0,
  commitHost(context) {
    let props = context.remainingPropsView()
    // apply fallback props here in deterministic order
  },
})
```
