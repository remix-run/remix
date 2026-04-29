# Hydration, Frames, and Navigation

## What This Covers

How server-rendered UI becomes interactive in the browser, and how the page updates without a full
navigation. Read this when the task involves:

- Marking a component for client-side hydration with `clientEntry`
- Booting the client runtime with `run`
- Streaming server content into a region of the page with `<Frame>` and reloading those regions
- Triggering Navigation API transitions with `navigate(...)` or `link(...)`
- Server rendering with `renderToStream` or `renderToString`
- Managing the document `<head>`

For component-local state and updates, see `component-model.md`. For host-element behavior and
events, see `mixins-styling-events.md`.

## Server First, Then Hydrate

Make the server route correct before adding `clientEntry(...)`. A POST should already do the right
thing on its own — return HTML, a redirect, or an error response — and a GET should already render
the page the user expects. `clientEntry` exists to layer interactivity on top of UI that already
works without it.

When server state changes after a mutation, prefer reloading a `<Frame>` when the UI region already
maps cleanly to a server-rendered route. Frames re-fetch the same route, so the rendering logic
stays in one place and the client does not need a parallel "state" API.

```tsx
on('submit', async (event, signal) => {
  event.preventDefault()
  await fetch(routes.cart.add.href(), {
    method: 'POST',
    body: new FormData(event.currentTarget),
    signal,
  })
  if (signal.aborted) return
  await handle.frames.get('cart-summary')?.reload()
})
```

Use polling or a small JSON state endpoint when the data changes outside this page, or when a tiny
shared widget would be heavier to model as a frame. Pick the lightest sync mechanism that preserves
clear ownership of rendering logic.

## Client Entries

Use `clientEntry` to mark a component for client-side hydration. In source-served apps, prefer the
source module's `import.meta.url` as the entry ID and let server rendering map it to the public
asset URL:

```tsx
import { clientEntry, on, type Handle } from 'remix/ui'

export const Counter = clientEntry(
  import.meta.url,
  function Counter(handle: Handle<{ initialCount: number; label: string }>) {
    let count = handle.props.initialCount

    return () => (
      <div>
        <span>
          {handle.props.label}: {count}
        </span>
        <button
          mix={on('click', () => {
            count++
            handle.update()
          })}
        >
          +
        </button>
      </div>
    )
  },
)
```

On the server, provide `resolveClientEntry` to `renderToStream(...)` so source file URLs become
browser-loadable asset URLs. Keep this resolution in the render helper so component modules do not
hard-code deployment-specific asset paths:

```tsx
let stream = renderToStream(<App />, {
  async resolveClientEntry(entryId, component) {
    let exportName = entryId.split('#')[1] || component.name
    if (!exportName) {
      throw new Error(`Unable to resolve client entry export for ${entryId}`)
    }

    return {
      href: await assetServer.getHref(entryId),
      exportName,
    }
  },
})
```

If the module export name differs from the component function name, include `#ExportName` in the
entry ID or return the exact export name from `resolveClientEntry`. A render helper that only
supports source-owned entries can also fail fast when `entryId` is not a `file://` URL.

On the server, `clientEntry` components render like any other component. The server wraps their
output in comment markers and serializes props into a `<script type="application/json">` tag.

Client entry props must be serializable: strings, numbers, booleans, `null`, `undefined`, plain
objects/arrays of the above, JSX elements, and `<Frame>` elements. Functions and class instances
cannot be passed.

## Booting the Client

Use `run` to start the client runtime. It scans the document for client entry markers, loads
modules, and hydrates each one:

```tsx
import { run } from 'remix/ui'

let app = run({
  async loadModule(moduleUrl, exportName) {
    let mod = await import(moduleUrl)
    return mod[exportName]
  },
  async resolveFrame(src, signal, target) {
    let headers = new Headers({ accept: 'text/html' })
    if (target) headers.set('x-remix-target', target)
    let response = await fetch(src, { headers, signal })
    return response.body ?? (await response.text())
  },
})

app.addEventListener('error', (event) => {
  console.error('Component error:', event.error)
})

await app.ready()
```

### `run` options

- **`loadModule(moduleUrl, exportName)`** (required) — return the component function for each
  client entry. Typically uses dynamic `import()`.
- **`resolveFrame(src, signal, target)`** (optional) — called when a `<Frame>` loads or reloads
  content. `target` is available when frame targeting matters.

