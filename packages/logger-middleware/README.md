# logger-middleware

HTTP request/response logging middleware for Remix. It logs request metadata and response details with configurable output formats, and exposes the configured log function on request context.

## Features

- **Request/Response Logging** - Logs method, path, status, and response metadata
- **Context Logger** - Exposes `context.logger` (or `context.get(Logger)`)
- **Token-Based Formatting** - Customize log output with built-in placeholders
- **Structured Logging** - Serialize typed request and response data as JSON
- **Request Timing** - Includes request duration and timestamps
- **Colorized Output** - Highlights method, status, duration, and content length in TTY output

## Installation

```sh
npm i remix
```

## Usage

```ts
import { createRouter } from 'remix/router'
import { logger } from 'remix/middleware/logger'

let router = createRouter({
  middleware: [logger()],
})

router.get('/users/:id', (context) => {
  context.logger(`Loading user ${context.params.id}`)
  return Response.json(loadUser(context.params.id))
})

// Logs: [19/Nov/2025:14:32:10 -0800] GET /users/123 200 1234
```

Use `context.logger(message)` (or `context.get(Logger)(message)`) for app logs that should use the configured logger.

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

### Colorized Output

Logger output automatically uses ANSI colors for high-signal tokens when terminal color detection allows them. Set `colors` to `false` to disable colorized output or `true` to force it on. When the `process` global is defined, color detection respects `CI`, `NO_COLOR`, `FORCE_COLOR`, `TERM=dumb`, and TTY output streams.

```ts
let router = createRouter({
  middleware: [
    logger({
      colors: false,
    }),
  ],
})
```

The following tokens are colorized when colors are enabled:

- `%method`
- `%status`
- `%duration`
- `%contentLength`

### Structured Logs

Pass a formatter function to serialize request and response fields as JSON. The formatter receives the Web API `Request` and `Response`, start and end times, and the duration in milliseconds.

```ts
let router = createRouter({
  middleware: [
    logger({
      format({ request, response, start, duration }) {
        let url = new URL(request.url)

        return JSON.stringify({
          timestamp: start.toISOString(),
          method: request.method,
          path: url.pathname + url.search,
          status: response.status,
          duration,
          contentType: response.headers.get('Content-Type'),
        })
      },
    }),
  ],
})
// Logs: {"timestamp":"2025-11-19T22:32:10.000Z","method":"GET","path":"/users/123","status":200,"duration":42,"contentType":"application/json"}
```

The resulting JSON line can be collected by structured logging systems. Use the `log` option to send it to a file, stream, or logging service.

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
