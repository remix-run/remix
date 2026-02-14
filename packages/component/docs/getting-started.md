# Getting Started

Create interactive UIs with Remix Component using a two-phase component model: setup runs once, render runs on every update.

## Client-Only Root

To start using Remix Component on the client, create a root and render your top-level component:

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
```

## Root Methods

The root object provides several methods:

- **`render(node)`** - Renders a component tree into the root container
- **`flush()`** - Synchronously flushes all pending updates and tasks
- **`dispose()`** - Removes the component tree and cleans up

```tsx
let root = createRoot(document.body)

// Render initial app
root.render(<App />)

// Flush any pending updates synchronously
root.flush()

// Later, remove the app
root.dispose()
```

## Server-Rendered App

For a server-rendered app, define your page as a component, render it with `renderToStream`, and hydrate client entries on the client:

### Server

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
  headers: { 'Content-Type': 'text/html; charset=utf-8' },
})
```

### Client entry module

```tsx
// assets/entry.tsx
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

### Client entry component

```tsx
// assets/counter.tsx
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

## Next Steps

- [Components](./components.md) - Component structure and runtime behavior
- [Handle API](./handle.md) - The component's interface to the framework
- [Server Rendering](./server-rendering.md) - `renderToString` and `renderToStream`
- [Hydration](./hydration.md) - `clientEntry` and `run`
- [Frames](./frames.md) - Streaming partial server UI with `<Frame>`
- [Styling](./styling.md) - CSS prop for inline styling
- [Events](./events.md) - Event handling patterns
