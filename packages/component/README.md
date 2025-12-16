# Remix Component

A minimal component system that leans on JavaScript and DOM primitives.

## Features

- **JSX Runtime** - Convenient JSX syntax
- **Component State** - State managed with plain JavaScript variables
- **Manual Updates** - Explicit control over when components update via `this.update()`
- **Real DOM Events** - Events are real DOM events using [`@remix-run/interaction`](../interaction)
- **Inline CSS** - CSS prop with pseudo-selectors and nested rules

## Installation

```sh
npm install @remix-run/component
```

## Getting Started

Create a root and render a component:

```tsx
import { createRoot } from '@remix-run/component'

function App(this: Remix.Handle) {
  let count = 0
  return () => (
    <button
      on={{
        click: () => {
          count++
          this.update()
        },
      }}
    >
      Count: {count}
    </button>
  )
}

createRoot(document.body).render(<App />)
```

Components are functions that receive a `Handle` as `this`. They can return a render function that receives props, or return JSX directly.

## Component State and Updates

State is managed with plain JavaScript variables. Call `this.update()` to schedule an update:

```tsx
function Counter(this: Remix.Handle) {
  let count = 0

  return () => (
    <div>
      <span>Count: {count}</span>
      <button
        on={{
          click: () => {
            count++
            this.update()
          },
        }}
      >
        Increment
      </button>
    </div>
  )
}
```

## Stateful vs Non-Stateful Components

Components can be either **stateful** or **non-stateful**, depending on what they return.

### Non-Stateful Components

Non-stateful components return JSX directly. They are called on every parent (or self) update so function scope is new each time.

```tsx
function Greeting(this: Remix.Handle, props: { name: string }) {
  return <h1>Hello, {props.name}!</h1>
}
```

Use non-stateful components when you don't need to maintain state between renders.

### Stateful Components

Stateful components return a function. The setup function runs **once** when the component is first created, and the returned render function runs on **every update**:

```tsx
function Counter(this: Remix.Handle, setupProps: { initial: number }) {
  // Setup phase: runs once
  let count = setupProps.initial

  // Return render function: runs on every update
  return (renderProps: { label?: string }) => (
    <div>
      {renderProps.label || 'Count'}: {count}
      <button
        on={{
          click: () => {
            count++
            this.update()
          },
        }}
      >
        Increment
      </button>
    </div>
  )
}
```

Use stateful components when you need to:

- Maintain state between renders
- Set up event listeners or timers in the setup phase
- Initialize resources that persist across updates

### Setup Props vs Render Props

When a component returns a function, it has two phases:

1. **Setup phase** - The component function receives `setupProps` and runs once. Use this for initialization.
2. **Render phase** - The returned function receives `renderProps` and runs on every update. Use this for rendering.

When you use a stateful component both functions receive all props. However, you typically use:

- `setupProps` for values that initialize state (e.g., `initial`, `defaultValue`)
- `renderProps` for values that change over time (e.g., `label`, `disabled`)

```tsx
// Usage: all props are available to both setup and render
let el = <Counter initial={5} label="Total" />

function Counter(
  this: Remix.Handle,
  setupProps: { initial: number }, // receives { initial: 5, label: "Total" }
) {
  let count = setupProps.initial // use initial for setup

  return (renderProps: { label?: string }) => {
    // renderProps also receives { initial: 5, label: "Total" }
    return (
      <div>
        {renderProps.label}: {count}
      </div>
    )
  }
}
```

## Events

Events use the `on` prop and are handled by [`@remix-run/interaction`](../interaction). Listeners receive an `AbortSignal` that's aborted when the component is disconnected or the handler is re-entered.

```tsx
function SearchInput(this: Remix.Handle) {
  let query = ''

  return () => (
    <input
      type="text"
      value={query}
      on={{
        input: (event, signal) => {
          query = event.currentTarget.value
          this.update()

          // Pass the signal to abort the fetch on re-entry or node removal
          // This avoids race conditions in the UI and manages cleanup
          fetch(`/search?q=${query}`, { signal })
            .then((res) => res.json())
            .then((results) => {
              if (signal.aborted) return
              // Update results
            })
        },
      }}
    />
  )
}
```

You can also listen to global event targets like `document` or `window` using `this.on()` with automatic cleanup on component removal:

```tsx
function KeyboardTracker(this: Remix.Handle) {
  let keys: string[] = []

  this.on(document, {
    keydown: (event) => {
      keys.push(event.key)
      this.update()
    },
  })

  return () => <div>Keys: {keys.join(', ')}</div>
}
```

