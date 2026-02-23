---
name: create-components
description: Create and refactor @remix-run/dom components using the setup/render contract and ComponentHandle. Use when building app/demo components, wiring local state updates, and composing reusable mixins.
---

# Create DOM Components

Use this skill to author components for `@remix-run/dom` with the current reconciler runtime.

## Target API

Author components as setup functions:

```ts
function Component(handle: ComponentHandle, setup: SetupType) {
  // setup scope (runs once per mounted component instance)
  return (props: PropsType) => {
    // render scope (runs per render)
    return <div />
  }
}
```

## Authoring Rules

1. Use `ComponentHandle` from `@remix-run/dom` for setup function typing.
2. Keep mutable local state in setup scope (not module scope).
3. Trigger rerenders with `handle.update()`.
4. Use `handle.queueTask(...)` only for post-commit imperative work.
5. Prefer mixins (`mix`) for reusable host behavior (`on`, `css`, etc.).
6. Avoid `as any`; fix type surfaces at source if typing does not flow.
7. Do not model app-specific behavior as plugins; plugins are for node-policy semantics.

## Patterns

### 1) Local state + update

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

### 2) Post-commit host work

```tsx
import type { ComponentHandle } from '@remix-run/dom'

function Autofocus(handle: ComponentHandle, _setup: unknown) {
  return () => {
    handle.queueTask((signal) => {
      if (signal.aborted) return
      // schedule follow-up work that depends on committed host tree
    })
    return <input />
  }
}
```

### 3) Compose reusable behavior via mixins

```tsx
import { css, on } from '@remix-run/dom'
import type { ComponentHandle } from '@remix-run/dom'

function PrimaryButton(handle: ComponentHandle, _setup: unknown) {
  return (props: { label: string }) => (
    <button
      mix={[
        css({ padding: '10px 14px', borderRadius: 8 }),
        on('click', () => {
          void handle.update()
        }),
      ]}
    >
      {props.label}
    </button>
  )
}
```

## Implementation Checklist

- [ ] setup function uses `ComponentHandle`
- [ ] local mutable state is setup-scoped
- [ ] rerender paths call `void handle.update()`
- [ ] imperative effects are post-commit (`queueTask`)
- [ ] reusable host behavior is expressed via `mix`
- [ ] no local type escapes (`any`, unsafe casts)

## Validation

Run after edits:

```bash
pnpm --filter @remix-run/dom run typecheck
pnpm --filter @remix-run/dom run test
```
