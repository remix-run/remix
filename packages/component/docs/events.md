# Events

Event handling with the `on` prop and signal-based interruption management.

## Basic Event Handling

Use the `on` prop to attach event listeners to elements:

```tsx
function Button(handle: Handle) {
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
      Clicked {count} times
    </button>
  )
}
```

## Event Handler Signature

Event handlers receive the event object and an optional `AbortSignal`:

```tsx
on={{
  click(event) {
    // event is the DOM event
    event.preventDefault()
  },
  async input(event, signal) {
    // signal is aborted when handler is re-entered or component removed
    let response = await fetch('/api', { signal })
  }
}}
```

## Signals in Event Handlers

Event handlers receive an `AbortSignal` that's automatically aborted when:

- The handler is re-entered (user triggers another event before the previous one completes)
- The component is removed from the tree

This prevents race conditions when users create events faster than async work completes:

```tsx
function SearchInput(handle: Handle) {
  let results: string[] = []
  let loading = false

  return () => (
    <div>
      <input
        type="text"
        on={{
          async input(event, signal) {
            let query = event.currentTarget.value
            loading = true
            handle.update()

            // Passing signal automatically aborts previous requests
            let response = await fetch(`/search?q=${query}`, { signal })
            let data = await response.json()
            // Manual check for APIs that don't accept a signal
            if (signal.aborted) return

            results = data.results
            loading = false
            handle.update()
          },
        }}
      />
      {loading && <div>Loading...</div>}
      {!loading && results.length > 0 && (
        <ul>
          {results.map((result, i) => (
            <li key={i}>{result}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

The signal ensures only the latest search request completes, preventing stale results from overwriting newer ones.

## Multiple Event Types

Handle multiple events on the same element:

```tsx
function InteractiveBox(handle: Handle) {
  let state = 'idle'

  return () => (
    <div
      on={{
        mouseenter() {
          state = 'hovered'
          handle.update()
        },
        mouseleave() {
          state = 'idle'
          handle.update()
        },
        click() {
          state = 'clicked'
          handle.update()
        },
      }}
    >
      State: {state}
    </div>
  )
}
```

## Form Events

Common form event patterns:

```tsx
function Form(handle: Handle) {
  return () => (
    <form
      on={{
        submit(event) {
          event.preventDefault()
          let formData = new FormData(event.currentTarget)
          // Process form data
        },
      }}
    >
      <input
        name="email"
        on={{
          blur(event) {
            // Validate on blur
            let value = event.currentTarget.value
            if (!value.includes('@')) {
              event.currentTarget.setCustomValidity('Invalid email')
            }
          },
          input(event) {
            // Clear validation on input
            event.currentTarget.setCustomValidity('')
          },
        }}
      />
      <button type="submit">Submit</button>
    </form>
  )
}
```

## Keyboard Events

Handle keyboard interactions:

```tsx
function KeyboardNav(handle: Handle) {
  let selectedIndex = 0
  let items = ['Apple', 'Banana', 'Cherry']

  return () => (
    <ul
      tabIndex={0}
      on={{
        keydown(event) {
          switch (event.key) {
            case 'ArrowDown':
              event.preventDefault()
              selectedIndex = Math.min(selectedIndex + 1, items.length - 1)
              handle.update()
              break
            case 'ArrowUp':
              event.preventDefault()
              selectedIndex = Math.max(selectedIndex - 1, 0)
              handle.update()
              break
          }
        },
      }}
    >
      {items.map((item, i) => (
        <li key={i} css={{ backgroundColor: i === selectedIndex ? '#eee' : 'transparent' }}>
          {item}
        </li>
      ))}
    </ul>
  )
}
```

## Global Event Listeners

Use `handle.on()` for global event targets with automatic cleanup:

```tsx
function WindowResizeTracker(handle: Handle) {
  let width = window.innerWidth
  let height = window.innerHeight

  // Set up global listeners once in setup
  handle.on(window, {
    resize() {
      width = window.innerWidth
      height = window.innerHeight
      handle.update()
    },
  })

  return () => (
    <div>
      Window size: {width} x {height}
    </div>
  )
}
```

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

## Best Practices

### Prefer Press Events Over Click

For interactive elements, prefer `press` events over `click`. Press events provide better cross-device behavior:

- Fire on both mouse and touch interactions
- Handle keyboard activation (Enter/Space) automatically
- Prevent ghost clicks on touch devices
- Support press-and-hold patterns

```tsx
// ❌ Avoid: click doesn't handle all interaction modes well
<button on={{ click() { doAction() } }}>Action</button>

// ✅ Prefer: press handles mouse, touch, and keyboard uniformly
<button on={{ press() { doAction() } }}>Action</button>
```

Use `click` only when you specifically need mouse-click behavior (e.g., detecting right-clicks or modifier keys).

### Do Work in Event Handlers

Do as much work as possible in event handlers. Use the event handler scope for transient state:

```tsx
// ✅ Good: Do work in handler, only store what renders need
function SearchResults(handle: Handle) {
  let results: string[] = [] // Needed for rendering
  let loading = false // Needed for rendering loading state

  return () => (
    <div>
      <input
        on={{
          async input(event, signal) {
            let query = event.currentTarget.value
            // Do work in handler scope
            loading = true
            handle.update()

            let response = await fetch(`/search?q=${query}`, { signal })
            let data = await response.json()
            if (signal.aborted) return

            // Only store what's needed for rendering
            results = data.results
            loading = false
            handle.update()
          },
        }}
      />
      {loading && <div>Loading...</div>}
      {results.map((result, i) => (
        <div key={i}>{result}</div>
      ))}
    </div>
  )
}
```

### Always Check signal.aborted

For async work, always check the signal or pass it to APIs that support it:

```tsx
on={{
  async click(event, signal) {
    // Option 1: Pass signal to fetch
    let response = await fetch('/api', { signal })

    // Option 2: Manual check after await
    let data = await someAsyncOperation()
    if (signal.aborted) return

    // Safe to update state
    handle.update()
  }
}}
```

## See Also

- [Handle API](./handle.md) - `handle.on()` for global listeners
- [Patterns](./patterns.md) - Data loading and async patterns
