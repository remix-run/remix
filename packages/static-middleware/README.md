# static-middleware

Middleware for serving static files from the filesystem for use with [`@remix-run/fetch-router`](https://github.com/remix-run/remix/tree/main/packages/fetch-router).

Serves static files from a directory with support for ETags, range requests, and conditional requests.

## Features

- [ETag support](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/ETag) (weak and strong)
- [Range request support](https://developer.mozilla.org/en-US/docs/Web/HTTP/Range_requests) (HTTP 206 Partial Content)
- [Conditional request support](https://developer.mozilla.org/en-US/docs/Web/HTTP/Conditional_requests) (If-None-Match, If-Modified-Since)
- Path traversal protection
- Automatic fall through to next middleware/handler if file not found

## Installation

```sh
npm install @remix-run/static-middleware
```

## Usage

Static middleware is useful for serving static files from a directory.

```ts
import { createRouter } from '@remix-run/fetch-router'
import { staticFiles } from '@remix-run/static-middleware'

let router = createRouter({
  middleware: [staticFiles('./public')],
})

router.get('/', () => new Response('Home'))
```

### With Cache Control

```ts
let router = createRouter({
  middleware: [
    staticFiles('./public', {
      cacheControl: 'public, max-age=31536000, immutable', // 1 year
    }),
  ],
})
```

### Filter Files

```ts
let router = createRouter({
  middleware: [
    staticFiles('./public', {
      filter(path) {
        // Don't serve hidden files
        return !path.startsWith('.')
      },
    }),
  ],
})
```

### Multiple Directories

```ts
let router = createRouter({
  middleware: [
    staticFiles('./public'),
    staticFiles('./assets', {
      cacheControl: 'public, max-age=31536000',
    }),
  ],
})
```

## Security

- Prevents path traversal attacks (e.g., `../../../etc/passwd`)
- Only serves files with GET and HEAD requests
- Respects the configured root directory boundary

## Related Packages

- [`fetch-router`](https://github.com/remix-run/remix/tree/main/packages/fetch-router) - Router for the web Fetch API
- [`lazy-file`](https://github.com/remix-run/remix/tree/main/packages/lazy-file) - Used internally for streaming file contents

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
