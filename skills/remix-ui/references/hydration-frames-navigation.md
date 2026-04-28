## Hydration

Use `clientEntry()` to mark interactive islands and `run()` to hydrate them.

```tsx
import { clientEntry, on, run, type Handle } from 'remix/ui'

export let Counter = clientEntry('/assets/entry.js#Counter', (handle: Handle) => {
  let count = 0

  return () => (
    <button
      mix={[
        on('click', () => {
          count++
          handle.update()
        }),
      ]}
    >
      {count}
    </button>
  )
})

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
  console.error(event.error)
})

await app.ready()
```

Rules:

- `run()` takes only the init object.
- `app.ready()` waits for initial hydration.
- `app` emits top-level runtime errors.
- Client entry props must be serializable.

## Frames

Use `<Frame>` for server-rendered regions that should load or reload independently.

```tsx
import { renderToStream } from 'remix/ui/server'

let stream = renderToStream(<App />, {
  frameSrc: request.url,
  resolveFrame(src, _target, context) {
    let currentFrameSrc = context?.currentFrameSrc ?? request.url
    let url = new URL(src, currentFrameSrc)
    return renderToStream(<FrameRoute url={url} />, {
      frameSrc: url,
      topFrameSrc: context?.topFrameSrc ?? request.url,
      resolveFrame,
    })
  },
})
```

Key points:

- `frameSrc` seeds SSR frame state for the current render.
- `topFrameSrc` preserves the outer document URL across nested frame renders.
- `resolveFrame(src, target, context)` receives the target and nested-frame context.
- Frame content can be HTML strings, streams, or Remix nodes.

## Navigation

Prefer real anchors for normal document navigation.

When you need app-driven navigation, use:

- `navigate(href, options)`
- `link(href, options)` mixin

Attributes understood by the runtime:

- `rmx-target`
- `rmx-src`
- `rmx-document`

## Head Management

Manage document head state with an explicit `<head>` in your document or layout structure.

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

Use this pattern when title, metadata, stylesheets, or other document-level head content should
change as the UI changes.

Rules:

- Put document-level `title`, `meta`, `link`, and `style` tags inside an explicit `<head>`.
- Treat `<head>` as part of the rendered UI tree and update it intentionally during navigation or
  layout changes.
- Keep JSON-LD or other content-bearing scripts where they semantically belong. They are rendered in
  place unless you explicitly place them inside `<head>`.
- Bare head-like tags rendered outside `<head>` stay where they are rendered; they are not moved
  into the document head for you.
