# node-fetch-server

Build Node.js servers with web-standard Fetch API primitives. `node-fetch-server` converts Node's HTTP server interfaces into [`Request`](https://developer.mozilla.org/en-US/docs/Web/API/Request)/[`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response) flows that match modern runtimes.

## Features

- **Web Standards** - Standard [`Request`](https://developer.mozilla.org/en-US/docs/Web/API/Request) and [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response) APIs
- **Node.js HTTP Integration** - Works directly with `node:http`, `node:https`, and `node:http2`
- **Streaming Support** - Response support with `ReadableStream`
- **Custom Hostname** - Configuration for deployment flexibility
- **Client Info** - Access to client connection info (IP address, port)
- **TypeScript** - Full TypeScript support with type definitions

## Installation

```sh
npm i remix
```

## Usage

Use `createRequestListener()` when you want to plug a fetch handler into a standard Node.js server:

```ts
import * as http from 'node:http'
import { createRequestListener } from 'remix/node-fetch-server'

async function handler(request: Request) {
  let url = new URL(request.url)

  if (url.pathname === '/' && request.method === 'GET') {
    return new Response('Welcome to the User API! Try GET /api/users')
  }

  if (url.pathname === '/api/users' && request.method === 'GET') {
    return Response.json([
      { id: '1', name: 'Alice', email: 'alice@example.com' },
      { id: '2', name: 'Bob', email: 'bob@example.com' },
    ])
  }

  return new Response('Not Found', { status: 404 })
}

let server = http.createServer(createRequestListener(handler))

server.listen(3000, () => {
  console.log('Server running at http://localhost:3000')
})
```

### Working with Request Data

Handle different types of request data using standard web APIs:

```ts
async function handler(request: Request) {
  let url = new URL(request.url)

  // Handle JSON data
  if (request.method === 'POST' && url.pathname === '/api/users') {
    try {
      let userData = await request.json()

      // Validate required fields
      if (!userData.name || !userData.email) {
        return Response.json({ error: 'Name and email are required' }, { status: 400 })
      }

      // Create user (your implementation)
      let newUser = {
        id: Date.now().toString(),
        ...userData,
      }

      return Response.json(newUser, { status: 201 })
    } catch (error) {
      return Response.json({ error: 'Invalid JSON' }, { status: 400 })
    }
  }

  // Handle URL search params
  if (url.pathname === '/api/search') {
    let query = url.searchParams.get('q')
    let limit = parseInt(url.searchParams.get('limit') || '10')

    return Response.json({
      query,
      limit,
      results: [], // Your search results here
    })
  }

  return new Response('Not Found', { status: 404 })
}
```

### Streaming Responses

Take advantage of web-standard streaming with `ReadableStream`:

```ts
async function handler(request: Request) {
  if (request.url.endsWith('/stream')) {
    // Create a streaming response
    let stream = new ReadableStream({
      async start(controller) {
        for (let i = 0; i < 5; i++) {
          controller.enqueue(new TextEncoder().encode(`Chunk ${i}\n`))
          await new Promise((resolve) => setTimeout(resolve, 1000))
        }
        controller.close()
      },
    })

    return new Response(stream, {
      headers: { 'Content-Type': 'text/plain' },
    })
  }

  return new Response('Not Found', { status: 404 })
}
```

### Custom Hostname Configuration

Configure custom hostnames for deployment on VPS or custom environments. `node-fetch-server` uses
the `host` option when constructing `request.url`.

```ts
import * as http from 'node:http'
import { createRequestListener } from 'remix/node-fetch-server'

let hostname = process.env.HOST || 'api.example.com'

async function handler(request: Request) {
  console.log(request.url) // http://api.example.com/path

  return Response.json({
    message: 'Hello from custom domain!',
    url: request.url,
  })
}

let server = http.createServer(createRequestListener(handler, { host: hostname }))

server.listen(3000)
```

### Accessing Client Information

Get client connection details (IP address, port) for logging or security:

```ts
import { type FetchHandler } from 'remix/node-fetch-server'

let handler: FetchHandler = async (request, client) => {
  // Log client information
  console.log(`Request from ${client.address}:${client.port}`)

  // Use for rate limiting, geolocation, etc.
  if (isRateLimited(client.address)) {
    return new Response('Too Many Requests', { status: 429 })
  }

  return Response.json({
    message: 'Hello!',
    yourIp: client.address,
  })
}
```

### HTTPS Support

Use with Node.js HTTPS module for secure connections:

```ts
import * as https from 'node:https'
import * as fs from 'node:fs'
import { createRequestListener } from 'remix/node-fetch-server'

let options = {
  key: fs.readFileSync('private-key.pem'),
  cert: fs.readFileSync('certificate.pem'),
}

let server = https.createServer(options, createRequestListener(handler))

server.listen(443, () => {
  console.log('HTTPS Server running on port 443')
})
```

## Advanced Usage

### Low-level API

For more control over request/response handling, use the low-level API:

```ts
import * as http from 'node:http'
import { createRequest, sendResponse } from 'remix/node-fetch-server'

let server = http.createServer(async (req, res) => {
  // Convert Node.js request to Fetch API Request
  let request = createRequest(req, res, { host: process.env.HOST })

  try {
    // Add custom headers or middleware logic
    let startTime = Date.now()

    // Process the request with your handler
    let response = await handler(request)
    // Make sure the response is mutable
    response = new Response(response.body, response)

    // Add response timing header
    let duration = Date.now() - startTime
    response.headers.set('X-Response-Time', `${duration}ms`)

    // Send the response
    await sendResponse(res, response)
  } catch (error) {
    console.error('Server error:', error)
    res.writeHead(500, { 'Content-Type': 'text/plain' })
    res.end('Internal Server Error')
  }
})

server.listen(3000)
```

The low-level API provides:

- `createRequest(req, res, options)` - Converts Node.js IncomingMessage to web Request
- `sendResponse(res, response)` - Sends web Response using Node.js ServerResponse

This is useful for:

- Building custom middleware systems
- Integrating with existing Node.js code
- Implementing custom error handling
- Performance-critical applications

## Migration from Express

Transitioning from Express? Here's a comparison of common patterns:

### Basic Routing

```ts
// Express
let app = express()

app.get('/users/:id', async (req, res) => {
  let user = await db.getUser(req.params.id)
  if (!user) {
    return res.status(404).json({ error: 'User not found' })
  }
  res.json(user)
})

app.listen(3000)

// node-fetch-server
import { createRequestListener } from 'remix/node-fetch-server'

async function handler(request: Request) {
  let url = new URL(request.url)
  let match = url.pathname.match(/^\/users\/(\w+)$/)

  if (match && request.method === 'GET') {
    let user = await db.getUser(match[1])
    if (!user) {
      return Response.json({ error: 'User not found' }, { status: 404 })
    }
    return Response.json(user)
  }

  return new Response('Not Found', { status: 404 })
}

http.createServer(createRequestListener(handler)).listen(3000)
```

## Demos

The [`demos` directory](https://github.com/remix-run/remix/tree/main/packages/node-fetch-server/demos) contains working demos:

- [`demos/http2`](https://github.com/remix-run/remix/tree/main/packages/node-fetch-server/demos/http2) - HTTP/2 server with TLS certificates

## Related Packages

- [`node-serve`](https://github.com/remix-run/remix/tree/main/packages/node-serve) - Run Fetch API handlers on a managed uWebSockets.js server for high-throughput Node.js deployments
- [`fetch-proxy`](https://github.com/remix-run/remix/tree/main/packages/fetch-proxy) - Build HTTP proxy servers using the web fetch API

## Benchmarks

Run the full benchmark suite:

```sh
pnpm run bench
```

Update the benchmark results below:

```sh
pnpm run bench:update-readme
```

<!-- benchmarks:start -->

Last updated: 2026-04-29T17:19:30.407Z

Environment: Darwin 25.3.0, Apple M1 Pro, Node.js v24.15.0

Command: `wrk -t12 -c400 -d30s`

### Raw Throughput

Simple HTML response benchmarks without inspecting the incoming request.

| Server                    |   Version | Requests/sec | Avg latency | Transfer/sec |
| ------------------------- | --------: | -----------: | ----------: | -----------: |
| `remix/node-serve`        |   `0.0.0` |  `62,224.72` |    `6.45ms` |     `9.85MB` |
| `node:http`               | `24.15.0` |  `47,110.35` |   `10.66ms` |     `9.66MB` |
| `remix/node-fetch-server` |  `0.13.0` |  `43,317.24` |   `11.69ms` |     `8.80MB` |
| `express`                 |   `5.2.1` |  `39,751.90` |   `13.69ms` |     `9.59MB` |

### Small Body

POST benchmarks that read and print the request method, headers, and a small body.

| Server                    |   Version | Requests/sec | Avg latency | Transfer/sec |
| ------------------------- | --------: | -----------: | ----------: | -----------: |
| `remix/node-serve`        |   `0.0.0` |  `31,212.82` |   `12.75ms` |     `4.94MB` |
| `remix/node-fetch-server` |  `0.13.0` |  `25,430.33` |   `24.25ms` |     `5.17MB` |
| `node:http`               | `24.15.0` |  `25,087.56` |   `23.89ms` |     `5.14MB` |
| `express`                 |   `5.2.1` |  `22,845.31` |   `27.16ms` |     `5.51MB` |

### Large Body

POST benchmarks that read and print the request method, headers, and a 1 MB body.

| Server                    |   Version | Requests/sec | Avg latency | Transfer/sec |
| ------------------------- | --------: | -----------: | ----------: | -----------: |
| `remix/node-serve`        |   `0.0.0` |   `1,147.54` |  `327.72ms` |   `186.03KB` |
| `remix/node-fetch-server` |  `0.13.0` |   `1,085.87` |  `217.69ms` |   `225.87KB` |
| `node:http`               | `24.15.0` |   `1,078.96` |  `198.67ms` |   `226.54KB` |
| `express`                 |   `5.2.1` |   `1,022.02` |  `216.07ms` |   `252.51KB` |

<!-- benchmarks:end -->

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
