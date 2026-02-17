# Remix Component - Agent Guide

This guide provides a comprehensive overview of the Remix Component API, its runtime behavior, and practical use cases for building interactive UIs.

## Getting Started

### Creating a Root

To start using Remix Component, create a root and render your top-level component:

```tsx
import { createRoot } from 'remix/component'
import type { Handle } from 'remix/component'

function App(handle: Handle) {
  return () => (
    <div>
      <h1>Hello, World!</h1>
    </div>
  )
}

// Create a root attached to a DOM element
let container = document.getElementById('app')!
let root = createRoot(container)

// Render your app
root.render(<App />)
```

The `createRoot` function takes a DOM element (or `document.body`) and returns a root object with a `render` method. You can call `render` multiple times to update the app:

```tsx
function App(handle: Handle) {
  let count = 0

  return () => (
    <div>
      <h1>Count: {count}</h1>
      <button
        on={{
          click() {
            count++
            handle.update()
          },
        }}
      >
        Increment
      </button>
    </div>
  )
}

let root = createRoot(document.body)
root.render(<App />)

// Later, you can update the app by calling render again
// root.render(<App />)
```

### Root Methods

The root object provides several methods:

- **`render(node)`** - Renders a component tree into the root container
- **`flush()`** - Synchronously flushes all pending updates and tasks
- **`remove()`** - Removes the component tree and cleans up

```tsx
let root = createRoot(document.body)

// Render initial app
root.render(<App />)

// Flush any pending updates synchronously
root.flush()

// Later, remove the app
root.remove()
```

## Component Factory and Runtime Behavior

### Component Structure

All components follow a consistent two-phase structure:

1. **Setup Phase** - Runs once when the component is first created
2. **Render Phase** - Runs on initial render and every update afterward

```tsx
function MyComponent(handle: Handle, setup: SetupType) {
  // Setup phase: runs once
  let state = initializeState(setup)

  // Return render function: runs on every update
  return (props: Props) => {
    return <div>{/* render content */}</div>
  }
}
```

### Runtime Behavior

When a component is rendered:

1. **First Render**:

   - The component function is called with `handle` and the `setup` prop
   - The returned render function is stored
   - The render function is called with regular props
   - Any tasks queued via `handle.queueTask()` are executed after rendering

2. **Subsequent Updates**:

   - Only the render function is called
   - Setup phase is skipped, setup closure persists for the lifetime of the component instance
   - Props are passed to the render function
   - The `setup` prop is stripped from props
   - Tasks queued during the update are executed after rendering

3. **Component Removal**:
   - `handle.signal` is aborted
   - All event listeners registered via `handle.on()` are automatically cleaned up
   - Any queued tasks are executed with an aborted signal

### Setup vs Props

The `setup` prop is special - it's only available in the setup phase and is automatically excluded from props. This prevents accidental stale captures:

```tsx
function Counter(handle: Handle, setup: number) {
  // setup prop (e.g., initialCount) only available here
  let count = setup

  return (props: { label: string }) => {
    // props only receives { label } - setup is excluded
    return (
      <div>
        {props.label}: {count}
      </div>
    )
  }
}

// Usage
let element = <Counter setup={10} label="Count" />
```

## Handle API

The `Handle` object provides the component's interface to the framework:

### `handle.update()`

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

### `handle.queueTask(task)`

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

**❌ Anti-pattern: Don't create states as values to "react to" on the next render with `queueTask`:**

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

**Pattern: await `handle.update()` when showing loading state before async work:**

When you need to show loading UI before async work starts, set loading state, call
`await handle.update()`, and use the returned signal for async APIs.