### `app` methods

- **`app.ready()`** — resolves when all initial client entries are hydrated
- **`app.flush()`** — synchronously flushes all pending updates
- **`app.dispose()`** — tears down all hydrated components

`app` is an `EventTarget` that emits `error` events from any hydrated component.

## Frames

A `<Frame>` renders server content into the page. Frames stream after the initial HTML, nest inside
other frames, contain client entries, and can be reloaded without full page navigation.

```tsx
import { Frame } from 'remix/ui'

function App() {
  return () => (
    <div>
      <Frame src="/sidebar" fallback={<div>Loading...</div>} />
      <Frame name="main" src="/main-content" />
    </div>
  )
}
```

### Frame props

- **`src`** (required) — URL to fetch the frame content from
- **`fallback`** (optional) — content to show while loading; determines streaming behavior
- **`name`** (optional) — registers the frame for lookup via `handle.frames.get(name)`
- **`on`** (optional) — event handlers for events dispatched from the frame element

### Blocking vs non-blocking

- **Without `fallback`** (blocking) — the server waits for frame content before sending the initial
  HTML chunk
- **With `fallback`** (non-blocking) — the fallback renders immediately; real content streams in
  later and replaces it

### Reloading frames

Client entries inside a frame can trigger a reload:

```tsx
// Reload the containing frame
handle.frame.reload()

// Reload an adjacent named frame
await handle.frames.get('cart-summary')?.reload()

// Reload the entire page/frame tree
handle.frames.top.reload()
```

When a frame reloads, matching DOM nodes are updated in place. Client entries receive updated props
while preserving their local component state.

### Nested frames

Frames can nest. Each frame owns its own DOM region and hydrates client entries independently.
During SSR, `handle.frame.src` points at the frame being rendered, while
`handle.frames.top.src` stays fixed at the outer document URL.

## Server Rendering

### `renderToStream`

Renders a component tree to a `ReadableStream<Uint8Array>`. Sends initial HTML immediately and
streams frame content as it resolves:

```tsx
import { renderToStream } from 'remix/ui/server'

let stream = renderToStream(<App />, {
  frameSrc: request.url,
  resolveFrame(src, target, context) {
    let frameUrl = new URL(src, context?.currentFrameSrc ?? request.url)
    return fetchHtml(frameUrl)
  },
  onError(error) {
    console.error(error)
  },
})

return new Response(stream, {
  headers: { 'Content-Type': 'text/html; charset=utf-8' },
})
```

Options:

- **`frameSrc`** — seeds SSR frame state; populates `handle.frame.src` and `handle.frames.top.src`
- **`topFrameSrc`** — overrides the root frame URL for nested frame renders (carry forward from
  `resolveFrame` context)
- **`resolveFrame(src, target, context)`** — return HTML string, `ReadableStream<Uint8Array>`, or a
  promise of either. `context.currentFrameSrc` is the containing frame URL; `context.topFrameSrc`
  is the outer document URL
- **`onError(error)`** — called on rendering errors

### `renderToString`

Renders a component tree to a complete HTML string. Use for static pages or embedding HTML:

```tsx
import { renderToString } from 'remix/ui/server'
let html = await renderToString(<App />)
```

### CSS in SSR

Components using the `css` mixin have styles collected during rendering and emitted as a single
`<style>` tag in `<head>`. No client-side style injection needed.

## Navigation

Use real anchors for normal document navigation. For app-driven navigation:

- `navigate(href, options?)` — performs a Navigation API transition
- `link(href, options?)` mixin — makes any element behave like a navigation link

```tsx
import { navigate } from 'remix/ui'
navigate('/dashboard', { history: 'replace' })
```

Options: `src`, `target`, `history` (`'push' | 'replace'`), `resetScroll`.

Attributes understood by the runtime: `rmx-target`, `rmx-src`, `rmx-document`.

## Head Management

Manage document head with an explicit `<head>` in your document structure:

```tsx
function App() {
  return () => (
    <html>
      <head>
        <title>Dashboard</title>
        <meta name="description" content="Team dashboard" />
        <link rel="stylesheet" href="/styles/app.css" />
      </head>
      <body>
        <main>...</main>
      </body>
    </html>
  )
}
```

Put `title`, `meta`, `link`, and `style` tags inside an explicit `<head>`. Bare head-like tags
rendered outside `<head>` stay where they are — they are not moved into the document head for you.
