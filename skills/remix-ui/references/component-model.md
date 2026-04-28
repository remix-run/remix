## Component Model

Every component has two phases:

1. Setup phase: runs once per instance
2. Render phase: returned function runs on initial render and every update

```tsx
import { on, type Handle } from 'remix/ui'

function Counter(handle: Handle, initialCount = 0) {
  let count = initialCount

  return (props: { label: string }) => (
    <button
      mix={[
        on('click', () => {
          count++
          handle.update()
        }),
      ]}
    >
      {props.label}: {count}
    </button>
  )
}
```

## State Rules

- Keep state in setup scope as plain JavaScript variables.
- Store only what affects rendering.
- Derive computed values in render.
- Do not mirror input state unless you truly need controlled behavior.
- Use `setup` only for one-time initialization inputs.

## Handle Usage

- `handle.update()`
  - schedules a rerender
  - await it when you need updated DOM before follow-up work
- `handle.queueTask(task)`
  - use for post-render DOM work, reactive loading, focus, scroll, or measurement
- `handle.signal`
  - aborted when the component disconnects
- `handle.id`
  - stable per instance
- `handle.context`
  - ancestor or descendant communication
- `handle.frame` and `handle.frames`
  - frame-aware behavior for client entries rendered inside frames

## Global Events

Prefer:

```tsx
import { addEventListeners, type Handle } from 'remix/ui'

function ResizeTracker(handle: Handle) {
  let width = window.innerWidth

  addEventListeners(window, handle.signal, {
    resize() {
      width = window.innerWidth
      handle.update()
    },
  })

  return () => <div>{width}</div>
}
```
