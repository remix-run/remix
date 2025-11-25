# response

Response helpers for the web Fetch API. `response` provides a collection of helper functions for creating common HTTP responses with proper headers and semantics.

Basically, these are all the static response helpers we wish existed on the `Response` API, but don't (yet!).

## Features

- **Web Standards Compliant:** Built on the standard `Response` API, works in any JavaScript runtime (Node.js, Bun, Deno, Cloudflare Workers)
- [**File Responses:**](#file-responses) Full HTTP semantics including ETags, Last-Modified, conditional requests, and Range support
- [**HTML Responses:**](#html-responses) Automatic DOCTYPE prepending and proper Content-Type headers
- [**Redirect Responses:**](#redirect-responses) Simple redirect creation with customizable status codes

## Installation

```sh
npm install @remix-run/response
```

## Usage

This package provides no default export. Instead, import the specific helper you need:

```ts
import { createFileResponse } from '@remix-run/response/file'
import { createHtmlResponse } from '@remix-run/response/html'
import { createRedirectResponse } from '@remix-run/response/redirect'
```

### File Responses

The `createFileResponse` helper creates a response for serving files with full HTTP semantics:

```ts
import { createFileResponse } from '@remix-run/response/file'
import { openFile } from '@remix-run/fs'

let file = await openFile('./public/image.jpg')
let response = await createFileResponse(file, request, {
  cacheControl: 'public, max-age=3600',
})
```

#### Features

- **Content-Type** and **Content-Length** headers
- **ETag** generation (weak or strong)
- **Last-Modified** headers
- **Cache-Control** headers
- **Conditional requests** (`If-None-Match`, `If-Modified-Since`, `If-Match`, `If-Unmodified-Since`)
- **Range requests** for partial content (`206 Partial Content`)
- **HEAD** request support

#### Options

```ts
await createFileResponse(file, request, {
  // Cache-Control header value.
  // Defaults to `undefined` (no Cache-Control header).
  cacheControl: 'public, max-age=3600',

  // ETag generation strategy:
  // - 'weak': Generates weak ETags based on file size and mtime (default)
  // - 'strong': Generates strong ETags by hashing file content
  // - false: Disables ETag generation
  etag: 'weak',

  // Hash algorithm for strong ETags (Web Crypto API algorithm names).
  // Only used when etag: 'strong'.
  // Defaults to 'SHA-256'.
  digest: 'SHA-256',

  // Whether to generate Last-Modified headers.
  // Defaults to `true`.
  lastModified: true,

  // Whether to support HTTP Range requests for partial content.
  // Defaults to `true`.
  acceptRanges: true,
})
```

#### Strong ETags and Content Hashing

For assets that require strong validation (e.g., to support [`If-Match`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/If-Match) preconditions or [`If-Range`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/If-Range) with [`Range` requests](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Range)), configure strong ETag generation:

```ts
return createFileResponse(file, request, {
  etag: 'strong',
})
```

By default, strong ETags are generated using the Web Crypto API with the `'SHA-256'` algorithm. You can customize this:

```ts
return createFileResponse(file, request, {
  etag: 'strong',
  // Specify a different hash algorithm
  digest: 'SHA-512',
})
```

For large files or custom hashing requirements, provide a custom digest function:

```ts
await createFileResponse(file, request, {
  etag: 'strong',
  async digest(file) {
    // Custom streaming hash for large files
    let { createHash } = await import('node:crypto')
    let hash = createHash('sha256')
    for await (let chunk of file.stream()) {
      hash.update(chunk)
    }
    return hash.digest('hex')
  },
})
```

### HTML Responses

The `createHtmlResponse` helper creates HTML responses with proper `Content-Type` and DOCTYPE handling:

```ts
import { createHtmlResponse } from '@remix-run/response/html'

let response = createHtmlResponse('<h1>Hello, World!</h1>')
// Content-Type: text/html; charset=UTF-8
// Body: <!DOCTYPE html><h1>Hello, World!</h1>
```

The helper automatically prepends `<!DOCTYPE html>` if not already present. It works with strings, `SafeHtml` [from `@remix-run/html-template`](https://github.com/remix-run/remix/tree/main/packages/html-template), Blobs/Files, ArrayBuffers, and ReadableStreams.

```ts
import { html } from '@remix-run/html-template'
import { createHtmlResponse } from '@remix-run/response/html'

let name = '<script>alert(1)</script>'
let response = createHtmlResponse(html`<h1>Hello, ${name}!</h1>`)
// Safely escaped HTML
```

### Redirect Responses

The `createRedirectResponse` helper creates redirect responses. The main improvements over the native `Response.redirect` API are:

- Accepts a relative `location` instead of a full URL. This isn't technically spec-compliant, but it's so widespread that many applications use relative redirects regularly without issues.
- Accepts a `ResponseInit` object as the second argument, allowing you to set additional headers and status code.

```ts
import { createRedirectResponse } from '@remix-run/response/redirect'

// Default 302 redirect
let response = createRedirectResponse('/login')

// Custom status code
let response = createRedirectResponse('/new-page', 301)

// With additional headers
let response = createRedirectResponse('/dashboard', {
  status: 303,
  headers: { 'X-Redirect-Reason': 'authentication' },
})
```

## Related Packages

- [`@remix-run/headers`](https://github.com/remix-run/remix/tree/main/packages/headers) - Type-safe HTTP header manipulation
- [`@remix-run/html-template`](https://github.com/remix-run/remix/tree/main/packages/html-template) - Safe HTML templating with automatic escaping
- [`@remix-run/fs`](https://github.com/remix-run/remix/tree/main/packages/fs) - File system utilities including `openFile`
- [`@remix-run/fetch-router`](https://github.com/remix-run/remix/tree/main/packages/fetch-router) - Build HTTP routers using the web fetch API

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
