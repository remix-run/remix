# Patterns

Common patterns and best practices for building components.

## State Management

### Use Minimal Component State

Only store state that's needed for rendering. Derive computed values instead of storing them, and avoid storing input state that you don't need.

**Derive computed values:**

```tsx
// ❌ Avoid: Storing computed values
function TodoList(handle: Handle) {
  let todos: string[] = []
  let completedCount = 0 // Unnecessary state

  return () => (
    <div>
      {todos.map((todo, i) => (
        <div key={i}>{todo}</div>
      ))}
      <div>Completed: {completedCount}</div>
    </div>
  )
}

// ✅ Prefer: Derive computed values in render
function TodoList(handle: Handle) {
  let todos: Array<{ text: string; completed: boolean }> = []

  return () => {
    // Derive computed value in render
    let completedCount = todos.filter((t) => t.completed).length

    return (
      <div>
        {todos.map((todo, i) => (
          <div key={i}>{todo.text}</div>
        ))}
        <div>Completed: {completedCount}</div>
      </div>
    )
  }
}
```

**Don't store input state you don't need:**

```tsx
// ❌ Avoid: Storing input value when you only need it on submit
function SearchForm(handle: Handle) {
  let query = '' // Unnecessary state

  return () => (
    <form
      on={{
        submit(event) {
          event.preventDefault()
          let formData = new FormData(event.currentTarget)
          let query = formData.get('query') as string
          // Use query for search
        },
      }}
    >
      <input name="query" />
      <button type="submit">Search</button>
    </form>
  )
}

// ✅ Prefer: Read input value directly from the form
function SearchForm(handle: Handle) {
  return () => (
    <form
      on={{
        submit(event) {
          event.preventDefault()
          let formData = new FormData(event.currentTarget)
          let query = formData.get('query') as string
          // Use query for search - no component state needed
        },
      }}
    >
      <input name="query" />
      <button type="submit">Search</button>
    </form>
  )
}
```

### Do Work in Event Handlers

Do as much work as possible in event handlers with minimal component state. Use the event handler scope for transient event state, and only capture to component state if it's used for rendering.

```tsx
// ✅ Good: Store state that affects rendering
function Toggle(handle: Handle) {
  let isOpen = false // Needed for rendering conditional content

  return () => (
    <div>
      <button
        on={{
          click() {
            isOpen = !isOpen
            handle.update()
          },
        }}
      >
        Toggle
      </button>
      {isOpen && <div>Content</div>}
    </div>
  )
}
```

## Setup Scope Use Cases

The setup scope is perfect for one-time initialization:

### Initializing Instances

```tsx
function CacheExample(handle: Handle, setup: { cacheSize: number }) {
  // Initialize cache once
  let cache = new Map<string, any>()
  let maxSize = setup.cacheSize

  return (props: { key: string; value: any }) => {
    // Use cache in render
    if (cache.has(props.key)) {
      return <div>Cached: {cache.get(props.key)}</div>
    }
    cache.set(props.key, props.value)
    if (cache.size > maxSize) {
      let firstKey = cache.keys().next().value
      cache.delete(firstKey)
    }
    return <div>New: {props.value}</div>
  }
}
```

### Third-Party SDKs

```tsx
function Analytics(handle: Handle, setup: { apiKey: string }) {
  // Initialize SDK once
  let analytics = new AnalyticsSDK(setup.apiKey)

  // Cleanup on disconnect
  handle.signal.addEventListener('abort', () => {
    analytics.disconnect()
  })

  return (props: { event: string; data?: any }) => {
    // SDK is ready to use
    return <div>Tracking: {props.event}</div>
  }
}
```

### EventEmitters

```tsx
import { TypedEventTarget } from 'remix/interaction'

class DataEvent extends Event {
  constructor(public value: string) {
    super('data')
  }
}

class DataEmitter extends TypedEventTarget<{ data: DataEvent }> {
  emitData(value: string) {
    this.dispatchEvent(new DataEvent(value))
  }
}

function EventListener(handle: Handle, setup: DataEmitter) {
  // Set up listeners once with automatic cleanup
  handle.on(setup, {
    data(event) {
      // Handle data
      handle.update()
    },
  })

  return () => <div>Listening for events...</div>
}
```

### Window/Document Event Handling

