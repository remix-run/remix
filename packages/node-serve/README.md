# node-serve

Build high-performance Node.js servers with web-standard Fetch API primitives. Use this package when you want Remix-style `Request`/`Response` handlers with a managed server optimized for production throughput.

## Features

- **Fetch API Handlers**: Serve standard [`Request`](https://developer.mozilla.org/en-US/docs/Web/API/Request) to [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response) request handlers
- **High-Performance Node.js Server**: Start a fast managed server for Fetch API application code
- **HTTPS Support**: Start a TLS server with certificate and key file paths
- **Managed Server Lifecycle**: Start a server with `serve()`, wait for `server.ready`, and close it with `server.close()`
- **Custom Hostname**: Override the host and protocol used to construct incoming `request.url` values
- **Client Info**: Access client IP address, address family, and remote port when your handler accepts a second argument
- **Existing uWebSockets.js App Adapter**: Use `createUwsRequestHandler()` when you already own a uWebSockets.js app

## Installation

```sh
npm i remix
```

`node-serve` includes a native high-performance transport as an optional dependency. Standard installs include optional dependencies; if your install disables them, enable optional dependencies before using `remix/node-serve`.

## Usage

Use `serve()` to start a Node.js server that calls your fetch handler for every incoming request:

```ts
import { serve } from 'remix/node-serve'

let users = new Map([
  ['1', { id: '1', name: 'Alice', email: 'alice@example.com' }],
  ['2', { id: '2', name: 'Bob', email: 'bob@example.com' }],
])

async function handler(request: Request) {
  let url = new URL(request.url)

  if (url.pathname === '/' && request.method === 'GET') {
    return new Response('Welcome to the User API! Try GET /api/users')
  }

  if (url.pathname === '/api/users' && request.method === 'GET') {
    return Response.json(Array.from(users.values()))
  }

  let userMatch = url.pathname.match(/^\/api\/users\/(\w+)$/)
  if (userMatch && request.method === 'GET') {
    let user = users.get(userMatch[1])
    if (user) return Response.json(user)
    return new Response('User not found', { status: 404 })
  }

  return new Response('Not Found', { status: 404 })
}

let server = serve(handler, { port: 3000 })

await server.ready
console.log(`Server running at http://localhost:${server.port}`)
```

### Custom Request URLs

Use `host` and `protocol` when your server runs behind a proxy or load balancer and you need stable incoming request URLs:

```ts
import { serve } from 'remix/node-serve'

let server = serve(handler, {
  host: process.env.HOST ?? 'api.example.com',
  protocol: 'https:',
  port: 3000,
})

await server.ready
```

### HTTPS

Pass `tls` options to start an HTTPS server. `keyFile` and `certFile` are file paths, not PEM contents:

```ts
import { serve } from 'remix/node-serve'

let server = serve(handler, {
  port: 443,
  tls: {
    keyFile: './certs/server.key',
    certFile: './certs/server.crt',
  },
})

await server.ready
console.log(`Server running at https://localhost:${server.port}`)
```

When `tls` is present, `request.url` defaults to the `https:` protocol. You can still set `protocol` explicitly when the public URL differs from the local server transport.

### Client Information

Handlers that accept a second argument receive the remote client address:

```ts
import { type FetchHandler, serve } from 'remix/node-serve'

let handler: FetchHandler = async (request, client) => {
  console.log(`Request from ${client.address}:${client.port}`)

  return Response.json({
    path: new URL(request.url).pathname,
    clientAddress: client.address,
  })
}

serve(handler, { port: 3000 })
```

### Existing uWebSockets.js Apps

Most apps should use `serve()`. Use `createUwsRequestHandler()` when you already have a uWebSockets.js app and want only part of the app to use a Fetch API handler:

This example assumes `uWebSockets.js` is also a direct dependency of your app.

```ts
import { App } from 'uWebSockets.js'
import { createUwsRequestHandler } from 'remix/node-serve'

let app = App()

async function handler(request: Request) {
  let url = new URL(request.url)
  return Response.json({ path: url.pathname })
}

app.get('/health', (res) => {
  res.end('ok')
})

app.any('/api/*', createUwsRequestHandler(handler))

app.listen(3000, (socket) => {
  if (!socket) throw new Error('Could not listen on port 3000')
})
```

For HTTPS with an existing uWebSockets.js app, create the SSL app yourself and pass `protocol: 'https:'` when you create the request handler:

```ts
import { SSLApp } from 'uWebSockets.js'
import { createUwsRequestHandler } from 'remix/node-serve'

let app = SSLApp({
  key_file_name: './certs/server.key',
  cert_file_name: './certs/server.crt',
})

app.any('/*', createUwsRequestHandler(handler, { protocol: 'https:' }))
app.listen(443, (socket) => {
  if (!socket) throw new Error('Could not listen on port 443')
})
```

## Related Packages

- [`node-fetch-server`](https://github.com/remix-run/remix/tree/main/packages/node-fetch-server) - Adapt Fetch API handlers to existing `node:http`, `node:https`, and `node:http2` servers
- [`fetch-router`](https://github.com/remix-run/remix/tree/main/packages/fetch-router) - Route incoming `Request` objects to Fetch API handlers

## Related Work

- [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) - Web standard `Request` and `Response` primitives

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
