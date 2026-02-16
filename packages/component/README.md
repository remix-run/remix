# component

A minimal component system built on JavaScript and DOM primitives. Write components that render on the server, stream to the browser, and hydrate only where you need interactivity.

## Features

- **JSX Runtime** - Convenient JSX syntax
- **Component State** - State managed with plain JavaScript variables
- **Manual Updates** - Explicit control over when components update via `handle.update()`
- **Real DOM Events** - Events are real DOM events using [`@remix-run/interaction`](../interaction)
- **Inline CSS** - CSS prop with pseudo-selectors and nested rules
- **Server Rendering** - Stream full pages or fragments with `renderToStream`
- **Hydration** - Mark interactive components with `clientEntry` and hydrate them on the client with `run`
- **Frames** - `<Frame>` streams partial server UI into the page and can be reloaded without a full page navigation

## Installation

```sh
npm i remix
```

## Quick Start

### Server

Render a full page to a streaming response:

```tsx
import { renderToStream } from '@remix-run/component/server'
import { Frame } from '@remix-run/component'
import { Counter } from './assets/counter.tsx'

function App() {
  return () => (
    <html>
      <head>
        <title>My App</title>
        <script async type="module" src="/assets/entry.js" />
      </head>
      <body>
        <h1>Hello</h1>
        <Counter setup={0} label="Clicks" />
        <Frame src="/sidebar" fallback={<div>Loading...</div>} />
      </body>
    </html>
  )
}

let stream = renderToStream(<App />, {
  resolveFrame: (src) => fetchFrameHtml(src),
})

return new Response(stream, {
  headers: { 'Content-Type': 'text/html' },
})
```

### Client Entry

Mark components that need client-side interactivity with `clientEntry`. They render on the server and hydrate on the client:

```tsx
import { clientEntry, type Handle } from '@remix-run/component'

export let Counter = clientEntry(
  '/assets/counter.js#Counter',
  function Counter(handle: Handle, setup: number) {
    let count = setup

    return (props: { label: string }) => (
      <div>
        <span>
          {props.label}: {count}
        </span>
        <button
          on={{
            click() {
              count++
              handle.update()
            },
          }}
        >
          +
        </button>
      </div>
    )
  },
)
```

The first argument is the module URL and export name the client will use to load this component. The component renders on the server like any other component, and the client hydrates it in place, preserving the server-rendered HTML.

### Client

Boot the client with `run`. It finds all client entries in the page, loads their modules, and hydrates them:

```tsx
import { run } from '@remix-run/component'

let app = run(document, {
  async loadModule(moduleUrl, exportName) {
    let mod = await import(moduleUrl)
    return mod[exportName]
  },
  async resolveFrame(src) {
    let res = await fetch(src, { headers: { accept: 'text/html' } })
    return await res.text()
  },
})

await app.ready()
```

### Frames

`<Frame>` renders server content into the page. Frames can stream in after the initial HTML, nest other frames, and contain client entries. They can be reloaded from the client without a full page navigation:

```tsx
<Frame src="/sidebar" fallback={<div>Loading sidebar...</div>} />
```

Client entries inside a frame can trigger a reload:

```tsx
function RefreshButton(handle: Handle) {
  return () => (
    <button
      on={{
        click() {
          handle.frame.reload()
        },
      }}
    >
      Refresh
    </button>
  )
}
```

When a frame reloads, its server HTML is re-fetched and diffed into the page. Client entries inside the frame receive updated props from the server while preserving their local state.

You can also name frames and reload adjacent ones:

