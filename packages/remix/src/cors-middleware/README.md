# cors-middleware

CORS middleware for Remix. It adds standard CORS response headers to Fetch API servers and can either short-circuit preflight requests or pass them through to app-defined `OPTIONS` handlers.

## Features

- **Preflight Handling** - Automatically handles `OPTIONS` preflight requests
- **Flexible Origin Rules** - Supports static, regex, list, and function-based origin policies
- **Credential Support** - Supports credentialed requests with spec-safe origin reflection
- **Header Controls** - Configure allowed and exposed headers, preflight methods, and max age
- **Private Network Support** - Optionally allow private network preflight requests

## Installation

```sh
npm i remix
```

## Usage

```ts
import { createRouter } from 'remix/fetch-router'
import { cors } from 'remix/cors-middleware'

let router = createRouter({
  middleware: [
    cors({
      origin: ['https://app.example.com', 'https://admin.example.com'],
      credentials: true,
      exposedHeaders: ['X-Request-Id'],
    }),
  ],
})

router.get('/api/projects', () => {
  return Response.json([{ id: 'p1', name: 'Remix' }], {
    headers: {
      'X-Request-Id': 'req_123',
    },
  })
})
```

## Origin Policies

`origin` supports:

- `'*'` to allow all origins
- `string` for a single exact origin
- `RegExp` for pattern-based matching
- `Array<string | RegExp>` for multiple exact and pattern matches
- `true` to reflect the request origin
- `(origin, context) => boolean | string` for dynamic policies

### Restrict Origins

```ts
let router = createRouter({
  middleware: [
    cors({
      origin: ['https://app.example.com', 'https://admin.example.com'],
      credentials: true,
    }),
  ],
})
```

### Dynamic Origin Policies

```ts
let router = createRouter({
  middleware: [
    cors({
      origin(origin, context) {
        if (context.url.pathname.startsWith('/public/')) {
          return '*'
        }

        return origin.endsWith('.trusted.example')
      },
    }),
  ],
})
```

## Preflight Behavior

By default, preflight requests are short-circuited with status `204`.

```ts
let router = createRouter({
  middleware: [
    cors({
      methods: ['GET', 'POST', 'PATCH'],
      allowedHeaders: ['Authorization', 'Content-Type'],
      maxAge: 600,
    }),
  ],
})
```

Use a function-based `allowedHeaders` policy when the header allowlist depends on the request:

```ts
let router = createRouter({
  middleware: [
    cors({
      allowedHeaders(request) {
        let requestedHeaders = request.headers.get('Access-Control-Request-Headers')

        if (requestedHeaders?.includes('x-admin-token')) {
          return ['Authorization', 'Content-Type', 'X-Admin-Token']
        }

        return ['Authorization', 'Content-Type']
      },
    }),
  ],
})
```

Function-based `allowedHeaders` responses vary on `Access-Control-Request-Headers`, so caches do not reuse a preflight response for a different requested-header set.

Set `preflightContinue: true` to let downstream handlers process preflight requests. Use `preflightStatusCode` when you want short-circuited preflight responses to return a status other than `204`.

## Private Network Preflights

```ts
let router = createRouter({
  middleware: [
    cors({
      allowPrivateNetwork: true,
    }),
  ],
})
```

When `allowPrivateNetwork` is enabled, the middleware adds `Access-Control-Allow-Private-Network: true` for preflight requests that ask for private network access.

## Expose Response Headers

```ts
let router = createRouter({
  middleware: [
    cors({
      exposedHeaders: ['X-Request-Id', 'X-Trace-Id'],
    }),
  ],
})
```

## Caveats

- CORS is primarily a browser enforcement mechanism. Disallowed non-preflight requests still reach your handlers unless you add separate request validation.
- When `credentials: true` is used with `origin: '*'`, the middleware reflects the request origin and adds `Vary: Origin` so the response stays cache-safe.
- When `allowedHeaders` is a function, preflight responses vary on `Access-Control-Request-Headers` so caches do not reuse a response for a different requested-header set.
- `preflightContinue` and `preflightStatusCode` only affect how preflight `OPTIONS` requests are handled. They do not change actual request authorization.

## Related Packages

- [`cop-middleware`](https://github.com/remix-run/remix/tree/main/packages/cop-middleware) - Browser-origin protection middleware for unsafe cross-origin requests
- [`fetch-router`](https://github.com/remix-run/remix/tree/main/packages/fetch-router) - Router for the web Fetch API
- [`headers`](https://github.com/remix-run/remix/tree/main/packages/headers) - Typed HTTP header utilities

## Related Work

- [MDN: Cross-Origin Resource Sharing (CORS)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [Fetch Standard: CORS protocol](https://fetch.spec.whatwg.org/#http-cors-protocol)
- [expressjs/cors](https://github.com/expressjs/cors)
- [rack-cors](https://github.com/cyu/rack-cors)

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
