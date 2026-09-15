# Component Model

Read before writing Remix UI state, props, lifecycle work, or shared component context. The installed `src/ui/README.md` covers the runtime overview. See [mixins and events](mixins-styling-events.md) for host behavior and [hydration](hydration-frames-navigation.md) for browser boundaries.

## Contents

- Setup once, render repeatedly: props, state, `handle.update()`
- Put work in the right lifecycle: events, refs, `queueTask`, signals
- Share context without freezing values

## Setup Once, Render Repeatedly

A component receives a handle and returns a zero-argument render function. Setup runs once per instance; the render function runs initially and on updates. There are no React hooks or implicit updates when a variable changes.

```tsx
import { on } from 'remix/ui'
import type { Handle } from 'remix/ui'

export function Counter(handle: Handle<{ initialCount?: number; label: string }>) {
  let count = handle.props.initialCount ?? 0

  return () => (
    <button
      type="button"
      mix={on('click', () => {
        count++
        handle.update()
      })}
    >
      {handle.props.label}: {count}
    </button>
  )
}
```

- Keep instance state in setup-scope variables. Derive values from current state/props inside render instead of maintaining redundant copies.
- `handle.props` has stable identity and current values. Destructuring `let { props } = handle` is safe; destructuring individual values during setup takes a snapshot.
- Initialization from `initialCount` happens once. A later prop update does not reset `count`. Use current props directly for controlled values, or choose an explicit reset/identity policy.
- Local variables changed in an event need `handle.update()` when the UI should reflect the change.
- Prefer browser-owned form inputs until controlled state is actually needed. Do not mirror every input value into component state.

## Put Work in the Right Lifecycle

| Work                                    | Where                                              |
| --------------------------------------- | -------------------------------------------------- |
| Compute output from current values      | Render function                                    |
| React to a click/input/submit           | `on(...)` event handler                            |
| Access a host element when inserted     | `ref(...)`                                         |
| Focus or measure after an update        | `handle.queueTask(...)` or await `handle.update()` |
| Browser-only setup after initial render | Queue a task during setup                          |
| Release subscriptions/timers on removal | `handle.signal`                                    |

`handle.queueTask(task)` queues work for the next commit; it does not itself request an update. When scheduling from an event, call `handle.update()` if a commit is needed. Tasks queued during setup/render run after that render.

The task's signal is aborted on a subsequent render or removal. The signal returned by `await handle.update()` is also render-scoped; check it before follow-up work if another update may have superseded it. Use `handle.signal` for work intended to last for the whole mounted component.

For example, start a browser timer after mounting, not during server rendering:

```tsx
import type { Handle } from 'remix/ui'

export function ElapsedTime(handle: Handle) {
  let seconds = 0

  handle.queueTask(() => {
    if (handle.signal.aborted) return
    let interval = setInterval(() => {
      seconds++
      handle.update()
    }, 1000)
    handle.signal.addEventListener('abort', () => clearInterval(interval), { once: true })
  })

  return () => <span>{seconds}s elapsed</span>
}
```

For `window`/`document` listeners, use the same queued setup and pass `{ signal: handle.signal }` to `addEventListener`. Do not install browser listeners at module scope or assume a client entry never renders on the server.

For async work caused by an event, use the event handler's signal with `fetch`, check for cancellation, and expose pending/error states. Do not turn a click into a special state flag merely to run its work in the next render. For prop-driven tasks, account for cancellation on _any_ re-render; a remembered URL alone does not prove an earlier request is still running or has completed.

## Share Context Without Freezing Values

`handle.context.get(Provider)` reads the nearest ancestor with that component identity. `handle.context.set(value)` stores a value but does not schedule an update.

When a provider replaces its value, read it during render rather than destructuring a primitive once during consumer setup:

```tsx
import { on } from 'remix/ui'
import type { Handle, RemixNode } from 'remix/ui'

export function ThemeProvider(
  handle: Handle<{ children?: RemixNode }, { theme: 'light' | 'dark' }>,
) {
  let theme: 'light' | 'dark' = 'light'
  handle.context.set({ theme })

  return () => (
    <section>
      <button
        type="button"
        mix={on('click', () => {
          theme = theme === 'light' ? 'dark' : 'light'
          handle.context.set({ theme })
          handle.update()
        })}
      >
        Toggle theme
      </button>
      {handle.props.children}
    </section>
  )
}

export function ThemeName(handle: Handle) {
  return () => <p>Theme: {handle.context.get(ThemeProvider).theme}</p>
}
```

Render `ThemeName` beneath `ThemeProvider`. For updates that should not rerender the whole provider subtree, expose a stable event-producing object (for example `TypedEventTarget`) and have consumers subscribe with their component signal. Read current values from that object in render; dispatching an event still needs a subscriber to call `handle.update()`.

Use `handle.id` to associate labels and descriptions with unique controls. Frame handles and state preservation across frame reloads are covered in [hydration and navigation](hydration-frames-navigation.md#frames-and-identity).
