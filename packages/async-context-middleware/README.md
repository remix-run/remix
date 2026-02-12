# async-context-middleware

Request-scoped async context middleware for Remix. It stores each request context in [`AsyncLocalStorage`](https://nodejs.org/api/async_context.html#class-asynclocalstorage) so utilities can access it anywhere in the same async call stack.

## Features

- **Request Context Access** - Read request context from anywhere in the same async execution flow
- **Simple Router Integration** - Add a single middleware at the router level
- **Node Async Hooks** - Built on `node:async_hooks` `AsyncLocalStorage`

## Installation

```sh
npm i remix
```

## Usage

Simply use the `asyncContext()` middleware at the router level to make the request context available to all functions in the same async execution context. Get access to the context using the `getContext()` function.

```ts
import { createRouter } from 'remix/fetch-router'
import { asyncContext, getContext } from 'remix/async-context-middleware'

let router = createRouter({
  middleware: [asyncContext()],
})

router.get('/users/:id', async () => {
  // Access context from anywhere in the async call stack
  let context = getContext()
  let userId = context.params.id

  return new Response(`User ${userId}`)
})
```

Note: This middleware requires support for `node:async_hooks`.

## Related Packages

- [`fetch-router`](https://github.com/remix-run/remix/tree/main/packages/fetch-router) - Router for the web Fetch API

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
