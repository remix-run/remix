# Hydration

Hydration makes server-rendered HTML interactive on the client. You mark specific components as **client entries**, and the client runtime finds them in the page, loads their code, and hydrates them in place.

Only the components you mark are hydrated. The rest of the page stays as static HTML.

## Defining a client entry

Use `clientEntry` to mark a component for hydration. The first argument is the module URL and export name the client will use to load the component:

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

The format is `moduleUrl#ExportName`. If you omit the export name, the function's name is used as a fallback.

On the server, `clientEntry` components render like any other component. The server wraps their output in comment markers and serializes their props into a `<script type="application/json">` tag so the client knows what to hydrate and with what data.

## Booting the client

Use `run` to start the client. It scans the document for client entry markers, loads the corresponding modules, and hydrates each one:

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

### `run` options

- **`loadModule(moduleUrl, exportName)`** (required) - Called for each client entry found in the page. Return the component function. Typically uses dynamic `import()`.
- **`resolveFrame(src)`** (optional) - Called when a `<Frame>` needs to load or reload content. If omitted, Remix Component uses a placeholder HTML response (`<p>resolve frame unimplemented</p>`). See [Frames](./frames.md) for details.

### `app` methods

- **`app.ready()`** - Returns a promise that resolves when all initial client entries have been hydrated.
- **`app.flush()`** - Synchronously flushes all pending updates.
- **`app.dispose()`** - Tears down all hydrated components and cleans up.

`app` is also an `EventTarget`. You can listen for errors from any hydrated component:

```tsx
app.addEventListener('error', (event) => {
  console.error('Component error:', event.error)
})
```

## What gets serialized

Client entry props are serialized to JSON. Supported prop types:

- Strings, numbers, booleans, `null`, `undefined`
- Plain objects and arrays of the above
- JSX elements (serialized as descriptors and revived on the client)
- `<Frame>` elements in props (serialized as frame descriptors)

Functions, class instances, and other non-serializable values cannot be passed as props to client entries.

## How hydration works

1. The server renders client entry components and wraps their output in `<!-- rmx:h:id -->` / `<!-- /rmx:h -->` comment markers.
2. Props and module metadata are collected into a `<script type="application/json" id="rmx-data">` tag.
3. On the client, `run` parses the data script, discovers the markers, and calls `loadModule` for each entry.
4. Once a module loads, the component is hydrated against the existing DOM. Matching elements are adopted in place; mismatches are patched.

This means:

- The page is fully rendered and interactive as soon as modules load. No blank flash.
- Only marked components ship JavaScript. Static content stays static.
- Client entries can appear anywhere in the tree, including inside frames.

## See Also

- [Server Rendering](./server-rendering.md) - Rendering components to HTML
- [Frames](./frames.md) - Streaming partial server UI
- [Components](./components.md) - Component model and lifecycle
