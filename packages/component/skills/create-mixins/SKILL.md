---
name: create-mixins
description: Create @remix-run/component mixins using createMixin with lifecycle-first semantics. Use when adding new mixins with correct runtime behavior and type flow.
---

# Creating Mixins (`@remix-run/component`)

Use this skill when authoring new mixins in `packages/component`.

The key principle: **model the real runtime contract first, then write the smallest code that matches it**.

## Core Runtime Semantics

Treat these as constraints, not suggestions:

1. A mixin handle is tied to one mounted host node lifecycle.
2. `insert` is the host-node availability point for imperative setup.
3. `remove` is teardown for that same lifecycle.
4. `queueTask` runs post-commit and receives `(node, signal)` for mixins.
5. Mixin render functions should stay pure; side effects belong in `insert`, `remove`, or queued work.

```tsx
createMixin<NodeType>((handle) => {
  // Setup runs once per handle lifecycle.
  handle.addEventListener('insert', (event) => {
    // event.node is the mounted host node for this lifecycle.
    // Attach imperative effects here.
  })

  handle.addEventListener('remove', () => {
    // Teardown for the same lifecycle.
    // Remove listeners, abort work, release resources.
  })

  return (props) => {
    // Render stays pure: derive props/JSX only.
    // Post-commit work goes in queueTask when needed.
    handle.queueTask((node) => {
      // Runs after commit with the concrete host node.
    })
    return <handle.element {...props} />
  }
})
```

If your implementation assumes semantics that do not exist (node swapping, repeated insert for the same handle, etc.), remove that logic.

## Authoring Rules

1. Start with lifecycle truth:
   - Use `insert` for attach/setup.
   - Use `remove` for detach/cleanup.
2. Keep state minimal and intentional:
   - Do not keep mutable state "just in case" if runtime guarantees make it unnecessary.
3. Be precise with defensive checks:
   - Use `invariant(...)` when a condition is guaranteed by runtime and violation means framework bug.
   - Use soft guards only when nullability is genuinely part of valid runtime flow.
4. Use `queueTask((node, signal) => ...)` for post-commit DOM work.
   - In most mixins, only `node` is needed.
   - Reach for `signal` only when work is async or cancellation-sensitive.
5. Do not add `signal.aborted` checks for purely synchronous work.
6. Favor function expression for helpers in scope.
7. Avoid speculative runtime assumptions.

## Preferred Patterns

### 1) Pure prop transform mixin

```tsx
let withTitle = createMixin((handle) => (title: string, props: { title?: string }) => (
  <handle.element {...props} title={title} />
))
```

### 2) Lifecycle-managed imperative listener

```tsx
let withFocus = createMixin<HTMLElement>((handle) => {
  handle.addEventListener('insert', (event) => {
    event.node.focus()
  })
  return (props) => <handle.element {...props} />
})
```

### 3) Post-commit rebind with node provided by queueTask

```tsx
handle.queueTask((node) => {
  node.removeEventListener(prevType, stableHandler, prevCapture)
  node.addEventListener(nextType, stableHandler, nextCapture)
})
```

## Anti-Patterns

- Adding state for hypothetical runtime scenarios.
- Broad defensive null checks where runtime guarantees presence.
- Mixing setup/cleanup side effects into render-only code paths.
- Using `signal.aborted` in synchronous non-racy code as boilerplate.
- Hiding semantic uncertainty with casts instead of fixing types/contracts.

## Mixin Creation Checklist

- [ ] Runtime assumptions are stated and match reconciler behavior.
- [ ] Lifecycle wiring uses `insert`/`remove` directly.
- [ ] State is minimal; no "might change later" scaffolding.
- [ ] `queueTask` used only where post-commit timing is required.
- [ ] Type flow from `createMixin<ThisType>` is preserved.
- [ ] Tests cover ordering, teardown, and type inference contracts.
