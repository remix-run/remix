# Plugin Spike Architecture

This directory is a focused PoC for expressing reconciler features as internal plugins with
clear lifecycle boundaries and predictable teardown behavior.

## Motivation

The spike is designed to make features composable without losing the semantics of the existing
reconciler:

- Keep core reconciliation small and generic.
- Model feature logic as independent plugins (`presence`, `interaction`, `css`, etc.).
- Separate global concerns from per-node concerns.
- Support async remove workflows (`waitUntil`) while preserving keyed reclaim.
- Keep type ergonomics high via `definePlugin(...)` and typed event handles.

## Plugin model

Plugins can participate at three scopes:

1. **Plugin scope** (once per reconciler)
   - Attach listeners on plugin lifecycle:
     - `beforeFlush`
     - `afterFlush`
   - Return an optional host factory.

2. **Host scope** (once per mounted host instance)
   - Host factory shape:
     - `(hostHandle) => void | HostTransform`
   - Host handle APIs:
     - `addEventListener('insert' | 'remove', ...)`
     - `queueTask((node, signal) => { ... })` for post-transform host work in the current flush
   - Host lifecycle events:
     - `insert`
     - `remove` (`event.waitUntil(...)` supported)

3. **Render transform scope** (every host render)
   - Optional `HostTransform`:
     - `({ type, props }) => ({ type, props })`
   - Normalize/strip props and feed host-level listeners with derived data.

## Lifecycle semantics

- `insert` means a host instance has been mounted into the DOM.
- `remove` means that host instance is being removed; plugins can delay final DOM removal with
  `waitUntil`.
- `queueTask` lets host plugins run work during the same flush after transforms are applied.
- Host scope is **mount-scoped**. When a node is removed, that host scope is discarded.
- Keyed reclaim may reuse the same DOM element, but it gets a **fresh host scope** (fresh listeners,
  fresh plugin state) for the new mount.
- Transforms run on every render for the current mount.
- The core reconciler does **not** apply host props to DOM nodes; prop application is owned by
  plugins.

## Current PoC plugins

- `interaction`
  - Reads `props.on` in transform.
  - Applies listeners from `queueTask` with `@remix-run/interaction/createContainer`.
  - Disposes listener container on `remove`.

- `presence`
  - Reads `presenceMs` in transform.
  - Uses Web Animations API for enter/exit.
  - Delays removal via `event.waitUntil(exitAnimation.finished)`.
  - Handles interrupt/reclaim by canceling prior active animations for the element.

- `documentState`
  - Plugin-level `beforeFlush` captures focus/selection/scroll.
  - Plugin-level `afterFlush` restores UI state.

- `css`
  - Transform processes `props.css` into normalized style IDs and `data-css`.
  - Host scope tracks usage and applies/removes rules via `queueTask` and `remove`.
  - Built on `src/lib/style` (`processStyle`, `createStyleManager`).

- `connect`
  - First-class plugin (not special-cased in core).
  - Contract: `connect(node, signal?) => void`.
  - Runs on `insert`, not on ordinary updates.
  - Uses lazy signal setup: only allocates `AbortController` when callback expects `signal`.
  - Aborts signal on `remove`.

## Guidelines for additional plugins

- Put mount-lifetime resources in host scope.
- Put per-render prop shaping in transforms.
- Treat `input.props` as instructions: if a plugin handles a prop, consume it by deleting it.
- Put cross-tree/document behavior in plugin scope.
- Keep remove/abort cleanup idempotent.
- Add focused tests under `plugins/*.test.ts`.
