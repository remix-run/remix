## Creating Mixins (`remix/ui`)

Use this reference when authoring new reusable mixins.

Use this reference both for app-level reusable mixins and for framework-level mixin authoring in
`packages/ui`.

The key principle: model the real runtime contract first, then write the smallest code that matches
it.

## Core Runtime Semantics

Treat these as constraints, not suggestions:

1. A mixin handle is tied to one mounted host node lifecycle.
2. `insert` is the host-node availability point for imperative setup.
3. `remove` is teardown for that same lifecycle.
4. `queueTask` runs post-commit and receives `(node, signal)` for mixins.
5. Mixin render functions should stay pure; side effects belong in `insert`, `remove`, or queued
   work.

```tsx
createMixin<NodeType>((handle) => {
  handle.addEventListener('insert', (event) => {
    // event.node is the mounted host node for this lifecycle.
  })

  handle.addEventListener('remove', () => {
    // Clean up listeners, timers, observers, and async work here.
  })

  return (props) => {
    handle.queueTask((node) => {
      // Post-commit work that needs the concrete host node.
    })

    return <handle.element {...props} />
  }
})
```

If your implementation assumes semantics that do not exist (node swapping, repeated `insert` for
the same handle, or extra host lifecycles hidden behind one handle), remove that logic.

## Authoring Rules

1. Start with lifecycle truth:
   - use `insert` for attach/setup
   - use `remove` for detach/cleanup
2. Keep state minimal and intentional.
3. Use `queueTask((node, signal) => ...)` only when post-commit timing is required.
4. Use `invariant(...)` for guaranteed runtime conditions instead of defensive casts.
5. Use soft guards only when nullability is genuinely part of valid runtime flow.
6. In most mixins, only `node` is needed from `queueTask`; reach for `signal` only when work is
   async or cancellation-sensitive.
7. Do not add `signal.aborted` checks for purely synchronous work.
8. Avoid speculative runtime assumptions.
9. Favor function expressions for helpers in scope.

## Preferred Patterns

### Pure prop transform

```tsx
let withTitle = createMixin((handle) => (title: string, props: { title?: string }) => (
  <handle.element {...props} title={title} />
))
```

### Lifecycle-managed imperative setup

```tsx
let withFocus = createMixin<HTMLElement>((handle) => {
  handle.addEventListener('insert', (event) => {
    event.node.focus()
  })

  return (props) => <handle.element {...props} />
})
```

### Post-commit DOM work

```tsx
handle.queueTask((node) => {
  node.removeEventListener(prevType, stableHandler, prevCapture)
  node.addEventListener(nextType, stableHandler, nextCapture)
})
```

## Avoid

- State for hypothetical runtime scenarios
- Broad null guards where runtime guarantees presence
- Setup/cleanup side effects inside render-only code paths
- Boilerplate `signal.aborted` checks for purely synchronous work
- Hiding semantic uncertainty with casts instead of fixing types or contracts

## Checklist

- [ ] Runtime assumptions match reconciler behavior
- [ ] Lifecycle wiring uses `insert` and `remove` directly
- [ ] State is minimal
- [ ] `queueTask` is only used when timing requires it
- [ ] Type flow from `createMixin<ThisType>` is preserved
- [ ] Tests cover ordering, teardown, and type inference contracts
