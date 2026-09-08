# spa

Client-rendered application routing for Remix. It connects a standard fetch router to the browser
UI runtime without exposing the response carrier used to associate route responses with Remix
nodes.

## Features

- **Standard fetch routing** - Preserve `Request` to `Response` dispatch, redirects, status codes,
  headers, middleware, and cancellation
- **Node rendering middleware** - Render `RemixNode` values through `context.render()`
- **Browser runtime** - Resolve the current URL and future frame navigations through the router
- **Initial fallback** - Display an interactive Remix node while the first route loads

## Installation

```sh
npm i remix
```

## Usage

Install `render()` before middleware and route handlers that use `context.render()`, then pass the
router to `run()`.

```tsx
import { createRouter } from 'remix/router'
import { get, route } from 'remix/routes'
import { render, run } from 'remix/spa'

const routes = route({
  home: get('/'),
  about: get('/about'),
})

const router = createRouter({
  middleware: [render()],
  defaultHandler({ render }) {
    return render(<h1>Not Found</h1>, { status: 404 })
  },
})

router.map(routes, {
  actions: {
    home({ render }) {
      return render(<h1>Home</h1>)
    },
    about({ render }) {
      return render(<h1>About</h1>)
    },
  },
})

const app = run(router, { fallback: <p>Loading…</p> })
await app.ready()
```

The router remains an ordinary fetch router, so its normal actions, controllers, middleware, and
context typing continue to apply.

## Wrapping Route Content

Pass a request-aware transform to `render()` when every route should share an application shell.

```tsx
const router = createRouter({
  middleware: [
    render((content, { url }) => (
      <main data-pathname={url.pathname}>
        <nav>{/* ... */}</nav>
        {content}
      </main>
    )),
  ],
})
```

## Related Packages

- [`fetch-router`](https://github.com/remix-run/remix/tree/main/packages/fetch-router) - Request
  routing, controllers, and middleware context
- [`render-middleware`](https://github.com/remix-run/remix/tree/main/packages/render-middleware) -
  Request-scoped renderer middleware
- [`ui`](https://github.com/remix-run/remix/tree/main/packages/ui) - Remix components, frames, and
  browser runtime

## Related Work

- [Fetch standard](https://fetch.spec.whatwg.org/) - The request and response model preserved by SPA
  routers
- [Navigation API](https://wicg.github.io/navigation-api/) - Browser navigation lifecycle used by
  the Remix UI runtime

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
