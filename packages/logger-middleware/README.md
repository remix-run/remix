# logger-middleware

HTTP request/response logging middleware for Remix. It logs request metadata and response details with configurable output formats.

## Features

- **Request/Response Logging** - Logs method, path, status, and response metadata
- **Token-Based Formatting** - Customize log output with built-in placeholders
- **Structured Timing Data** - Includes request duration and timestamps

## Installation

```sh
npm i remix
```

## Usage

```ts
import { createRouter } from 'remix/fetch-router'
import { logger } from 'remix/logger-middleware'

let router = createRouter({
  middleware: [logger()],
})

// Logs: [19/Nov/2025:14:32:10 -0800] GET /users/123 200 1234
```

### Custom Format

You can use the `format` option to customize the log format. The following tokens are available:

- `%date` - Date and time in Apache/nginx format (dd/Mon/yyyy:HH:mm:ss ±zzzz)
- `%dateISO` - Date and time in ISO format
- `%duration` - Request duration in milliseconds
- `%contentLength` - Response Content-Length header
- `%contentType` - Response Content-Type header
- `%host` - Request URL host
- `%hostname` - Request URL hostname
- `%method` - Request method
- `%path` - Request pathname + search
- `%pathname` - Request pathname
- `%port` - Request port
- `%query` - Request query string (search)
- `%referer` - Request Referer header
- `%search` - Request search string
- `%status` - Response status code
- `%statusText` - Response status text
- `%url` - Full request URL
- `%userAgent` - Request User-Agent header

```ts
let router = createRouter({
  middleware: [
    logger({
      format: '%method %path - %status (%duration ms)',
    }),
  ],
})
// Logs: GET /users/123 - 200 (42 ms)
```

For Apache-style combined log format, you can use the following format:

```ts
let router = createRouter({
  middleware: [
    logger({
      format: '%host - - [%date] "%method %path" %status %contentLength "%referer" "%userAgent"',
    }),
  ],
})
```

### Custom Logger

You can use a custom logger to write logs to a file or other stream.

```ts
import { createWriteStream } from 'node:fs'

let logStream = createWriteStream('access.log', { flags: 'a' })

let router = createRouter({
  middleware: [
    logger({
      log(message) {
        logStream.write(message + '\n')
      },
    }),
  ],
})
```

## Related Packages

- [`fetch-router`](https://github.com/remix-run/remix/tree/main/packages/fetch-router) - Router for the web Fetch API

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
