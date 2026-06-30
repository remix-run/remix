# rate-limit-middleware

Rate limiting middleware for Remix Fetch API servers. It limits requests with a pluggable fixed-window store, exposes the current limit state on request context, and emits standard `RateLimit` response headers.

## Features

- **Fixed-Window Limits** - Count requests per key in a time window
- **Standard Headers** - Adds `RateLimit`, `RateLimit-Policy`, and `Retry-After` when blocked
- **Context Integration** - Exposes `context.rateLimit` (or `context.get(RateLimit)`)
- **Custom Keys** - Limit by user, token, client address, route, or any request-derived value
- **Pluggable Store** - Includes an in-memory store and a small adapter interface for shared stores

## Installation

```sh
npm i remix @remix-run/rate-limit-middleware
```

## Usage

```ts
import { createRouter } from 'remix/router'
import { rateLimit } from '@remix-run/rate-limit-middleware'

let router = createRouter({
  middleware: [
    rateLimit({
      limit: 100,
      window: 60_000,
      key: (context) => context.headers.get('Authorization') ?? 'anonymous',
    }),
  ],
})

router.get('/api/users/:id', (context) => {
  return Response.json({
    id: context.params.id,
    remaining: context.rateLimit.remaining,
  })
})
```

Under-limit responses pass through and include the standard headers:

```http
RateLimit: limit=100, remaining=99, reset=60
RateLimit-Policy: 100;w=60
```

Over-limit requests short-circuit with `429 Too Many Requests` and include `Retry-After`:

```http
HTTP/1.1 429 Too Many Requests
RateLimit: limit=100, remaining=0, reset=42
RateLimit-Policy: 100;w=60
Retry-After: 42
```

### Request Keys

Use `key` to decide which requests share a bucket. For authenticated APIs, a user ID or token subject is usually a better key than a raw header value:

```ts
let router = createRouter({
  middleware: [
    rateLimit({
      limit: 1_000,
      window: 60_000,
      key: async (context) => {
        let user = await getUser(context.request)
        return user ? `user:${user.id}` : 'anonymous'
      },
    }),
  ],
})
```

The default key uses request identity headers when present and falls back to the request origin. Fetch `Request` objects do not include a remote address, so apps that need IP-based limits should pass a custom key from trusted server data. For `remix/node-fetch-server`, enable `trustProxy` only behind a trusted reverse proxy before using forwarded client addresses.

### Custom Limit Responses

Use `onLimitExceeded` to return a JSON response or other app-specific body:

```ts
let router = createRouter({
  middleware: [
    rateLimit({
      limit: 20,
      window: 60_000,
      onLimitExceeded(context, rateLimit) {
        return Response.json({
          error: 'rate_limit_exceeded',
          retryAfter: rateLimit.reset,
        })
      },
    }),
  ],
})
```

The middleware sends custom over-limit responses with status `429` and still adds `RateLimit`, `RateLimit-Policy`, and `Retry-After` headers.

### Custom Stores

`memoryStore()` is useful for one-process servers, tests, and local development. Production systems with multiple server processes should provide a shared store:

```ts
import { type RateLimitStore, rateLimit } from '@remix-run/rate-limit-middleware'

let store: RateLimitStore = {
  async increment(key, window) {
    let result = await redisIncrementFixedWindow(key, window)

    return {
      count: result.count,
      resetAt: result.resetAt,
    }
  },
  async reset(key) {
    await redisDelete(key)
  },
}

let router = createRouter({
  middleware: [
    rateLimit({
      limit: 100,
      store,
      window: 60_000,
    }),
  ],
})
```

Stores should increment a bucket atomically and return the updated count plus the Unix epoch timestamp in milliseconds when the current window resets.

## Related Packages

- [`fetch-router`](https://github.com/remix-run/remix/tree/main/packages/fetch-router) - Router for the web Fetch API
- [`logger-middleware`](https://github.com/remix-run/remix/tree/main/packages/logger-middleware) - HTTP request/response logging middleware
- [`node-fetch-server`](https://github.com/remix-run/remix/tree/main/packages/node-fetch-server) - Node.js server adapter with trusted proxy client address support

## Related Work

- [IETF RateLimit header fields](https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-ratelimit-headers)

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
