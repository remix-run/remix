# node-fetch-server

Build Node.js servers with web-standard Fetch API primitives. `node-fetch-server` converts Node's HTTP server interfaces into [`Request`](https://developer.mozilla.org/en-US/docs/Web/API/Request)/[`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response) flows that match modern runtimes.

## Features

- **Web Standards** - Standard [`Request`](https://developer.mozilla.org/en-US/docs/Web/API/Request) and [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response) APIs
- **Drop-in Integration** - Works with `node:http` and `node:https` modules
- **Streaming Support** - Response support with `ReadableStream`
- **Custom Hostname** - Configuration for deployment flexibility
- **Client Info** - Access to client connection info (IP address, port)
- **TypeScript** - Full TypeScript support with type definitions

## Installation

```sh
npm i remix
```

## Quick Start

### Basic Server

Here's a complete working example with a simple in-memory data store:

```ts
import * as http from 'node:http'
import { createRequestListener } from 'remix/node-fetch-server'

// Example: Simple in-memory user storage
let users = new Map([
  ['1', { id: '1', name: 'Alice', email: 'alice@example.com' }],
  ['2', { id: '2', name: 'Bob', email: 'bob@example.com' }],
])

async function handler(request: Request) {
  let url = new URL(request.url)

  // GET / - Home page
  if (url.pathname === '/' && request.method === 'GET') {
    return new Response('Welcome to the User API! Try GET /api/users')
  }

  // GET /api/users - List all users
  if (url.pathname === '/api/users' && request.method === 'GET') {
    return Response.json(Array.from(users.values()))
  }

  // GET /api/users/:id - Get specific user
  let userMatch = url.pathname.match(/^\/api\/users\/(\w+)$/)
  if (userMatch && request.method === 'GET') {
    let user = users.get(userMatch[1])
    if (user) {
      return Response.json(user)
    }
    return new Response('User not found', { status: 404 })
  }

  return new Response('Not Found', { status: 404 })
}

// Create a standard Node.js server
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

Configure custom hostnames for deployment on VPS or custom environments:

```ts
import * as http from 'node:http'
import { createRequestListener } from 'remix/node-fetch-server'

// Use a custom hostname (e.g., from environment variable)
let hostname = process.env.HOST || 'api.example.com'

async function handler(request: Request) {
  // request.url will now use your custom hostname
  console.log(request.url) // https://api.example.com/path

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

## Benchmark

To run benchmarks comparing `node-fetch-server` performance with comparable libraries:

```sh
pnpm run bench
```

## Related Packages

- [`fetch-proxy`](https://github.com/remix-run/remix/tree/main/packages/fetch-proxy) - Build HTTP proxy servers using the web fetch API

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
