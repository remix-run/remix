# Runtime Patterns

Use these patterns when wiring the server boundary of a Remix app.

## `server.ts`

Keep `server.ts` small:

- initialize long-lived resources once before serving requests
- create the router once
- pass requests to `router.fetch(request)`
- catch uncaught runtime errors at the boundary
- shut down the server cleanly on process signals when the runtime supports it

In Node, the usual entrypoint shape is:

```ts
import * as http from 'node:http'
import { createRequestListener } from 'remix/node-fetch-server'

let router = createAppRouter()

let server = http.createServer(
  createRequestListener(async (request) => {
    try {
      return await router.fetch(request)
    } catch (error) {
      console.error(error)
      return new Response('Internal Server Error', { status: 500 })
    }
  }),
)
```

## Typed App Context

Define one app-local context contract from the root middleware tuple and build route-specific params
on top of it.

```ts
import { createRouter, type AnyParams, type MiddlewareContext, type WithParams } from 'remix/fetch-router'

type RootMiddleware = [
  ReturnType<typeof formData>,
  ReturnType<typeof session>,
  ReturnType<typeof loadDatabase>,
  ReturnType<typeof loadAuth>,
]

export type AppContext<params extends AnyParams = AnyParams> = WithParams<
  MiddlewareContext<RootMiddleware>,
  params
>
```

This keeps middleware and controllers aligned on the same request-scoped values. Add stronger
variants such as authenticated context types only when a route truly requires them.

## Request-Scoped Helpers

Prefer passing `context` into helpers directly.

Use `asyncContext()` and `getContext()` only when the helper is several layers down and threading
`context` through every call would make the code harder to understand. That pattern is most useful
for app-owned utilities like `getCurrentUser()` or `getCurrentCart()` that run during one request.

## Uploads And Files

Treat uploads as a request-boundary concern:

- parse multipart bodies with `formData(...)`
- plug in an `uploadHandler` when files should be stored or transformed during parsing
- keep the storage target app-owned, such as disk, S3, or another file backend
- let route handlers read the normalized values from `context.get(FormData)` instead of reparsing
  the request

Static asset delivery is separate. Use `staticFiles(...)` for files served directly from a public
root and keep it early in the middleware stack.

## Testing And Streaming

- Test the server/router boundary with `router.fetch(...)` and standard `Request` inputs.
- Return standard `Response` objects from handlers, including streaming bodies when needed.
- Treat streaming as a server/runtime concern first and a UI concern second: the server owns the
  response shape, while UI skills own how streamed content is rendered.
