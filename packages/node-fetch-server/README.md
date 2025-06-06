# node-fetch-server

Build portable Node.js servers using web-standard Fetch API primitives 🚀

`node-fetch-server` brings the simplicity and familiarity of the [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) to Node.js server development. Instead of dealing with Node's traditional `req`/`res` objects, you work with web-standard [`Request`](https://developer.mozilla.org/en-US/docs/Web/API/Request) and [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response) objects—the same APIs you already use in the browser and modern JavaScript runtimes.

## Why node-fetch-server?

- **Write once, run anywhere**: Your server code becomes portable across Node.js, Deno, Bun, Cloudflare Workers, and other platforms
- **Familiar API**: Use the same Request/Response APIs you already know from client-side development
- **Future-proof**: Align with web standards that are here to stay
- **TypeScript-friendly**: Full type safety with standard web APIs
- **Lightweight**: Minimal overhead while providing a cleaner, more intuitive API

The Fetch API is already the standard for server development in:

- [`Bun.serve`](https://bun.sh/docs/api/http#bun-serve)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/runtime-apis/handlers/fetch/)
- [`Deno.serve`](https://docs.deno.com/api/deno/~/Deno.serve)
- [Fastly Compute](https://js-compute-reference-docs.edgecompute.app/docs/)

Now you can use the same pattern in Node.js!

## Features

- ✅ Web-standard [`Request`](https://developer.mozilla.org/en-US/docs/Web/API/Request) and [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response) APIs
- ✅ Drop-in integration with `node:http` and `node:https` modules
- ✅ Streaming response support with `ReadableStream`
- ✅ Custom hostname configuration for deployment flexibility
- ✅ Access to client connection info (IP address, port)
- ✅ Full TypeScript support with type definitions

## Installation

```sh
npm install @mjackson/node-fetch-server
```

## Quick Start

### Basic Server

```ts
import * as http from 'node:http';
import { createRequestListener } from '@mjackson/node-fetch-server';

// Your request handler uses standard Request/Response objects
async function handler(request: Request) {
  let url = new URL(request.url);

  // Route based on pathname
  if (url.pathname === '/') {
    return new Response('Welcome to the home page!');
  }

  if (url.pathname === '/api/users') {
    let users = await getUsers(); // Your async logic here
    return Response.json(users);
  }

  return new Response('Not Found', { status: 404 });
}

// Create a standard Node.js server
let server = http.createServer(createRequestListener(handler));

server.listen(3000, () => {
  console.log('Server running at http://localhost:3000');
});
```

### Working with Request Data

```ts
async function handler(request: Request) {
  // Access request method, headers, and body just like in the browser
  if (request.method === 'POST' && request.url.endsWith('/api/users')) {
    // Parse JSON body
    let userData = await request.json();

    // Validate and process...
    let newUser = await createUser(userData);

    // Return JSON response
    return Response.json(newUser, {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response('Method not allowed', { status: 405 });
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
          controller.enqueue(new TextEncoder().encode(`Chunk ${i}\n`));
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  return new Response('Not Found', { status: 404 });
}
```

### Custom Hostname Configuration

Configure custom hostnames for deployment on VPS or custom environments:

```ts
import * as http from 'node:http';
import { createRequestListener } from '@mjackson/node-fetch-server';

// Use a custom hostname (e.g., from environment variable)
let hostname = process.env.HOST || 'api.example.com';

async function handler(request: Request) {
  // request.url will now use your custom hostname
  console.log(request.url); // https://api.example.com/path

  return Response.json({
    message: 'Hello from custom domain!',
    url: request.url,
  });
}

let server = http.createServer(createRequestListener(handler, { host: hostname }));

server.listen(3000);
```

### Accessing Client Information

Get client connection details (IP address, port) for logging or security:

```ts
import { type FetchHandler } from '@mjackson/node-fetch-server';

let handler: FetchHandler = async (request, client) => {
  // Log client information
  console.log(`Request from ${client.address}:${client.port}`);

  // Use for rate limiting, geolocation, etc.
  if (isRateLimited(client.address)) {
    return new Response('Too Many Requests', { status: 429 });
  }

  return Response.json({
    message: 'Hello!',
    yourIp: client.address,
  });
};
```

### HTTPS Support

Use with Node.js HTTPS module for secure connections:

```ts
import * as https from 'node:https';
import * as fs from 'node:fs';
import { createRequestListener } from '@mjackson/node-fetch-server';

let options = {
  key: fs.readFileSync('private-key.pem'),
  cert: fs.readFileSync('certificate.pem'),
};

let server = https.createServer(options, createRequestListener(handler));

server.listen(443, () => {
  console.log('HTTPS Server running on port 443');
});
```

## Advanced Usage

### Low-level API

For more control over request/response handling, use the low-level API:

```ts
import * as http from 'node:http';
import { createRequest, sendResponse } from '@mjackson/node-fetch-server';

let server = http.createServer(async (req, res) => {
  // Convert Node.js request to Fetch API Request
  let request = createRequest(req, res, { host: process.env.HOST });

  try {
    // Your custom middleware pipeline
    let response = await pipeline(authenticate, authorize, handleRequest)(request);

    // Convert Fetch API Response back to Node.js response
    await sendResponse(res, response);
  } catch (error) {
    console.error('Server error:', error);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Internal Server Error');
  }
});

server.listen(3000);
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

Transitioning from Express? Here's a quick comparison:

```ts
// Express way
app.get('/users/:id', async (req, res) => {
  let user = await getUser(req.params.id);
  res.json(user);
});

// node-fetch-server way
async function handler(request: Request) {
  let url = new URL(request.url);
  let match = url.pathname.match(/^\/users\/(\w+)$/);

  if (match) {
    let user = await getUser(match[1]);
    return Response.json(user);
  }

  return new Response('Not Found', { status: 404 });
}
```

Common patterns:

- `req.body` → `await request.json()`
- `req.params` → Parse from `new URL(request.url).pathname`
- `req.query` → `new URL(request.url).searchParams`
- `res.json(data)` → `Response.json(data)`
- `res.status(404).send()` → `new Response('', { status: 404 })`
- `res.redirect()` → `new Response(null, { status: 302, headers: { Location: '/path' } })`

## Related Packages

- [`fetch-proxy`](https://github.com/mjackson/remix-the-web/tree/main/packages/fetch-proxy) - Build HTTP proxy servers using the web fetch API
- [`fetch-router`](https://github.com/mjackson/remix-the-web/tree/main/packages/fetch-router) - URL pattern routing for Fetch API servers

## License

See [LICENSE](https://github.com/mjackson/remix-the-web/blob/main/LICENSE)
