# cors-middleware

CORS middleware for Remix. It handles simple CORS responses and preflight requests with flexible origin and header policies.

## Features

- **Preflight Handling** - Automatically handles `OPTIONS` preflight requests
- **Flexible Origin Rules** - Supports static, regex, list, and function-based origin policies
- **Credential Support** - Supports credentialed requests with spec-safe origin reflection
- **Header Controls** - Configure allowed/exposed headers and preflight max age

## Installation

```sh
npm i remix
```

## Usage

```ts
import { createRouter } from 'remix/fetch-router'
import { cors } from 'remix/cors-middleware'

let router = createRouter({
  middleware: [cors()],
})
```

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

`origin` supports:

- `'*'` (allow all)
- `string` (single allowed origin)
- `RegExp`
- `Array<string | RegExp>`
- `true` (reflect request origin)
- `(origin, context) => boolean | string` for dynamic policies

### Preflight Behavior

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

Set `preflightContinue: true` to let downstream handlers process preflight requests.

### Expose Response Headers

```ts
let router = createRouter({
  middleware: [
    cors({
      exposedHeaders: ['X-Request-Id', 'X-Trace-Id'],
    }),
  ],
})
```

## Related Packages

- [`fetch-router`](https://github.com/remix-run/remix/tree/main/packages/fetch-router) - Router for the web Fetch API
- [`headers`](https://github.com/remix-run/remix/tree/main/packages/headers) - Typed HTTP header utilities

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
