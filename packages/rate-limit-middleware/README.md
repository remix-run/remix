# rate-limit-middleware

Fixed-window rate limiting middleware for Remix Fetch API servers. It uses explicit client keys and named policies, supports atomic shared stores, and emits current `RateLimit` response fields.

## Features

- **Explicit Identity** - Applications choose a stable client key from authenticated or trusted server data
- **Named Policies** - Compose global, route, and user limits without store-key or response-field collisions
- **Atomic Stores** - Use the included single-process memory store or provide a shared store
- **Standard Response Fields** - Emit named `RateLimit`, `RateLimit-Policy`, and `Retry-After` values
- **Custom Rejections** - Return application-specific bodies while preserving status and rate limit fields

## Installation

```sh
npm i remix
```

## Usage

Install the middleware after the middleware that establishes the identity used by `key`. This example assumes `ClientId` was populated by authentication middleware earlier in the stack.

```ts
import { createContextKey, createRouter } from 'remix/router'
import { memoryStore, rateLimit } from 'remix/middleware/rate-limit'

let ClientId = createContextKey<string>()

let router = createRouter({
  middleware: [
    authenticateClient({ contextKey: ClientId }),
    rateLimit({
      name: 'api',
      limit: 100,
      window: 60_000,
      key(context) {
        let clientId = context.get(ClientId)
        if (clientId == null) throw new Error('Expected an authenticated client')
        return clientId
      },
      store: memoryStore(),
    }),
  ],
})

router.get('/api/projects', () => Response.json([{ id: 'p1', name: 'Remix' }]))
```

The first request includes the named policy and its current state:

```http
RateLimit-Policy: "api";q=100;w=60
RateLimit: "api";r=99;t=60
```

Request 101 is rejected before route handling and includes `Retry-After`:

```http
HTTP/1.1 429 Too Many Requests
RateLimit-Policy: "api";q=100;w=60
RateLimit: "api";r=0;t=42
Retry-After: 42
```

## Client Keys

`key` is required because a Fetch `Request` does not expose a trusted client address. Return a stable, non-secret identifier derived from authenticated identity or trusted server data. Keys must contain between 1 and 1,024 characters.

Do not use a raw authorization header, cookie, user agent, or untrusted forwarding header. Attackers can rotate those values to bypass limits, while shared values can cause unrelated clients to consume the same quota.

## Named Policies

Policy names namespace store buckets and allow multiple limiters to compose. Names start with a letter and contain at most 64 letters, numbers, dots, underscores, or dashes.

```ts
let store = memoryStore()

let router = createRouter({
  middleware: [
    rateLimit({
      name: 'global',
      limit: 1_000,
      window: 60_000,
      key: getClientId,
      store,
    }),
    rateLimit({
      name: 'expensive-route',
      limit: 10,
      window: 60_000,
      key: getClientId,
      store,
    }),
  ],
})
```

Each policy is counted independently and appended to the response fields.

## Custom Limit Responses

Use `onLimitExceeded` for JSON or another application-specific body. The middleware normalizes the status to `429` and adds the policy fields and `Retry-After`.

```ts
rateLimit({
  name: 'api',
  limit: 100,
  window: 60_000,
  key: getClientId,
  store,
  onLimitExceeded(_context, state) {
    return Response.json({
      error: 'rate_limit_exceeded',
      policy: state.name,
      retryAfter: state.retryAfter,
    })
  },
})
```

## Stores

`memoryStore()` uses generational maps so increments do not scan all client buckets. It is suitable for tests, local development, and deliberate single-process deployments. It does not coordinate limits across processes or hosts and should not be mistaken for denial-of-service protection.

Production deployments with multiple processes or hosts should provide a shared store whose `increment()` operation creates or increments the window atomically:

```ts
import type { RateLimitStore } from 'remix/middleware/rate-limit'

let store: RateLimitStore = {
  async increment({ name, key, window }) {
    return redisIncrementFixedWindow({
      key: `rate-limit:${name}:${key}`,
      window,
    })
  },
}
```

The store returns a positive safe-integer `count` and a positive safe-integer `resetAt` Unix timestamp in milliseconds. Store failures propagate so applications do not silently bypass limits.

## Related Packages

- [`fetch-router`](https://github.com/remix-run/remix/tree/main/packages/fetch-router) - Router and typed middleware context
- [`auth-middleware`](https://github.com/remix-run/remix/tree/main/packages/auth-middleware) - Authenticated request identity
- [`node-fetch-server`](https://github.com/remix-run/remix/tree/main/packages/node-fetch-server) - Node.js server adapter with trusted client address information

## Related Work

- [IETF RateLimit header fields](https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-ratelimit-headers)

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