```tsx
function GoodAsyncExample(handle: Handle) {
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

**Signals in events and tasks are how you manage interruptions and disconnects:**

Both event handlers and `queueTask` receive `AbortSignal` parameters that are automatically aborted when:

- The component is removed from the tree
- For event handlers: The handler is re-entered (user triggers another event)
- For `queueTask`: The component re-renders (props changed)

Always check `signal.aborted` or pass the signal to async APIs (like `fetch`) to handle interruptions gracefully.

### `handle.signal`

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

### `handle.on(target, listeners)`

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

### `handle.id`

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

### `handle.context`

Context API for ancestor/descendant communication. Use `handle.context.set()` to provide values and `handle.context.get()` to consume them.

**Important:** `handle.context.set()` does not cause any updates - it simply stores a value. If you need the component tree to update when context changes, call `handle.update()` after setting the context, or use an `EventTarget` on context for descendants to subscribe to changes (see the TypedEventTarget example in the Context section).

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

## Rendering and Composition

### Basic Rendering

The simplest component just returns JSX:

```tsx
function Greeting() {
  return (props: { name: string }) => <div>Hello, {props.name}!</div>
}

let el = <Greeting name="World" />
```

### Prop Passing

Props flow from parent to child through JSX attributes:

```tsx
function Parent() {
  return () => <Child message="Hello from parent" count={42} />
}

function Child() {
  return (props: { message: string; count: number }) => (
    <div>
      <p>{props.message}</p>
      <p>Count: {props.count}</p>
    </div>
  )
}
```

### Stateful Updates

State is managed with plain JavaScript variables. Call `handle.update()` to trigger a re-render:

```tsx
function Counter(handle: Handle) {
  let count = 0

  return () => (
    <div>
      <span>Count: {count}</span>
      <button
        on={{
          click() {
            count++
            handle.update()
          },
        }}
      >
        Increment
      </button>
    </div>
  )
}
```

### State Management Best Practices

#### Use Minimal Component State

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

#### Do Work in Event Handlers

Do as much work as possible in event handlers with minimal component state. Use the event handler scope for transient event state, and only capture to component state if it's used for rendering.

**Use event handler scope for transient state:**

```tsx
// ❌ Avoid: Storing transient state in component
function FormValidator(handle: Handle) {
  let validationError: string | null = null // Only needed during validation

  return () => (
    <form
      on={{
        submit(event) {
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
        },
      }}
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
      on={{
        submit(event) {
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
        },
      }}
    >
      {validationError && <div>{validationError}</div>}
      <input name="email" />
      <button type="submit">Submit</button>
    </form>
  )
}
```

**Only store state needed for rendering:**

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

### CSS Prop with Pseudo-Selectors and Descendant Selectors

The `css` prop provides inline styling with support for pseudo-selectors, pseudo-elements, attribute selectors, descendant selectors, and media queries. It follows modern CSS nesting selector rules. Use `&` to reference the current element in pseudo-selectors and attribute selectors.

#### Basic CSS Prop

```tsx
function Button() {
  return () => (
    <button
      css={{
        color: 'white',
        backgroundColor: 'blue',
        padding: '12px 24px',
        borderRadius: '4px',
        border: 'none',
        cursor: 'pointer',
      }}
    >
      Click me
    </button>
  )
}
```

#### Performance: CSS Prop vs Style Prop

The `css` prop produces static styles that are inserted into the document as CSS rules, while the `style` prop applies styles directly to the element. For **dynamic styles** that change frequently, use the `style` prop for better performance:

```tsx
// ❌ Avoid: Using css prop for dynamic styles
function ProgressBar(handle: Handle) {
  let progress = 0

  return () => (
    <div
      css={{
        width: `${progress}%`, // Creates new CSS rule on every update
        backgroundColor: 'blue',
      }}
    >
      {progress}%
    </div>
  )
}

