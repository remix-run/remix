# fetch-proxy

HTTP proxy utilities built on the web [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API). Use `fetch-proxy` to create `fetch` handlers that forward requests to target servers while optionally rewriting headers and cookies.

## Features

- **Web Standards** - Built on the standard [JavaScript Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)
- **Cookie Rewriting** - Supports rewriting `Set-Cookie` headers received from target server
- **Forwarding Headers** - Supports `X-Forwarded-Proto`, `X-Forwarded-Host`, and `X-Forwarded-Port` headers
- **Encoding Headers** - Strips stale encoding and framing headers from proxied responses
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

## Encoding and Framing Headers

Since proxying is done via `fetch` rather than raw HTTP messages, some encoding and framing headers need to be removed.

The incoming `Accept-Encoding` request header describes the final client, so it is not forwarded to the target server.

Since `fetch` can decompress upstream responses and does not expose raw HTTP transfer framing, `fetch-proxy` strips response headers that may no longer describe the returned body: `Content-Encoding`, related `Content-Length`, and `Transfer-Encoding`.

To support serving compressed responses to the final client, you'll need to compress the response after the proxy returns it, e.g. with the [`compressResponse` helper from `remix/response`](https://github.com/remix-run/remix/tree/main/packages/response#compress-responses):

```ts
import { createFetchProxy } from 'remix/fetch-proxy'
import { compressResponse } from 'remix/response/compress'

let proxy = createFetchProxy('https://remix.run')

async function handleFetch(request: Request): Promise<Response> {
  let response = await proxy(request)

  return compressResponse(response, request)
}
```

## Related Packages

- [`node-fetch-server`](https://github.com/remix-run/remix/tree/main/packages/node-fetch-server) - Build HTTP servers for Node.js using the web fetch API
- [`response`](https://github.com/remix-run/remix/tree/main/packages/response) - Create, transform, and compress Fetch API responses

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
