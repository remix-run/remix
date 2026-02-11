# fetch-proxy

HTTP proxy utilities built on the web [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API).
Use `fetch-proxy` to create `fetch` handlers that forward requests to target servers while optionally rewriting headers and cookies.

## Features

- **Web Standards** - Built on the standard [JavaScript Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)
- **Cookie Rewriting** - Supports rewriting `Set-Cookie` headers received from target server
- **Forwarding Headers** - Supports `X-Forwarded-Proto` and `X-Forwarded-Host` headers
- **Custom Fetch** - Supports custom `fetch` implementations

## Installation

```sh
npm i remix
```

## Usage

```ts
import { createFetchProxy } from 'remix/fetch-proxy'

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
