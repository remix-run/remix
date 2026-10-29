# Component Agent Guide

This guide provides a comprehensive overview of the component runtime API, its behavior, and practical use cases for building interactive UIs.

## Rendering and Composition

### State Management Best Practices

#### Use Minimal Component State

Avoid storing input state that you don't need.

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

#### Do Work in Event Handlers

Do as much work as possible in event handlers with minimal component state. Use the event handler scope for transient event state, and only capture to component state if it's used for rendering.

**Use event handler scope for transient state:**

```tsx
// ❌ Avoid: Storing transient state in component
function FormValidator(handle: Handle) {
  let validationError: string | null = null // Only needed during validation

  return () => (
    <form
      mix={[
        on('submit', (event) => {
          event.preventDefault()
          let formData = new FormData(event.currentTarget)
          let email = formData.get('email') as string

          // Validation logic
          if (!email.includes('@')) {
            validationError = 'Invalid email'
            handle.update()
            return
          }

          // Submit form
          validationError = null
          handle.update()
        }),
      ]}
    >
      {validationError && <div>{validationError}</div>}
      <input name="email" />
      <button type="submit">Submit</button>
    </form>
  )
}

// ✅ Prefer: Keep transient state in event handler scope
function FormValidator(handle: Handle) {
  let validationError: string | null = null // Only stored if needed for rendering

  return () => (
    <form
      mix={[
        on('submit', (event) => {
          event.preventDefault()
          let formData = new FormData(event.currentTarget)
          let email = formData.get('email') as string

          // Validation logic - keep transient state in handler scope
          if (!email.includes('@')) {
            validationError = 'Invalid email' // Only store if rendering needs it
            handle.update()
            return
          }

          // Submit form - clear error if it exists
          if (validationError) {
            validationError = null
            handle.update()
          }
        }),
      ]}
    >
      {validationError && <div>{validationError}</div>}
      <input name="email" />
      <button type="submit">Submit</button>
    </form>
  )
}
```

### `css(...)` Mixin with Pseudo-Selectors and Descendant Selectors

#### Pseudo-Elements

Use `&::before` and `&::after` for pseudo-elements:

```tsx
function Badge(handle: Handle<{ count: number }>) {
  return () => (
    <div
      mix={[
        css({
          position: 'relative',
          display: 'inline-block',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: '-4px',
            right: '-4px',
            width: '8px',
            height: '8px',
            backgroundColor: 'red',
            borderRadius: '50%',
          },
        }),
      ]}
    >
      {handle.props.count > 0 && <span>{handle.props.count}</span>}
    </div>
  )
}
```

#### When to Use Nested Selectors

Use nested selectors when **parent state affects children**. Don't nest when you can style the element directly.

**This is preferable to creating JavaScript state and passing it around.** Instead of managing hover/focus state in JavaScript and passing it as props, use CSS nested selectors to let the browser handle state transitions declaratively.

**Use nested selectors when:**

1. **Parent state affects children** - Parent hover/focus/state changes child styling (prefer this over JavaScript state management)
2. **Styling descendant elements** - Avoid duplicating styles on every child or creating new components just for styling. Style children from the parent component instead.

**Don't nest when:**

- Styling the element's own pseudo-states (hover, focus, etc.)
- The element controls its own styling

**Example: Parent hover affects children** (use nested selectors, not JavaScript state):

```tsx
// ❌ Avoid: Managing hover state in JavaScript
function CardWithJSState(handle: Handle<{ children: RemixNode }>) {
  let isHovered = false

  return () => (
    <div
      mix={[
        on('mouseenter', () => {
          isHovered = true
          handle.update()
        }),
        on('mouseleave', () => {
          isHovered = false
          handle.update()
        }),
      ]}
      style={{
        border: `1px solid ${isHovered ? 'blue' : '#ddd'}`,
      }}
    >
      <div class="title" style={{ color: isHovered ? 'blue' : '#333' }}>
        Title
      </div>
    </div>
  )
}

// ✅ Prefer: CSS nested selectors handle state declaratively
function Card(handle: Handle<{ children: RemixNode }>) {
  return () => (
    <div
      mix={[
        css({
          border: '1px solid #ddd',
          borderRadius: '8px',
          padding: '20px',
          // Parent hover affects children - use nested selector
          '&:hover': {
            borderColor: 'blue',
            // Child text changes color on parent hover
            '& .title': {
              color: 'blue',
            },
            '& .description': {
              opacity: 1,
            },
          },
          '& .title': {
            fontSize: '20px',
            fontWeight: 'bold',
            color: '#333',
          },
          '& .description': {
            opacity: 0.7,
            marginTop: '8px',
          },
        }),
      ]}
    >
      <div class="title">Title</div>
    </div>
  )
}
```

**Example: Element's own hover** (style directly, no nesting needed):