```tsx
function WindowResizeTracker(handle: Handle) {
  let width = window.innerWidth
  let height = window.innerHeight

  // Set up global listeners once
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

### Initializing State from Props

```tsx
function Timer(handle: Handle, setup: { initialSeconds: number }) {
  // Initialize from setup prop
  let seconds = setup.initialSeconds
  let interval: number | null = null

  function start() {
    if (interval) return
    interval = setInterval(() => {
      seconds--
      if (seconds <= 0) {
        stop()
      }
      handle.update()
    }, 1000)
  }

  function stop() {
    if (interval) {
      clearInterval(interval)
      interval = null
    }
  }

  // Cleanup on disconnect
  handle.signal.addEventListener('abort', stop)

  return (props: { paused?: boolean }) => {
    if (!props.paused && !interval) {
      start()
    } else if (props.paused && interval) {
      stop()
    }

    return <div>Time remaining: {seconds}s</div>
  }
}
```

## Focus and Scroll Management

Use `handle.queueTask()` in event handlers for DOM operations that need to happen after the DOM has changed from the next update.

### Focus Management

```tsx
function Modal(handle: Handle) {
  let isOpen = false
  let closeButton: HTMLButtonElement
  let openButton: HTMLButtonElement

  return () => (
    <div>
      <button
        connect={(node) => (openButton = node)}
        on={{
          click() {
            isOpen = true
            handle.update()
            // Queue focus operation after modal renders
            handle.queueTask(() => {
              closeButton.focus()
            })
          },
        }}
      >
        Open Modal
      </button>

      {isOpen && (
        <div role="dialog">
          <button
            connect={(node) => (closeButton = node)}
            on={{
              click() {
                isOpen = false
                handle.update()
                // Queue focus operation after modal closes
                handle.queueTask(() => {
                  openButton.focus()
                })
              },
            }}
          >
            Close
          </button>
        </div>
      )}
    </div>
  )
}
```

### Scroll Management

```tsx
function ScrollableList(handle: Handle) {
  let items: string[] = []
  let newItemInput: HTMLInputElement
  let listContainer: HTMLElement

  return () => (
    <div>
      <input
        connect={(node) => (newItemInput = node)}
        on={{
          keydown(event) {
            if (event.key === 'Enter') {
              let text = event.currentTarget.value
              if (text.trim()) {
                items.push(text)
                event.currentTarget.value = ''
                handle.update()
                // Queue scroll operation after new item renders
                handle.queueTask(() => {
                  listContainer.scrollTop = listContainer.scrollHeight
                })
              }
            }
          },
        }}
      />
      <div
        connect={(node) => (listContainer = node)}
        css={{
          maxHeight: '300px',
          overflowY: 'auto',
        }}
      >
        {items.map((item, i) => (
          <div key={i}>{item}</div>
        ))}
      </div>
    </div>
  )
}
```

## Controlled vs Uncontrolled Inputs

Only control an input's value when something besides the user's interaction with that input can also control its state.

**Uncontrolled Input** (use when only the user controls the value):

```tsx
function SearchInput(handle: Handle) {
  let results: string[] = []

  return () => (
    <div>
      <input
        type="text"
        on={{
          async input(event, signal) {
            // Read value directly from the input - no component state needed
            let query = event.currentTarget.value
            // ... use query for search
          },
        }}
      />
    </div>
  )
}
```

**Controlled Input** (use when programmatic control is needed):

```tsx
function SlugForm(handle: Handle) {
  let slug = ''
  let generatedSlug = ''

  return () => (
    <form>
      <label>
        <input
          type="checkbox"
          on={{
            change(event) {
              if (event.currentTarget.checked) {
                generatedSlug = crypto.randomUUID().slice(0, 8)
              } else {
                generatedSlug = ''
              }
              handle.update()
            },
          }}
        />
        Auto-generate slug
      </label>
      <label>
        Slug
        <input
          type="text"
          value={generatedSlug || slug}
          disabled={!!generatedSlug}
          on={{
            input(event) {
              slug = event.currentTarget.value
              handle.update()
            },
          }}
        />
      </label>
    </form>
  )
}
```

**Use controlled inputs when:**

- The value can be set programmatically (auto-generated fields, reset buttons, external state)
- The input can be disabled and its value changed by other interactions
- You need to validate or transform input before it appears
- You need to prevent certain values from being entered

**Use uncontrolled inputs when:**

- Only the user can change the value through direct interaction with that input
- You just need to read the value on events (submit, blur, etc.)

## Data Loading

### Using Event Handler Signals

Event handlers receive an `AbortSignal` that's aborted when the handler is re-entered:

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

            let response = await fetch(`/search?q=${query}`, { signal })
            let data = await response.json()
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

### Using queueTask for Reactive Data Loading

Use `handle.queueTask()` in the render function for reactive data loading that responds to prop changes:

```tsx
function DataLoader(handle: Handle) {
  let data: any = null
  let loading = false
  let error: Error | null = null

  return (props: { url: string }) => {
    // Queue data loading task that responds to prop changes
    handle.queueTask(async (signal) => {
      loading = true
      error = null
      handle.update()

      let response = await fetch(props.url, { signal })
      let json = await response.json()
      if (signal.aborted) return
      data = json
      loading = false
      handle.update()
    })

    if (loading) return <div>Loading...</div>
    if (error) return <div>Error: {error.message}</div>
    if (!data) return <div>No data</div>

    return <div>{JSON.stringify(data)}</div>
  }
}
```

### Using Setup Scope for Initial Data

Load initial data in the setup scope:

```tsx
function UserProfile(handle: Handle, setup: { userId: string }) {
  let user: User | null = null
  let loading = true

  // Load initial data in setup scope using queueTask
  handle.queueTask(async (signal) => {
    let response = await fetch(`/api/users/${setup.userId}`, { signal })
    let data = await response.json()
    if (signal.aborted) return
    user = data
    loading = false
    handle.update()
  })

  return (props: { showEmail?: boolean }) => {
    if (loading) return <div>Loading user...</div>

    return (
      <div>
        <h1>{user.name}</h1>
        {props.showEmail && <p>{user.email}</p>}
      </div>
    )
  }
}
```

Note that by fetching this data in the setup scope any parent updates that change `setup.userId` will have no effect.

## See Also

- [Handle API](./handle.md) - `handle.queueTask()` and `handle.signal`
- [Events](./events.md) - Event handler signals
- [Components](./components.md) - Setup vs render phases
