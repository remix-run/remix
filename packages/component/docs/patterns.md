# Patterns

Common patterns and best practices for building components.

## State Management

### Use Minimal Component State

**Don't store input state you don't need:**

```tsx
// ❌ Avoid: Storing input value when you only need it on submit
function SearchForm(handle: Handle) {
  let query = '' // Unnecessary state

  return () => (
    <form
      mix={[
        on('submit', (event) => {
          event.preventDefault()
          let formData = new FormData(event.currentTarget)
          let query = formData.get('query') as string
          // Use query for search
        }),
      ]}
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
      mix={[
        on('submit', (event) => {
          event.preventDefault()
          let formData = new FormData(event.currentTarget)
          let query = formData.get('query') as string
          // Use query for search - no component state needed
        }),
      ]}
    >
      <input name="query" />
      <button type="submit">Search</button>
    </form>
  )
}
```

### Do Work in Event Handlers

Do as much work as possible in event handlers with minimal component state. Use the event handler scope for transient event state, and only capture to component state if it's used for rendering.

## Setup Scope Use Cases

The setup scope is perfect for one-time initialization:

### Initializing Instances

```tsx
function CacheExample(handle: Handle<{ cacheSize: number; key: string; value: any }>) {
  // Initialize cache once
  let cache = new Map<string, any>()
  let maxSize = handle.props.cacheSize

  return () => {
    // Use cache in render
    if (cache.has(handle.props.key)) {
      return <div>Cached: {cache.get(handle.props.key)}</div>
    }
    cache.set(handle.props.key, handle.props.value)
    if (cache.size > maxSize) {
      let firstKey = cache.keys().next().value
      if (firstKey !== undefined) cache.delete(firstKey)
    }
    return <div>New: {handle.props.value}</div>
  }
}
```

### Third-Party SDKs

```tsx
function Analytics(handle: Handle<{ apiKey: string; event: string; data?: any }>) {
  // Initialize SDK once
  let analytics = new AnalyticsSDK(handle.props.apiKey)

  // Cleanup on disconnect
  handle.signal.addEventListener('abort', () => {
    analytics.disconnect()
  })

  return () => {
    // SDK is ready to use
    return <div>Tracking: {handle.props.event}</div>
  }
}
```

### Initializing State from Props

```tsx
function Timer(handle: Handle<{ initialSeconds: number; paused?: boolean }>) {
  // Initialize from props
  let seconds = handle.props.initialSeconds
  let interval: ReturnType<typeof setInterval> | null = null

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

  return () => {
    // Start or stop after the commit so the interval only runs in the browser
    handle.queueTask(() => {
      if (!handle.props.paused && !interval && seconds > 0) {
        start()
      } else if (handle.props.paused && interval) {
        stop()
      }
    })

    return <div>Time remaining: {seconds}s</div>
  }
}
```

## Focus Management

```tsx
function Modal(handle: Handle) {
  let isOpen = false
  let closeButton: HTMLButtonElement
  let openButton: HTMLButtonElement

  return () => (
    <div>
      <button
        mix={[
          ref((node) => (openButton = node)),
          on('click', () => {
            isOpen = true
            handle.update()
            // Queue focus operation after modal renders
            handle.queueTask(() => {
              closeButton.focus()
            })
          }),
        ]}
      >
        Open Modal
      </button>

      {isOpen && (
        <div role="dialog">
          <button
            mix={[
              ref((node) => (closeButton = node)),
              on('click', () => {
                isOpen = false
                handle.update()
                // Queue focus operation after modal closes
                handle.queueTask(() => {
                  openButton.focus()
                })
              }),
            ]}
          >
            Close
          </button>
        </div>
      )}
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
        mix={[
          on('input', async (event, signal) => {
            // Read value directly from the input - no component state needed
            let query = event.currentTarget.value
            // ... use query for search
          }),
        ]}
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
          mix={[
            on('change', (event) => {
              if (event.currentTarget.checked) {
                generatedSlug = crypto.randomUUID().slice(0, 8)
              } else {
                generatedSlug = ''
              }
              handle.update()
            }),
          ]}
        />
        Auto-generate slug
      </label>
      <label>
        Slug
        <input
          type="text"
          value={generatedSlug || slug}
          disabled={!!generatedSlug}
          mix={[
            on('input', (event) => {
              slug = event.currentTarget.value
              handle.update()
            }),
          ]}
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

### Using queueTask for Reactive Data Loading

Use `handle.queueTask()` in the render function for reactive data loading that responds to prop changes:

```tsx
function DataLoader(handle: Handle<{ url: string }>) {
  let data: any = null
  let error: Error | null = null
  let loadedUrl: string | undefined

  return () => {
    let url = handle.props.url
    let loading = url !== loadedUrl

    // Queue a load only while `url` hasn't loaded yet. Queuing on every render
    // would loop, because the task's `handle.update()` renders again.
    if (loading) {
      handle.queueTask(async (signal) => {
        try {
          let response = await fetch(url, { signal })
          let json = await response.json()
          if (signal.aborted) return
          data = json
          error = null
        } catch (caught) {
          if (signal.aborted) return
          error = caught as Error
        }
        loadedUrl = url
        handle.update()
      })
    }

    if (loading) return <div>Loading...</div>
    if (error) return <div>Error: {error.message}</div>
    if (!data) return <div>No data</div>

    return <div>{JSON.stringify(data)}</div>
  }
}
```

The task's signal is aborted when the component renders again or is removed. If `url` changes while a request is in flight, the next render aborts it and queues a request for the new `url`. A re-render for any other reason also aborts the request, and that render queues it again, so only the latest request for the current `url` completes.

### Using Setup Scope for Initial Data

Load initial data in the setup scope:

```tsx
function UserProfile(handle: Handle<{ userId: string; showEmail?: boolean }>) {
  let user: User | null = null

  // Load initial data in setup scope using queueTask. Use `handle.signal`, not the
  // task signal: the task signal aborts on the next render, such as a parent update.
  handle.queueTask(async () => {
    let response = await fetch(`/api/users/${handle.props.userId}`, { signal: handle.signal })
    let data = await response.json()
    if (handle.signal.aborted) return
    user = data
    handle.update()
  })

  return () => {
    if (!user) return <div>Loading user...</div>

    return (
      <div>
        <h1>{user.name}</h1>
        {handle.props.showEmail && <p>{user.email}</p>}
      </div>
    )
  }
}
```

Note that by fetching this data in the setup scope, parent updates that change `userId` will not restart the request unless you add that behavior yourself.