## CSS Prop

Use the `css` prop for inline styles with pseudo-selectors and nested rules:

```tsx
function Button(this: Remix.Handle) {
  return () => (
    <button
      css={{
        color: 'white',
        backgroundColor: 'blue',
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

The syntax mirrors modern CSS nesting, but in object form. Use `&` to reference the current element in pseudo-selectors, pseudo-elements, and attribute selectors. Use class names or other selectors directly for child selectors:

```css
.button {
  color: white;
  background-color: blue;

  &:hover {
    background-color: darkblue;
  }

  &::before {
    content: '';
    position: absolute;
  }

  &[aria-selected='true'] {
    border: 2px solid yellow;
  }

  .icon {
    width: 16px;
    height: 16px;
  }

  @media (max-width: 768px) {
    padding: 8px;
  }
}
```

```tsx
function Button(this: Remix.Handle) {
  return () => (
    <button
      css={{
        color: 'white',
        backgroundColor: 'blue',
        '&:hover': {
          backgroundColor: 'darkblue',
        },
        '&::before': {
          content: '""',
          position: 'absolute',
        },
        '&[aria-selected="true"]': {
          border: '2px solid yellow',
        },
        '.icon': {
          width: '16px',
          height: '16px',
        },
        '@media (max-width: 768px)': {
          padding: '8px',
        },
      }}
    >
      <span className="icon">★</span>
      Click me
    </button>
  )
}
```

## Connect Prop

Use the `connect` prop to get a reference to the DOM node after it's rendered. This is useful for DOM operations like focusing elements, scrolling, or measuring dimensions.

```tsx
function Form(this: Remix.Handle) {
  let inputRef: HTMLInputElement

  return () => (
    <form>
      <input
        type="text"
        // get the input node
        connect={(node) => (inputRef = node)}
      />
      <button
        on={{
          click: () => {
            // Select it from other parts of the form
            inputRef.select()
          },
        }}
      >
        Focus Input
      </button>
    </form>
  )
}
```

The `connect` callback can optionally receive an `AbortSignal` as a second parameter, which is aborted when the element is removed from the DOM:

```tsx
function Component(this: Remix.Handle) {
  return () => (
    <div
      connect={(node, signal) => {
        // Set up something that needs cleanup
        let observer = new ResizeObserver(() => {
          // handle resize
        })
        observer.observe(node)

        // Clean up when element is removed
        signal.addEventListener('abort', () => {
          observer.disconnect()
        })
      }}
    >
      Content
    </div>
  )
}
```

## Component Handle API

Components receive a `Handle` as `this` with the following API:

- **`this.update(task?)`** - Schedule an update. Optionally provide a task to run after the update.
- **`this.queueTask(task)`** - Schedule a task to run after the next update. Useful for DOM operations that need to happen after rendering (e.g., moving focus, scrolling, measuring elements, etc.).
- **`this.on(target, listeners)`** - Listen to an event target with automatic cleanup when the component disconnects.
- **`this.signal`** - An `AbortSignal` that's aborted when the component is disconnected. Useful for cleanup.
- **`this.id`** - Stable identifier per component instance.
- **`this.context`** - Context API for ancestor/descendant communication.

### `this.update(task?)`

Schedule an update. Optionally provide a task to run after the update completes.

```tsx
function Counter(this: Remix.Handle) {
  let count = 0

  return () => (
    <button
      on={{
        click: () => {
          count++
          this.update()
        },
      }}
    >
      Count: {count}
    </button>
  )
}
```

You can pass a task to run after the update:

```tsx
function Player(this: Remix.Handle) {
  let isPlaying = false
  let playButton: HTMLButtonElement
  let stopButton: HTMLButtonElement

  return () => (
    <div>
      <button
        disabled={isPlaying}
        connect={(node) => (playButton = node)}
        on={{
          click: () => {
            isPlaying = true
            this.update(() => {
              // Focus the enabled button after update completes
              stopButton.focus()
            })
          },
        }}
      >
        Play
      </button>
      <button
        disabled={!isPlaying}
        connect={(node) => (stopButton = node)}
        on={{
          click: () => {
            isPlaying = false
            this.update(() => {
              // Focus the enabled button after update completes
              playButton.focus()
            })
          },
        }}
      >
        Stop
      </button>
    </div>
  )
}
```

### `this.queueTask(task)`

Schedule a task to run after the next update. Useful for DOM operations that need to happen after rendering (e.g., moving focus, scrolling, measuring elements).

```tsx
function Form(this: Remix.Handle) {
  let showDetails = false
  let detailsSection: HTMLElement

  return () => (
    <form>
      <label>
        <input
          type="checkbox"
          checked={showDetails}
          on={{
            change: (event) => {
              showDetails = event.currentTarget.checked
              this.update()
              if (showDetails) {
                // Scroll to the expanded section after it renders
                this.queueTask(() => {
                  detailsSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
                })
              }
            },
          }}
        />
        Show additional details
      </label>
      {showDetails && (
        <section
          connect={(node) => (detailsSection = node)}
          css={{
            marginTop: '2rem',
            padding: '1rem',
            border: '1px solid #ccc',
          }}
        >
          <h2>Additional Details</h2>
          <p>This section appears when the checkbox is checked.</p>
        </section>
      )}
    </form>
  )
}
```

### `this.on(target, listeners)`

Listen to an [EventTarget](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget) with automatic cleanup when the component disconnects. Ideal for listening to events on global event targets like `document` and `window`.

```tsx
function KeyboardTracker(this: Remix.Handle) {
  let keys: string[] = []

  this.on(document, {
    keydown: (event) => {
      keys.push(event.key)
      this.update()
    },
  })

  return () => <div>Keys: {keys.join(', ')}</div>
}
```

The listeners are automatically removed when the component is disconnected, so you don't need to manually clean up.

### `this.signal`

An `AbortSignal` that's aborted when the component is disconnected. Useful for cleanup operations.

```tsx
function Clock(this: Handle) {
  let interval = setInterval(() => {
    // clear the interval when the component is disconnected
    if (this.signal.aborted) {
      clearInterval(interval)
      return
    }
    this.update()
  }, 1000)
  return () => <span>{new Date().toString()}</span>
}
```

### `this.id`

Stable identifier per component instance. Useful for HTML APIs like `htmlFor`, `aria-owns`, etc. so consumers don't have to supply an id.

```tsx
function LabeledInput(this: Remix.Handle) {
  return () => (
    <div>
      <label htmlFor={this.id}>Name</label>
      <input id={this.id} type="text" />
    </div>
  )
}
```

### `this.context`

Context API for ancestor/descendant communication. All components are potential context providers and consumers. Use `this.context.set()` to provide values and `this.context.get()` to consume them.

```tsx
function App(this: Remix.Handle<{ theme: string }>) {
  this.context.set({ theme: 'dark' })

  return () => (
    <div>
      <Header />
      <Content />
    </div>
  )
}

