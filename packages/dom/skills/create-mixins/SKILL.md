---
name: create-mixins
description: Create and refactor @remix-run/dom mixins using the JSX element-factory API. Use when adding new mixins, updating existing mixins, or debugging mixin typing/lifecycle behavior with mix, queueTask, commit, and remove events.
---

# Create DOM Mixins

Use this skill to implement mixins for `@remix-run/dom` with the current reconciler contract.

## Target API

Author mixins with:

```ts
createMixin<[...args], NodeType>((handle, type) => {
  return (...args, props) => <handle.element {...props} />
  // or, when no prop changes are needed:
  // return (...args) => handle.element
})
```

Important behavior:

- `handle.element` is the JSX host element to return from mixins
- mixin render receives `props` (current composed props)
- return value must be a reconciler JSX element
- `handle.queueTask((node, signal) => ...)` runs with the materialized host node
- `handle.addEventListener('remove', ...)` is teardown
- `handle.addEventListener('commit', ...)` is per-commit lifecycle

## Authoring Rules

1. Return `<handle.element ... />` when changing props; return `handle.element` directly as a passthrough when no prop changes are needed.
2. Preserve incoming props by default when returning JSX: spread `...props`.
3. Compose nested mixins through `props.mix` (not custom prop names).
4. Keep side effects in lifecycle hooks or `queueTask`, not during pure prop transforms.
5. Use explicit node types in `createMixin<..., HTMLElement>` when node APIs are needed.
6. Do not use local `any` casts for `handle.element`; fix types in reconciler/dom if needed.

## Patterns

### 1) Pure prop transform

```tsx
let addClass = createMixin<[name: string], HTMLElement>((handle) => {
  return (name, props) => {
    let existing = typeof props.className === 'string' ? props.className : ''
    let className = existing ? `${existing} ${name}` : name
    return <handle.element {...props} className={className} />
  }
})
```

### 2) Imperative host-node effect

```tsx
let focusOnCommit = createMixin<[], HTMLElement>((handle) => {
  return (props) => {
    handle.queueTask((node, signal) => {
      if (signal.aborted) return
      node.focus?.()
    })
    return <handle.element {...props} />
  }
})
```

### 3) Event-driven mixin composition

```tsx
let clickable = createMixin<[], HTMLElement>((handle) => {
  return (props) => (
    <handle.element
      {...props}
      mix={[
        on('click', (event) => {
          // typed from on-mixin + element context
          console.log(event.currentTarget)
        }),
      ]}
    />
  )
})
```

## Implementation Checklist

- [ ] `createMixin` generic includes correct node type (`HTMLElement`, `Element`, etc.)
- [ ] render returns `<handle.element ... />` for prop changes, or `handle.element` for passthrough
- [ ] incoming `props` are preserved
- [ ] nested composition uses `mix`
- [ ] node side effects use `queueTask`
- [ ] teardown paths clean up state/listeners on `remove`
- [ ] no `as any` type escapes in mixin implementation

## Validation

Run after changes:

```bash
pnpm --filter @remix-run/dom run typecheck
pnpm --filter @remix-run/dom run test -- src/lib/mixins/on-mixin.test.tsx
pnpm --filter @remix-run/reconciler run test -- src/lib/mix-plugin.test.tsx
```

If type errors appear around `<handle.element ... />` or `mix`, fix reconciler/dom type surfaces instead of patching a demo with casts.