```tsx
<Frame name="cart-summary" src="/cart-summary" />
<Frame src="/cart-row" />
```

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
      Save
    </button>
  )
}
```

When a frame reloads, its server HTML is re-fetched and diffed into the page. Client entries inside the frame receive updated props from the server while preserving their local state.

## Components

All components return a render function. The setup function runs **once** when the component is first created, and the returned render function runs on the first render and **every update** afterward:

```tsx
function Counter(handle: Handle, setup: number) {
  // Setup phase: runs once
  let count = setup

  // Return render function: runs on every update
  return (props: { label?: string }) => (
    <div>
      {props.label || 'Count'}: {count}
      <button
        on={{
          click: () => {
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

### Setup Prop vs Props

When a component returns a function, it has two phases:

1. **Setup phase** - The component function receives the `setup` prop and runs once. Use this for initialization.
2. **Render phase** - The returned function receives props and runs on initial render and every update afterward. Use this for rendering.

The `setup` prop is separate from regular props. Only the `setup` prop is passed to the setup function, and only props are passed to the render function.

- `setup` prop for values that initialize state (e.g., `initial`, `defaultValue`)
- Regular props for values that change over time (e.g., `label`, `disabled`)

```tsx
// Usage: setup prop goes to setup function, regular props go to render function
let el = <Counter setup={5} label="Total" />

function Counter(
  handle: Handle,
  setup: number, // receives 5 (the setup prop value)
) {
  let count = setup // use setup for initialization

  return (props: { label?: string }) => {
    // props only receives { label: "Total" } - not the setup prop
    return (
      <div>
        {props.label}: {count}
      </div>
    )
  }
}
```

## Events

Events use the `on` prop and are handled by [`@remix-run/interaction`](../interaction). Listeners receive an `AbortSignal` that's aborted when the component is disconnected or the handler is re-entered.

```tsx
function SearchInput(handle: Handle) {
  let query = ''

  return () => (
    <input
      type="text"
      value={query}
      on={{
        input: (event, signal) => {
          query = event.currentTarget.value
          handle.update()

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

You can also listen to global event targets like `document` or `window` using `handle.on()` with automatic cleanup on component removal:

```tsx
function KeyboardTracker(handle: Handle) {
  let keys: string[] = []

  handle.on(document, {
    keydown: (event) => {
      keys.push(event.key)
      handle.update()
    },
  })

  return () => <div>Keys: {keys.join(', ')}</div>
}
```

## CSS Prop

Use the `css` prop for inline styles with pseudo-selectors and nested rules:

```tsx
function Button(handle: Handle) {
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
function Button(handle: Handle) {
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
function Form(handle: Handle) {
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
function Component(handle: Handle) {
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

Components receive a `Handle` as their first argument with the following API:

- **`handle.update()`** - Schedule an update and await completion to get an `AbortSignal`.
- **`handle.queueTask(task)`** - Schedule a task to run after the next update. Useful for DOM operations that need to happen after rendering (e.g., moving focus, scrolling, measuring elements, etc.).
- **`handle.on(target, listeners)`** - Listen to an event target with automatic cleanup when the component disconnects.
- **`handle.signal`** - An `AbortSignal` that's aborted when the component is disconnected. Useful for cleanup.
- **`handle.id`** - Stable identifier per component instance.
- **`handle.context`** - Context API for ancestor/descendant communication.
- **`handle.frame`** - The component's closest frame. Call `handle.frame.reload()` to refresh the frame's server content.
- **`handle.frames.get(name)`** - Look up named frames in the current runtime tree for adjacent frame reloads.

### `handle.update()`

Schedule an update and optionally await completion to coordinate post-update work.

```tsx
function Counter(handle: Handle) {
  let count = 0

  return () => (
    <button
      on={{
        click: () => {
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

You can await the update before doing DOM work:

```tsx
function Player(handle: Handle) {
  let isPlaying = false
  let playButton: HTMLButtonElement
  let stopButton: HTMLButtonElement

  return () => (
    <div>
      <button
        disabled={isPlaying}
        connect={(node) => (playButton = node)}
        on={{
          async click() {
            isPlaying = true
            await handle.update()
            // Focus the enabled button after update completes
            stopButton.focus()
          },
        }}
      >
        Play
      </button>
      <button
        disabled={!isPlaying}
        connect={(node) => (stopButton = node)}
        on={{
          async click() {
            isPlaying = false
            await handle.update()
            // Focus the enabled button after update completes
            playButton.focus()
          },
        }}
      >
        Stop
      </button>
    </div>
  )
}
```

### `handle.queueTask(task)`

Schedule a task to run after the next update. Useful for DOM operations that need to happen after rendering (e.g., moving focus, scrolling, measuring elements).

```tsx
function Form(handle: Handle) {
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
              handle.update()
              if (showDetails) {
                // Scroll to the expanded section after it renders
                handle.queueTask(() => {
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

### `handle.on(target, listeners)`

Listen to an [EventTarget](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget) with automatic cleanup when the component disconnects. Ideal for listening to events on global event targets like `document` and `window`.

```tsx
function KeyboardTracker(handle: Handle) {
  let keys: string[] = []

  handle.on(document, {
    keydown: (event) => {
      keys.push(event.key)
      handle.update()
    },
  })

  return () => <div>Keys: {keys.join(', ')}</div>
}
```

The listeners are automatically removed when the component is disconnected, so you don't need to manually clean up.

### `handle.signal`

An `AbortSignal` that's aborted when the component is disconnected. Useful for cleanup operations.

```tsx
function Clock(handle: Handle) {
  let interval = setInterval(() => {
    // clear the interval when the component is disconnected
    if (handle.signal.aborted) {
      clearInterval(interval)
      return
    }
    handle.update()
  }, 1000)
  return () => <span>{new Date().toString()}</span>
}
```

### `handle.id`

Stable identifier per component instance. Useful for HTML APIs like `htmlFor`, `aria-owns`, etc. so consumers don't have to supply an id.

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

Context API for ancestor/descendant communication. All components are potential context providers and consumers. Use `handle.context.set()` to provide values and `handle.context.get()` to consume them.

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
  // Consume context from App
  let { theme } = handle.context.get(App)
  return () => (
    <header
      css={{
        backgroundColor: theme === 'dark' ? '#000' : '#fff',
      }}
    >
      Header
    </header>
  )
}
```

Setting context values does not automatically trigger updates. If a provider needs to render its own context values, call `handle.update()` after setting them. However, since providers often don't render context values themselves, calling `update()` can cause expensive updates of the entire subtree. Instead, make your context an [EventTarget](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget) and have consumers subscribe to changes.

```tsx
import { TypedEventTarget } from 'remix/interaction'

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

function App(handle: Handle<Theme>) {
  let theme = new Theme()
  handle.context.set(theme)

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

function ThemedContent(handle: Handle) {
  let theme = handle.context.get(App)

  // Subscribe to theme changes and update when it changes
  handle.on(theme, { change: () => handle.update() })

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
function List(handle: Handle) {
  return () => (
    <>
      <li>Item 1</li>
      <li>Item 2</li>
      <li>Item 3</li>
    </>
  )
}
```

## Documentation

- [Getting Started](./docs/getting-started.md)
- [Components](./docs/components.md)
- [Handle API](./docs/handle.md)
- [Server Rendering](./docs/server-rendering.md)
- [Hydration](./docs/hydration.md)
- [Frames](./docs/frames.md)
- [Styling](./docs/styling.md)
- [Events](./docs/events.md)
- [Context](./docs/context.md)
- [Composition](./docs/composition.md)
- [Patterns](./docs/patterns.md)
- [Testing](./docs/testing.md)
- [Animation](./docs/animate.md)

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
