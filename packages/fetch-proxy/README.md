# fetch-proxy

`fetch-proxy` is an HTTP proxy for the [JavaScript Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API).

HTTP proxies are essential for many web architectures: load balancing, API gateways, development servers that forward to backend services, and middleware that needs to intercept and modify traffic. Traditional proxy implementations often require platform-specific APIs or complex server setups.

In the context of servers, an HTTP proxy server is a server that forwards all requests it receives to another server and returns the responses it receives. When you think about it this way, a [`fetch` function](https://developer.mozilla.org/en-US/docs/Web/API/Window/fetch) is like a mini proxy server sitting right there in your code. You send it requests, it goes and talks to some other server, and it gives you back the response it received.

`fetch-proxy` allows you to easily create `fetch` functions that act as proxies to "target" servers using the familiar web-standard Fetch API.

## Features

- **Web Standards** - Built on the standard [JavaScript Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)
- **Cookie Rewriting** - Supports rewriting `Set-Cookie` headers received from target server
- **Forwarding Headers** - Supports `X-Forwarded-Proto` and `X-Forwarded-Host` headers
- **Custom Fetch** - Supports custom `fetch` implementations

## Installation

Install from [npm](https://www.npmjs.com/):

```sh
npm i @remix-run/fetch-proxy
```

## Usage

```ts
import { createFetchProxy } from '@remix-run/fetch-proxy'

// Create a proxy that sends all requests through to remix.run
let proxy = createFetchProxy('https://remix.run')

// This fetch handler is probably running as part of your server somewhere...
function handleFetch(request: Request): Promise<Response> {
  return proxy(request)
}

// Test it out by manually throwing a Request at it
let response = await handleFetch(new Request('https://shopify.com'))

let text = await response.text()
let title = text.match(/<title>([^<]+)<\/title>/)[1]
assert(title.includes('Remix'))
```

## Related Packages

- [`node-fetch-server`](https://github.com/remix-run/remix/tree/main/packages/node-fetch-server) - Build HTTP servers for Node.js using the web fetch API

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
