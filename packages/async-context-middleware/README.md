# async-context-middleware

Middleware for storing request context in `AsyncLocalStorage` for use with [`@remix-run/fetch-router`](https://github.com/remix-run/remix/tree/main/packages/fetch-router).

This middleware stores the request context in [`AsyncLocalStorage`](https://nodejs.org/api/async_context.html#class-asynclocalstorage) (using `node:async_hooks`), making it available to all functions in the same async execution context.

## Installation

```sh
npm install @remix-run/async-context-middleware
```

## Usage

Simply use the `asyncContext()` middleware at the router level to make the request context available to all functions in the same async execution context. Get access to the context using the `getContext()` function.

```ts
import { createRouter } from '@remix-run/fetch-router'
import { asyncContext, getContext } from '@remix-run/async-context-middleware'

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
