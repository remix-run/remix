# render-middleware

Request-scoped response rendering for Remix. It provides the conventional Remix UI renderer and a low-level escape hatch for custom renderers.

## Features

- **Remix UI rendering** - Stream nodes to HTML responses with `render()`
- **Framework-owned frames** - Resolve nested and targeted `<Frame>` requests through the current router
- **Client entry assets** - Resolve source-based `clientEntry()` modules through an asset server
- **Typed context** - Preserve renderer input and response option types on `context.render`
- **Custom renderers** - Install JSON, email, or other response pipelines with `renderWith()`

## Installation

```sh
npm i remix
```

## Usage

Install `render()` in the router middleware stack. Pass an asset server when components use source-based client entries such as `clientEntry(import.meta.url, Component)`.

```tsx
import { createAssetServer } from 'remix/assets'
import { render } from 'remix/middleware/render'
import { staticFiles } from 'remix/middleware/static'
import { createRouter } from 'remix/router'
import { Frame } from 'remix/ui'

let assets = createAssetServer({
  basePath: '/assets',
  fileMap: { 'app/*path': 'app/*path' },
  allow: ['app/assets/**'],
})

let router = createRouter({
  middleware: [staticFiles('./public'), render({ assets })],
})

router.get('/', (context) =>
  context.render(
    <html>
      <body>
        <h1>Dashboard</h1>
        <Frame src="/activity" fallback={<p>Loading activity…</p>} />
      </body>
    </html>,
  ),
)
```

`context.render(node, init)` returns an HTML `Response` and preserves the supplied status and headers:

```tsx
router.get('/missing', (context) =>
  context.render(<h1>Not found</h1>, {
    status: 404,
    headers: { 'Cache-Control': 'no-store' },
  }),
)
```

The middleware forwards request credentials and session headers to internal frame requests, converts them to safe `GET` requests, follows redirects, preserves application error bodies, propagates frame targets and top-frame URLs, and cancels frame rendering when the original request is aborted.

### Options

- **`assets`** - An asset server that resolves source-based client entry IDs to browser module URLs. Omit it when client entries already use public URLs or the app has no client entries.
- **`onError`** - A callback for server rendering errors. When omitted, the UI renderer uses its default error reporting.

## Custom renderers

Use `renderWith()` when the input is not a Remix UI node or the application owns a fully custom response pipeline. The factory runs once per request and may read the current request context.

```ts
import { renderWith } from 'remix/middleware/render'
import { createRouter } from 'remix/router'

let json = renderWith(
  () =>
    function render(data: unknown, init?: ResponseInit) {
      return Response.json(data, init)
    },
)

let router = createRouter({ middleware: [json] })

router.get('/api/status', (context) => context.render({ ok: true }))
```

Custom renderers are also available through `context.get(Renderer)` when direct-property access is not suitable.

## Related Packages

- [`assets`](https://github.com/remix-run/remix/tree/main/packages/assets) - Source asset compilation and browser module URLs
- [`fetch-router`](https://github.com/remix-run/remix/tree/main/packages/fetch-router) - Request routing and typed context
- [`ui`](https://github.com/remix-run/remix/tree/main/packages/ui) - Remix UI components, frames, and server rendering
- [`response`](https://github.com/remix-run/remix/tree/main/packages/response) - Web `Response` helpers

## Related Work

- [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)
- [Streams API](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API)

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