// ✅ Prefer: Using style prop for dynamic styles
function ProgressBar(handle: Handle) {
  let progress = 0

  return () => (
    <div
      css={{
        backgroundColor: 'blue', // Static styles in css prop
      }}
      style={{
        width: `${progress}%`, // Dynamic styles in style prop
      }}
    >
      {progress}%
    </div>
  )
}
```

**Use the `css` prop for:**

- Static styles that don't change
- Styles that need pseudo-selectors (`:hover`, `:focus`, etc.)
- Styles that need media queries

**Use the `style` prop for:**

- Dynamic styles that change based on state or props
- Computed values that update frequently

#### Pseudo-Selectors

Use `&` to reference the current element in pseudo-selectors:

```tsx
function Button() {
  return () => (
    <button
      css={{
        color: 'white',
        backgroundColor: 'blue',
        padding: '12px 24px',
        borderRadius: '4px',
        border: 'none',
        cursor: 'pointer',
        '&:hover': {
          backgroundColor: 'darkblue',
          transform: 'translateY(-1px)',
        },
        '&:active': {
          backgroundColor: 'navy',
          transform: 'translateY(0)',
        },
        '&:focus': {
          outline: '2px solid yellow',
          outlineOffset: '2px',
        },
        '&:disabled': {
          opacity: 0.5,
          cursor: 'not-allowed',
        },
      }}
    >
      Click me
    </button>
  )
}
```

#### Pseudo-Elements

Use `&::before` and `&::after` for pseudo-elements:

```tsx
function Badge() {
  return (props: { count: number }) => (
    <div
      css={{
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
      }}
    >
      {props.count > 0 && <span>{props.count}</span>}
    </div>
  )
}
```

#### Attribute Selectors

Use `&[attribute]` for attribute selectors:

```tsx
function Input() {
  return (props: { required?: boolean }) => (
    <input
      required={props.required}
      css={{
        padding: '8px',
        border: '1px solid #ccc',
        borderRadius: '4px',
        '&[required]': {
          borderColor: 'red',
        },
        '&[aria-invalid="true"]': {
          borderColor: 'red',
          outline: '2px solid red',
        },
      }}
    />
  )
}
```

#### Descendant Selectors

Use class names or element selectors directly for descendant selectors:

```tsx
function Card() {
  return (props: { children: RemixNode }) => (
    <div
      css={{
        padding: '20px',
        border: '1px solid #ddd',
        borderRadius: '8px',
        backgroundColor: 'white',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        // Style descendants
        '& h2': {
          marginTop: 0,
          fontSize: '24px',
          fontWeight: 'bold',
        },
        '& p': {
          color: '#666',
          lineHeight: 1.6,
        },
        '& .icon': {
          width: '24px',
          height: '24px',
          marginRight: '8px',
        },
        '& button': {
          marginTop: '16px',
        },
      }}
    >
      {props.children}
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
function CardWithJSState(handle: Handle) {
  let isHovered = false

  return (props: { children: RemixNode }) => (
    <div
      on={{
        mouseenter() {
          isHovered = true
          handle.update()
        },
        mouseleave() {
          isHovered = false
          handle.update()
        },
      }}
      css={{
        border: `1px solid ${isHovered ? 'blue' : '#ddd'}`,
        // ... more conditional styling based on isHovered
      }}
    >
      <div className="title" css={{ color: isHovered ? 'blue' : '#333' }}>
        Title
      </div>
    </div>
  )
}

// ✅ Prefer: CSS nested selectors handle state declaratively
function Card(handle: Handle) {
  return (props: { children: RemixNode }) => (
    <div
      css={{
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
      }}
    >
      <div className="title">Title</div>
    </div>
  )
}
```

**Example: Element's own hover** (style directly, no nesting needed):

```tsx
function Button() {
  return () => (
    <button
      css={{
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
      }}
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
      css={{
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
      }}
    >
      <a href="/">Home</a>
      <a href="/about">About</a>
      <a href="/contact">Contact</a>
    </nav>
  )
}
```

#### Media Queries

Use `@media` for responsive design:

```tsx
function ResponsiveGrid() {
  return (props: { children: RemixNode }) => (
    <div
      css={{
        display: 'grid',
        gap: '16px',
        gridTemplateColumns: '1fr',
        '@media (min-width: 768px)': {
          gridTemplateColumns: 'repeat(2, 1fr)',
        },
        '@media (min-width: 1024px)': {
          gridTemplateColumns: 'repeat(3, 1fr)',
        },
      }}
    >
      {props.children}
    </div>
  )
}
```

#### Combining All Features

Here's a comprehensive example demonstrating parent-state-affecting-children and media queries, with styles applied directly to elements:

```tsx
function ProductCard() {
  return (props: { title: string; price: number; image: string }) => (
    <div
      css={{
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
      }}
    >
      <img
        src={props.image}
        alt={props.title}
        css={{
          width: '100%',
          height: '200px',
          objectFit: 'cover',
          '@media (max-width: 768px)': {
            height: '150px',
          },
        }}
      />
      <div
        className="content"
        css={{
          padding: '16px',
          '@media (max-width: 768px)': {
            padding: '12px',
          },
        }}
      >
        <h3
          className="title"
          css={{
            fontSize: '18px',
            fontWeight: 'bold',
            marginTop: 0,
            marginBottom: '8px',
            transition: 'color 0.2s',
          }}
        >
          {props.title}
        </h3>
        <div
          className="price"
          css={{
            fontSize: '20px',
            color: 'green',
            fontWeight: 'bold',
          }}
        >
          ${props.price}
        </div>
        <button
          css={{
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
          }}
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
- **Styles on elements themselves**: Each element (`img`, `.content`, `.title`, `.price`, `button`) has its own `css` prop
- **Element's own states**: Button's `:active` state styled directly on the button
- **Media queries**: Responsive adjustments applied directly to elements that need them

### Connect Prop

Use the `connect` prop to get a reference to the DOM node after it's rendered. This is useful for DOM operations like focusing elements, scrolling, measuring dimensions, or setting up observers.

```tsx
function Form(handle: Handle) {
  let inputRef: HTMLInputElement

  return () => (
    <form>
      <input type="text" connect={(node) => (inputRef = node)} />
      <button
        on={{
          click() {
            // Focus the input from elsewhere in the form
            inputRef.focus()
          },
        }}
      >
        Focus Input
      </button>
    </form>
  )
}
```

The `connect` callback can optionally receive an `AbortSignal` as a second parameter, which is aborted when the element is removed from the DOM. Use this for cleanup operations:

```tsx
function ResizeTracker(handle: Handle) {
  let dimensions = { width: 0, height: 0 }

  return () => (
    <div
      connect={(node, signal) => {
        // Set up ResizeObserver
        let observer = new ResizeObserver((entries) => {
          let entry = entries[0]
          if (entry) {
            dimensions.width = Math.round(entry.contentRect.width)
            dimensions.height = Math.round(entry.contentRect.height)
            handle.update()
          }
        })
        observer.observe(node)

        // Clean up when element is removed
        signal.addEventListener('abort', () => {
          observer.disconnect()
        })
      }}
    >
      Size: {dimensions.width} × {dimensions.height}
    </div>
  )
}
```

The `connect` callback is called only once when the element is first rendered, not on every update.

### Key Prop

Use the `key` prop to uniquely identify elements in lists. Keys enable efficient diffing and preserve DOM nodes and component state when lists are reordered, filtered, or updated.

```tsx
function TodoList(handle: Handle) {
  let todos = [
    { id: '1', text: 'Buy milk' },
    { id: '2', text: 'Walk dog' },
    { id: '3', text: 'Write code' },
  ]

  return () => (
    <ul>
      {todos.map((todo) => (
        <li key={todo.id}>{todo.text}</li>
      ))}
    </ul>
  )
}
```

When you reorder, add, or remove items, keys ensure:

- **DOM nodes are reused** - Elements with matching keys are moved, not recreated
- **Component state is preserved** - Component instances persist across reorders
- **Focus and selection are maintained** - Input focus stays with the same element
- **Input values are preserved** - Form values remain with their elements

```tsx
function ReorderableList(handle: Handle) {
  let items = [
    { id: 'a', label: 'Item A' },
    { id: 'b', label: 'Item B' },
    { id: 'c', label: 'Item C' },
  ]

  function reverse() {
    items = [...items].reverse()
    handle.update()
  }

  return () => (
    <div>
      <button
        on={{
          click: reverse,
        }}
      >
        Reverse List
      </button>
      {items.map((item) => (
        <div key={item.id}>
          <input type="text" defaultValue={item.label} />
        </div>
      ))}
    </div>
  )
}
```

Even when the list order changes, each input maintains its value and focus state because the `key` prop identifies which DOM node corresponds to which item.

Keys can be any type (string, number, bigint, object, symbol), but should be stable and unique within the list:

```tsx
// Good: stable, unique IDs
{
  items.map((item) => <Item key={item.id} item={item} />)
}

// Good: index can work if list never reorders
{
  items.map((item, index) => <Item key={index} item={item} />)
}

// Bad: don't use random values or values that change
{
  items.map((item) => <Item key={Math.random()} item={item} />)
}
```

### Composition Through props.children

Components can compose other components via `children`:

```tsx
function Layout() {
  return (props: { children: RemixNode }) => (
    <div css={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <header>My App</header>
      <main>{props.children}</main>
      <footer>© 2024</footer>
    </div>
  )
}

function App() {
  return () => (
    <Layout>
      <h1>Welcome</h1>
      <p>Content goes here</p>
    </Layout>
  )
}
```

### Context for Indirect Composition

Context enables components to communicate without direct prop passing:

#### Basic Context

```tsx
function ThemeProvider(handle: Handle<{ theme: 'light' | 'dark' }>) {
  let theme: 'light' | 'dark' = 'light'

  handle.context.set({ theme })

  return (props: { children: RemixNode }) => (
    <div>
      <button
        on={{
          click() {
            theme = theme === 'light' ? 'dark' : 'light'
            handle.context.set({ theme })
            handle.update()
          },
        }}
      >
        Toggle Theme
      </button>
      {props.children}
    </div>
  )
}

function ThemedContent(handle: Handle) {
  let { theme } = handle.context.get(ThemeProvider)

  return () => (
    <div css={{ backgroundColor: theme === 'dark' ? '#000' : '#fff' }}>Current theme: {theme}</div>
  )
}
```

**Note:** `handle.context.set()` does not cause any updates - it simply stores a value. If you want the component tree to update when context changes, you must call `handle.update()` after setting the context (as shown above), or use an `EventTarget` on context for descendants to subscribe to changes (as shown in the TypedEventTarget example below).

#### TypedEventTarget for Granular Updates

For better performance, use `TypedEventTarget` to avoid updating the entire subtree:

```tsx
import { TypedEventTarget } from 'remix/interaction'

class Theme extends TypedEventTarget<{ change: Event }> {
  #value: 'light' | 'dark' = 'light'

  get value() {
    return this.#value
  }

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
      <button
        on={{
          click() {
            // No update needed - consumers subscribe to changes
            theme.setValue(theme.value === 'light' ? 'dark' : 'light')
          },
        }}
      >
        Toggle Theme
      </button>
      {props.children}
    </div>
  )
}

function ThemedContent(handle: Handle) {
  let theme = handle.context.get(ThemeProvider)

  // Subscribe to granular updates
  handle.on(theme, {
    change() {
      handle.update()
    },
  })

  return () => (
    <div css={{ backgroundColor: theme.value === 'dark' ? '#000' : '#fff' }}>
      Current theme: {theme.value}
    </div>
  )
}
```

## Common Patterns and Use Cases

### Setup Scope Use Cases

The setup scope is perfect for one-time initialization:

#### Initializing Instances

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

#### Third-Party SDKs

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

#### EventEmitters

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

#### Window/Document Event Handling

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
      Window size: {width} × {height}
    </div>
  )
}
```

#### Initializing State from Props

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

### Focus and Scroll Management

Use `handle.queueTask()` in event handlers for DOM operations that need to happen after the DOM has changed from the next update. This is the pattern for operations like focusing elements, scrolling, or measuring dimensions after conditional rendering.

#### Focus Management

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

#### Scroll Management

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

**Key pattern:** Do the work in the event handler (update state, call `handle.update()`), then use `queueTask` to perform DOM operations that depend on the updated DOM. Don't create intermediate state just to react to it in `queueTask`.

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

Use controlled inputs when:

- The value can be set programmatically (auto-generated fields, reset buttons, external state)
- The input can be disabled and its value changed by other interactions (like the slug field above)
- You need to validate or transform input before it appears
- You need to prevent certain values from being entered

Use uncontrolled inputs when:

- Only the user can change the value through direct interaction with that input
- You just need to read the value on events (submit, blur, etc.)

### Data Loading and Updates

#### Signals: Managing Interruptions and Disconnects

**Signals in events and tasks are how you manage interruptions and disconnects.** Both event handlers and `queueTask` receive `AbortSignal` parameters that are automatically aborted when:

- The component is removed from the tree
- For event handlers: The handler is re-entered (user triggers another event before the previous one completes)
- For `queueTask`: The component re-renders (props changed, triggering a new render cycle)

Always check `signal.aborted` or pass the signal to async APIs (like `fetch`) to handle interruptions gracefully.

#### Using Event Handler Signals for Race Conditions

Event handlers receive an `AbortSignal` that's aborted when the handler is re-entered or the component is removed. Use this to prevent race conditions when the user is creating events faster than the async work completes:

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

The event handler signal is aborted when:

- The user triggers another input event (new search query)
- The component is removed

This ensures only the latest search request completes, preventing stale results from overwriting newer ones.

#### Using queueTask for Reactive Data Loading

Use `handle.queueTask()` in the render function for reactive data loading that responds to prop changes. The signal will be aborted if props change or the component is removed:

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

The render signal is aborted when:

- The component re-renders (props changed, e.g., `url` prop changed)
- The component is removed

This ensures only the latest data loading request completes. If the `url` prop changes while a request is in flight, the previous request is automatically cancelled.

#### Using Setup Scope for Initial Data

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

## Testing

When writing tests, use `root.flush()` to synchronously execute all pending updates and tasks. This ensures the DOM and component state are fully synchronized before making assertions.

The main use case is flushing after events that call `handle.update()`. Since updates are asynchronous, you need to flush to ensure the DOM reflects the changes:

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

// In your test
let container = document.createElement('div')
let root = createRoot(container)

root.render(<Counter />)
root.flush() // Ensure initial render completes

let button = container.querySelector('button')
button.click() // Triggers handle.update()
root.flush() // Flush to apply the update

expect(container.textContent).toBe('Count: 1')
```

You should also flush after the initial `root.render()` to ensure event listeners are attached and the DOM is ready for interaction.

## Summary

- **Components** have two phases: setup (runs once) and render (runs after setup and on updates)
- **State** is managed with plain JavaScript variables
- **Updates** are explicit via `handle.update()`
- **Setup prop** initialization values and excluded from props
- **Context** enables indirect composition without prop drilling
- **TypedEventTarget** provides granular updates for better performance
- **State management best practices:**
  - Use minimal component state - derive computed values, don't store input state you don't need
  - Do as much work as possible in event handlers - use event handler scope for transient state, only capture to component state if used for rendering
- **queueTask** patterns:
  - Use in event handlers when work needs to happen after DOM changes from the next update
  - Use in render function for work that needs to be reactive to prop changes
  - Don't create states as values to "react to" on the next render with queueTask
- **AbortSignals** in events and tasks manage interruptions and disconnects - always check `signal.aborted` or pass to async APIs
