# Component Model

Every component has two phases:

1. **Setup phase** — runs once when the component is created
2. **Render phase** — returned function runs on initial render and every update

```tsx
import { on, type Handle } from 'remix/component'

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

## Setup vs Props

The `setup` prop is special — it's only available in the setup phase and is automatically excluded
from render props. This prevents accidental stale captures:

```tsx
function Timer(handle: Handle, setup: { initialSeconds: number }) {
  let seconds = setup.initialSeconds

  return (props: { paused?: boolean }) => (
    <div>Time remaining: {seconds}s</div>
  )
}

// Usage: <Timer setup={{ initialSeconds: 60 }} paused={false} />
```

## State Rules

- Keep state in setup scope as plain JavaScript variables.
- Store only what affects rendering. Derive computed values in render.
- Do not mirror input state unless you truly need controlled behavior.
- Do work in event handlers, not in render. Use the handler scope for transient state.

```tsx
// Derive computed values in render
function TodoList(handle: Handle) {
  let todos: Array<{ text: string; completed: boolean }> = []

  return () => {
    let completedCount = todos.filter((t) => t.completed).length
    return <div>Completed: {completedCount}</div>
  }
}
```

## Handle API

### `handle.update()`

Schedules a rerender. Returns a promise that resolves with an `AbortSignal` after the update
completes. Await it when you need the updated DOM before follow-up work:

```tsx
on('click', async () => {
  isPlaying = true
  let signal = await handle.update()
  // DOM is now updated, safe to focus or measure
  stopButton.focus()
})
```

### `handle.queueTask(task)`

Schedules a task to run after the next update. The task receives an `AbortSignal` that aborts when
the component re-renders or is removed. Use for post-render DOM work, reactive data loading, or
hydration-sensitive setup:

```tsx
// Post-render DOM work in an event handler
on('click', () => {
  showDetails = true
  handle.update()
  handle.queueTask(() => {
    detailsSection.scrollIntoView({ behavior: 'smooth' })
  })
})

// Reactive data loading in render (re-runs when props change)
return (props: { url: string }) => {
  handle.queueTask(async (signal) => {
    let response = await fetch(props.url, { signal })
    let json = await response.json()
    if (signal.aborted) return
    data = json
    handle.update()
  })
  return <div>{data ?? 'Loading...'}</div>
}
```

Avoid creating intermediate state just to trigger `queueTask`. Do the work directly in the handler
or the queued task.

### `handle.signal`

An `AbortSignal` aborted when the component disconnects. Use for cleanup:

```tsx
function Clock(handle: Handle) {
  let interval = setInterval(handle.update, 1000)
  handle.signal.addEventListener('abort', () => clearInterval(interval))

  return () => <span>{new Date().toString()}</span>
}
```

### `handle.id`

Stable identifier per component instance. Useful for `htmlFor`, `aria-owns`, etc.:

```tsx
function LabeledInput(handle: Handle) {
  return () => (
    <div>
      <label htmlFor={handle.id}>Name</label>
      <input id={handle.id} type="text" />
    </div>
  )
}
```

### `handle.frame` and `handle.frames`

Frame-aware behavior for client entries rendered inside frames:

- `handle.frame.reload()` — reload the containing frame
- `handle.frame.src` — the URL of the containing frame
- `handle.frames.top` — the root frame (the whole page)
- `handle.frames.top.reload()` — reload the entire page/frame tree
- `handle.frames.get(name)` — look up a named frame; returns `FrameHandle | undefined`

```tsx
function RefreshButton(handle: Handle) {
  return () => (
    <button mix={[on('click', () => handle.frame.reload())]}>
      Refresh
    </button>
  )
}
```

### `handle.context`

Context for ancestor/descendant communication. See the context section below.

## Context

Use `handle.context.set()` to provide values and `handle.context.get(Provider)` to consume them.
`set()` does **not** trigger updates — call `handle.update()` if the tree needs to rerender.

```tsx
function ThemeProvider(handle: Handle<{ theme: 'light' | 'dark' }>) {
  let theme: 'light' | 'dark' = 'light'
  handle.context.set({ theme })

  return (props: { children: RemixNode }) => (
    <div>
      <button mix={[on('click', () => {
        theme = theme === 'light' ? 'dark' : 'light'
        handle.context.set({ theme })
        handle.update()
      })]}>
        Toggle
      </button>
      {props.children}
    </div>
  )
}

function ThemedContent(handle: Handle) {
  let { theme } = handle.context.get(ThemeProvider)
  return () => <div>Current theme: {theme}</div>
}
```

For granular updates without re-rendering the full subtree, use `TypedEventTarget`:

```tsx
import { TypedEventTarget, addEventListeners } from 'remix/component'

class Theme extends TypedEventTarget<{ change: Event }> {
  #value: 'light' | 'dark' = 'light'
  get value() { return this.#value }
  setValue(value: 'light' | 'dark') {
    this.#value = value
    this.dispatchEvent(new Event('change'))
  }
}

function ThemeProvider(handle: Handle<Theme>) {
  let theme = new Theme()
  handle.context.set(theme)

  return (props: { children: RemixNode }) => (
    <div>
      <button mix={[on('click', () => theme.setValue(theme.value === 'light' ? 'dark' : 'light'))]}>
        Toggle
      </button>
      {props.children}
    </div>
  )
}

function ThemedContent(handle: Handle) {
  let theme = handle.context.get(ThemeProvider)
  addEventListeners(theme, handle.signal, {
    change() { handle.update() },
  })
  return () => <div>Theme: {theme.value}</div>
}
```

## Global Events

Use `addEventListeners(target, handle.signal, listeners)` to listen to global targets with
automatic cleanup when the component disconnects:

```tsx
import { addEventListeners, type Handle } from 'remix/component'

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