function Header(this: Remix.Handle) {
  // Consume context from App
  let { theme } = this.context.get(App)

  return () => <header css={{ backgroundColor: theme === 'dark' ? '#000' : '#fff' }}>Header</header>
}
```

Setting context values does not automatically trigger updates. If a provider needs to render its own context values, call `this.update()` after setting them. However, since providers often don't render context values themselves, calling `update()` can cause expensive updates of the entire subtree. Instead, make your context an [EventTarget](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget) and have consumers subscribe to changes.

```tsx
import { TypedEventTarget } from '@remix-run/interaction'

class Theme extends TypedEventTarget<{ change: Event }> {
  #value: 'light' | 'dark' = 'light'

  get value() {
    return this.#value
  }

  setValue(value: string) {
    this.#value = value
    this.dispatchEvent(new Event('change'))
  }
}

function App(this: Remix.Handle<Theme>) {
  let theme = new Theme()
  this.context.set(theme)

  return () => (
    <div>
      <button
        on={{
          click: () => {
            // no updates in the parent component
            theme.setValue(theme.value === 'light' ? 'dark' : 'light')
          },
        }}
      >
        Toggle Theme
      </button>
      <ThemedContent />
    </div>
  )
}

function ThemedContent(this: Remix.Handle) {
  let theme = this.context.get(App)

  // Subscribe to theme changes and update when it changes
  this.on(theme, { change: this.update })

  return () => (
    <div css={{ backgroundColor: theme.value === 'dark' ? '#000' : '#fff' }}>
      Current theme: {theme.value}
    </div>
  )
}
```

## Fragments

Use `Fragment` to group elements without adding extra DOM nodes:

```tsx
import { Fragment } from '@remix-run/component'

function List(this: Remix.Handle) {
  return () => (
    <>
      <li>Item 1</li>
      <li>Item 2</li>
      <li>Item 3</li>
    </>
  )
}
```

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
