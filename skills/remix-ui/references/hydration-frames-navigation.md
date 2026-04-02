## Hydration

Use `clientEntry()` to mark interactive islands and `run()` to hydrate them.

```tsx
import { clientEntry, on, run, type Handle } from 'remix/component'

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
import { renderToStream } from 'remix/component/server'

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

### Enabling client-side navigation

Client-side navigation requires two pieces of server-side setup:

1. Add `asyncContext()` middleware to the router so `render()` can access the current request and
   router.
2. Pass `frameSrc` and `resolveFrame` to `renderToStream` in the render utility.

`frameSrc: request.url` is what tells the runtime the current page URL. Without it, `<a>` clicks
fall through to full document navigation instead of being intercepted.

```tsx
import { renderToStream, type ResolveFrameContext } from 'remix/component/server'
import { getContext } from 'remix/async-context-middleware'
import type { Router } from 'remix/fetch-router'

export function render(node: RemixNode, init?: ResponseInit) {
  let context = getContext()
  let request = context.request
  let router = context.router

  let stream = renderToStream(node, {
    frameSrc: request.url,
    resolveFrame: (src, target, frameContext) =>
      resolveFrame(router, request, src, target, frameContext),
    onError(error) {
      console.error(error)
    },
  })

  // ...return Response with stream
}
```

### How `<a>` tags work

Once `frameSrc` is set up and `run()` is hydrated on the client, the runtime intercepts standard
`<a>` tag clicks via the Navigation API. No special components or wrappers are needed — plain
anchors with `href` trigger client-side navigation automatically. `<form method="get">` submissions
(including `requestSubmit()`) are also intercepted.

Prefer real `<a>` tags for navigation. Use the programmatic API only when anchors are not practical:

- `navigate(href, options)` — imperative navigation from code
- `link(href, options)` mixin — makes a non-anchor element behave like a navigation link

### Scroll behavior

By default, client-side navigation scrolls the page to the top. To prevent this for navigations
that stay on the same page (filter tabs, query-param changes, in-page state), use
`rmx-reset-scroll="false"` on the `<a>` tag:

```tsx
<a href="/games?players=3" rmx-reset-scroll="false" mix={[tabStyle]}>
  3P
</a>
```

The equivalent options for programmatic navigation:

- `navigate(href, { resetScroll: false })`
- `link(href, { resetScroll: false })` mixin

### Attributes understood by the runtime

- `rmx-target` — direct navigation to a named frame
- `rmx-src` — override the frame source URL (distinct from the browser URL)
- `rmx-reset-scroll` — set to `"false"` to preserve scroll position after navigation
- `rmx-document` — opt out of client-side interception; navigate as a full document load

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
