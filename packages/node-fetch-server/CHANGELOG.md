# `node-fetch-server` CHANGELOG

This is the changelog for [`node-fetch-server`](https://github.com/remix-run/remix/tree/main/packages/node-fetch-server). It follows [semantic versioning](https://semver.org/).

## v0.13.0 (2025-12-18)

- Use the `:authority` header to set the URL of http/2 requests.

## v0.12.0 (2025-11-04)

- Use `tsc` directly instead of `esbuild` to build the package. This means modules in the `dist` directory now mirror the layout of modules in the `src` directory.

## v0.11.0 (2025-10-22)

- BREAKING CHANGE: Removed CommonJS build. This package is now ESM-only. If you need to use this package in a CommonJS project, you will need to use dynamic `import()`.

## v0.10.0 (2025-10-04)

- Fire `close` and `finish` listeners only once (#10757)

## v0.9.0 (2025-09-16)

- Support `statusText` in HTTP/1 responses (#10745)

## v0.8.1 (2025-09-11)

- Only abort `request.signal` when the connection closes before the response completes (see #10726)

## v0.8.0 (2025-07-24)

- Renamed package from `@mjackson/node-fetch-server` to `@remix-run/node-fetch-server`
- Handle backpressure correctly in response streaming

## v0.7.0 (2025-06-06)

- Add `/src` to npm package, so "go to definition" goes to the actual source
- Use one set of types for all built files, instead of separate types for ESM and CJS
- Build using esbuild directly instead of tsup

## v0.6.1 (2025-02-07)

- Update typings and docs for http2 support

## v0.6.0 (2025-02-06)

- Add http/2 support

```ts
import * as http2 from 'node:http2'
import { createRequestListener } from '@remix-run/node-fetch-server'

let server = http2.createSecureServer(options)

server.on(
  'request',
  createRequestListener((request) => {
    let url = new URL(request.url)

    if (url.pathname === '/') {
      return new Response('Hello HTTP/2!', {
        headers: {
          'Content-Type': 'text/plain',
        },
      })
    }

    return new Response('Not Found', { status: 404 })
  }),
)
```

## v0.5.1 (2025-01-25)

- Iterate manually over response bodies in `sendResponse` instead of using `for await...of`. This seems to avoid an issue where the iterator tries to read from a stream after the lock has been released.

## v0.5.0 (2024-12-09)

- Expose `createHeaders(req: http.IncomingMessage): Headers` API for creating headers from the headers of incoming request objects.
- Update `sendResponse` to use an object to add support for libraries such as express while maintaining `node:http` and `node:https` compatibility.

## v0.4.1 (2024-12-04)

- Fix low-level API example in the README

## v0.4.0 (2024-11-26)

- BREAKING: Change `createRequest` signature to `createRequest(req, res, options)` so the abort signal fires on the `res`'s "end" event instead of `req`

## v0.3.0 (2024-11-20)

- Added `createRequest(req: http.IncomingMessage, options): Request` and `sendResponse(res: http.ServerResponse, response: Response): Promise<void>` exports to assist with building custom fetch servers

## v0.2.0 (2024-11-14)

- Small perf improvement from avoiding accessing `req.headers` and reading `req.rawHeaders` instead
- Added CommonJS build

## v0.1.0 (2024-09-05)

- Initial release
