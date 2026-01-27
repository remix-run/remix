# Getting Started

Create interactive UIs with Remix Component using a two-phase component model: setup runs once, render runs on every update.

## Creating a Root

To start using Remix Component, create a root and render your top-level component:

```tsx
import { createRoot } from '@remix-run/component'
import type { Handle } from '@remix-run/component'

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

## Root Methods

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

## Next Steps

- [Components](./components.md) - Component structure and runtime behavior
- [Handle API](./handle.md) - The component's interface to the framework
- [Styling](./styling.md) - CSS prop for inline styling
- [Events](./events.md) - Event handling patterns
