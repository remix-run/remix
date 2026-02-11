# Handle API

The `Handle` object provides the component's interface to the framework.

## `handle.update()`

Schedules a component update and returns a promise that resolves with an `AbortSignal` after
the update completes.

```tsx
function Counter(handle: Handle) {
  let count = 0

  return () => (
    <button
      on={{
        click() {
          count++
          handle.update()
        },
      }}
    >
      Count: {count}
    </button>
  )
}
```

Waiting for the update:

```tsx
function Player(handle: Handle) {
  let isPlaying = false
  let stopButton: HTMLButtonElement

  return () => (
    <button
      disabled={isPlaying}
      on={{
        async click() {
          isPlaying = true
          await handle.update()
          stopButton.focus()
        },
      }}
    >
      Play
    </button>
  )
}
```

## `handle.queueTask(task)`

Schedules a task to run after the next update. The task receives an `AbortSignal` that's aborted when:

- The component re-renders (new render cycle starts)
- The component is removed from the tree

**Use `queueTask` in event handlers when work needs to happen after DOM changes:**

```tsx
function Form(handle: Handle) {
  let showDetails = false
  let detailsSection: HTMLElement

  return () => (
    <form>
      <input
        type="checkbox"
        checked={showDetails}
        on={{
          change(event) {
            showDetails = event.currentTarget.checked
            handle.update()
            if (showDetails) {
              // Queue DOM operation after the new section renders
              handle.queueTask(() => {
                detailsSection.scrollIntoView({ behavior: 'smooth' })
              })
            }
          },
        }}
      />
      {showDetails && (
        <section connect={(node) => (detailsSection = node)}>Details content</section>
      )}
    </form>
  )
}
```

**Use `queueTask` for work that needs to be reactive to prop changes:**

When you need to perform async work (like data fetching) that should respond to prop changes, use `queueTask` in the render function. The signal will be aborted if props change or the component is removed, ensuring only the latest work completes.

### Anti-patterns

**Don't create states as values to "react to" on the next render with `queueTask`:**

```tsx
// ❌ Avoid: Creating state just to react to it in queueTask
function BadExample(handle: Handle) {
  let shouldLoad = false // Unnecessary state

  return () => (
    <div>
      <button
        on={{
          click() {
            shouldLoad = true // Setting state just to trigger queueTask
            handle.update()
            handle.queueTask(() => {
              if (shouldLoad) {
                // Do work
              }
            })
          },
        }}
      >
        Load
      </button>
    </div>
  )
}

// ✅ Prefer: Do the work directly in the event handler or queueTask
function GoodExample(handle: Handle) {
  return () => (
    <div>
      <button
        on={{
          click() {
            handle.queueTask(() => {
              // Do work directly - no intermediate state needed
            })
          },
        }}
      >
        Load
      </button>
    </div>
  )
}
```

**When showing loading state before async work, await `handle.update()` and use the returned signal:**

```tsx
function AsyncExample(handle: Handle) {
  let data: string[] = []
  let loading = false

  async function load() {
    loading = true
    let signal = await handle.update()

    let response = await fetch('/api/data', { signal })
    if (signal.aborted) return

    data = await response.json()
    loading = false
    handle.update()
  }

  return () => <button on={{ click: load }}>{loading ? 'Loading...' : 'Load data'}</button>
}
```

## `handle.signal`

An `AbortSignal` that's aborted when the component is disconnected. Useful for cleanup operations.

```tsx
function Clock(handle: Handle) {
  let interval = setInterval(() => {
    if (handle.signal.aborted) {
      clearInterval(interval)
      return
    }
    handle.update()
  }, 1000)

  return () => <span>{new Date().toString()}</span>
}
```

Or using event listeners:

```tsx
function Clock(handle: Handle) {
  let interval = setInterval(handle.update, 1000)
  handle.signal.addEventListener('abort', () => clearInterval(interval))

  return () => <span>{new Date().toString()}</span>
}
```

## `handle.on(target, listeners)`

Listen to an `EventTarget` with automatic cleanup when the component disconnects. Ideal for global event targets like `document` and `window`.

```tsx
function KeyboardTracker(handle: Handle) {
  let keys: string[] = []

  handle.on(document, {
    keydown(event) {
      keys.push(event.key)
      handle.update()
    },
  })

  return () => <div>Keys: {keys.join(', ')}</div>
}
```

## `handle.frames.top`

The root frame for the current runtime tree. This is useful when nested components need to reload the entire page/frame tree instead of only their nearest frame.

```tsx
function RefreshAllButton(handle: Handle) {
  return () => (
    <button
      on={{
        async click() {
          await handle.frames.top.reload()
        },
      }}
    >
      Refresh everything
    </button>
  )
}
```

## `handle.frames.get(name)`

Look up a named frame in the current runtime tree. This is useful when one frame action should refresh adjacent frame content.

Return value:

- `FrameHandle` when a frame with that `name` is currently mounted
- `undefined` when no such frame is mounted

```tsx
function CartRow(handle: Handle) {
  return () => (
    <button
      on={{
        async click() {
          await handle.frames.get('cart-summary')?.reload()
          await handle.frame.reload()
        },
      }}
    >
      Update Cart
    </button>
  )
}
```

If multiple mounted frames share the same name, the most recently mounted frame is returned.

## `handle.id`

Stable identifier per component instance. Useful for HTML APIs like `htmlFor`, `aria-owns`, etc.

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

## `handle.context`

Context API for ancestor/descendant communication. See [Context](./context.md) for full documentation.

```tsx
function App(handle: Handle<{ theme: string }>) {
  handle.context.set({ theme: 'dark' })

  return () => (
    <div>
      <Header />
      <Content />
    </div>
  )
}

function Header(handle: Handle) {
  let { theme } = handle.context.get(App)
  return () => <header css={{ backgroundColor: theme === 'dark' ? '#000' : '#fff' }}>Header</header>
}
```

**Important:** `handle.context.set()` does not cause any updates—it simply stores a value. If you need the component tree to update when context changes, call `handle.update()` after setting the context.

## See Also

- [Events](./events.md) - Event handling patterns with signals
- [Context](./context.md) - Context API with TypedEventTarget
- [Patterns](./patterns.md) - Common usage patterns
