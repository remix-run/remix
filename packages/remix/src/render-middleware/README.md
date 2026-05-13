# render-middleware

Request-scoped renderer middleware for Remix. It stores a renderer in `fetch-router` request context so route actions can render responses without passing request-specific rendering details through every action.

## Features

- **Generic renderers** - Render any input type to a `Response`
- **Request-scoped setup** - Create renderers from the current `RequestContext`
- **Typed context** - Typed `context.render` (or `context.get(Renderer)`)
- **Small runtime** - The package only stores a renderer in request context

## Installation

```sh
npm i remix
```

## Usage

Use `renderWith()` to add a renderer to `context.render` and `context.get(Renderer)`.

```ts
import { createRouter, type MiddlewareContext } from 'remix/fetch-router'
import { renderWith } from 'remix/render-middleware'

const render = renderWith(
  (context) =>
    function render(value: string, init?: ResponseInit) {
      return new Response(`${context.url.pathname}: ${value}`, init)
    },
)

type AppContext = MiddlewareContext<[typeof render]>

const router = createRouter<AppContext>({
  middleware: [render],
})

router.get('/hello', (context) => {
  return context.render('Hello')
})
```

Use `context.render(...)` (or `context.get(Renderer)(...)`).

Renderers may render any value type, not just UI nodes.

```ts
import { renderWith } from 'remix/render-middleware'

const json = renderWith(
  () =>
    function render(data: unknown, init?: ResponseInit) {
      return Response.json(data, init)
    },
)

router.get('/api', (context) => {
  return context.render({ ok: true })
})
```

For Remix UI, create a renderer that owns frame resolution and response creation.

```tsx
import { createHtmlResponse } from 'remix/response/html'
import { renderWith } from 'remix/render-middleware'
import type { RemixNode } from 'remix/ui'
import { renderToStream } from 'remix/ui/server'

const render = renderWith(
  ({ router, url }) =>
    function render(node: RemixNode, init?: ResponseInit) {
      let stream = renderToStream(node, {
        async resolveFrame(src) {
          let response = await router.fetch(new URL(src, url))

          if (!response.ok) {
            return `<pre>Frame error: ${response.status}</pre>`
          }

          return response.body ?? response.text()
        },
      })

      return createHtmlResponse(stream, init)
    },
)
```

## Related Packages

- [`fetch-router`](https://github.com/remix-run/remix/tree/main/packages/fetch-router) - Request routing and context
- [`ui`](https://github.com/remix-run/remix/tree/main/packages/ui) - Remix UI rendering primitives
- [`response`](https://github.com/remix-run/remix/tree/main/packages/response) - Response helpers

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