```tsx
function Button() {
  return () => (
    <button
      mix={[
        css({
          backgroundColor: 'blue',
          color: 'white',
          padding: '12px 24px',
          borderRadius: '4px',
          border: 'none',
          cursor: 'pointer',
          // Element's own hover - style directly, no nesting needed
          '&:hover': {
            backgroundColor: 'darkblue',
          },
          '&:active': {
            transform: 'scale(0.98)',
          },
        }),
      ]}
    >
      Click me
    </button>
  )
}
```

**Example: Navigation with links** (descendant styling is appropriate):

```tsx
function Navigation() {
  return () => (
    <nav
      mix={[
        css({
          display: 'flex',
          gap: '16px',
          // Styling descendant links - appropriate use of nesting
          '& a': {
            color: 'blue',
            textDecoration: 'none',
            padding: '8px 16px',
            borderRadius: '4px',
            // Link's own hover state - this is fine nested under '& a'
            '&:hover': {
              backgroundColor: '#f0f0f0',
              color: 'darkblue',
            },
            '&[aria-current="page"]': {
              backgroundColor: 'blue',
              color: 'white',
            },
          },
        }),
      ]}
    >
      <a href="/">Home</a>
      <a href="/about">About</a>
      <a href="/contact">Contact</a>
    </nav>
  )
}
```

#### Combining All Features

Here's a comprehensive example demonstrating parent-state-affecting-children and media queries, with styles applied directly to elements:

```tsx
function ProductCard(handle: Handle<{ title: string; price: number; image: string }>) {
  return () => (
    <div
      mix={[
        css({
          border: '1px solid #ddd',
          borderRadius: '8px',
          overflow: 'hidden',
          transition: 'transform 0.2s, box-shadow 0.2s',
          // Parent hover affects the card itself
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            // Parent hover affects children - appropriate use of nesting
            '& .title': {
              color: 'blue',
            },
            '& button': {
              backgroundColor: 'darkblue',
            },
          },
          '@media (max-width: 768px)': {
            '&:hover': {
              transform: 'translateY(-2px)',
            },
          },
        }),
      ]}
    >
      <img
        src={handle.props.image}
        alt={handle.props.title}
        mix={[
          css({
            width: '100%',
            height: '200px',
            objectFit: 'cover',
            '@media (max-width: 768px)': {
              height: '150px',
            },
          }),
        ]}
      />
      <div
        class="content"
        mix={[
          css({
            padding: '16px',
            '@media (max-width: 768px)': {
              padding: '12px',
            },
          }),
        ]}
      >
        <h3
          class="title"
          mix={[
            css({
              fontSize: '18px',
              fontWeight: 'bold',
              marginTop: 0,
              marginBottom: '8px',
              transition: 'color 0.2s',
            }),
          ]}
        >
          {handle.props.title}
        </h3>
        <div
          class="price"
          mix={[
            css({
              fontSize: '20px',
              color: 'green',
              fontWeight: 'bold',
            }),
          ]}
        >
          ${handle.props.price}
        </div>
        <button
          mix={[
            css({
              width: '100%',
              padding: '12px',
              backgroundColor: 'blue',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
              '&:active': {
                transform: 'scale(0.98)',
              },
            }),
          ]}
        >
          Add to Cart
        </button>
      </div>
    </div>
  )
}
```

This example demonstrates:

- **Parent hover affecting children**: Card hover changes title color and button background (only nested selector needed)
- **Styles on elements themselves**: Each element (`img`, `.content`, `.title`, `.price`, `button`) has its own `css(...)` mixin
- **Element's own states**: Button's `:active` state styled directly on the button
- **Media queries**: Responsive adjustments applied directly to elements that need them

## Common Patterns and Use Cases

### Setup Scope Use Cases

The setup scope is perfect for one-time initialization:

#### Initializing Instances

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

#### Third-Party SDKs

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

#### Initializing State from Props

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

### Controlled vs Uncontrolled Inputs

Only control an input's value when something besides the user's interaction with that input can also control its state. Otherwise, let the DOM manage the input's value and read from it when needed. **This follows the principle of using minimal component state** - don't store input state you don't need.

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

**Key principle:** Don't store the input value in component state unless you need to:

- Set it programmatically (controlled input)
- Use it for rendering (e.g., showing character count)
- Transform/validate it before it appears in the input

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

Use controlled inputs when:

- The value can be set programmatically (auto-generated fields, reset buttons, external state)
- The input can be disabled and its value changed by other interactions (like the slug field above)
- You need to validate or transform input before it appears
- You need to prevent certain values from being entered

Use uncontrolled inputs when:

- Only the user can change the value through direct interaction with that input
- You just need to read the value on events (submit, blur, etc.)

### Data Loading and Updates

#### Using queueTask for Reactive Data Loading

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

#### Using Setup Scope for Initial Data

Load initial data in the setup scope:

```tsx
function UserProfile(handle: Handle<{ userId: string; showEmail?: boolean }>) {
  let user: User | null = null

  // Load initial data in setup scope using queueTask. Use `handle.signal` so
  // later re-renders don't cancel the one-time request.
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

Note that by fetching this data in the setup scope any parent updates that change `handle.props.userId` will have no effect.
