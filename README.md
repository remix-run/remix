This is a collection of packages for use with [Remix](https://remix.run), or any web framework you choose.

It is laying the foundation for the next major release of Remix.

## Philosophy

Each package in this repository has a [single responsibility](https://en.wikipedia.org/wiki/Single-responsibility_principle).

To maximize interoperability between packages, we build on web standards. Where standards are missing or incomplete, we augment them in unobtrusive ways to minimize the chance of incompatibility.

A few examples of web APIs that we use on the server include:

- [The Web Streams API](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API) instead of Node.js streams
- [`Uint8Array`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array) instead of Node.js `Buffer`s
- [The Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) instead of the Node.js crypto library
- [`Blob`](https://developer.mozilla.org/en-US/docs/Web/API/Blob) and [`File`](https://developer.mozilla.org/en-US/docs/Web/API/File) instead of some bespoke runtime-specific API

You get the idea. The benefit of writing JavaScript like this is that it's portable between various runtimes. Unless explicitly noted, all packages in this repository work on any JavaScript runtime you might be using: [Node.js](https://nodejs.org/), [Bun](https://bun.sh/), [Deno](https://deno.com/), [Cloudflare Workers](https://workers.cloudflare.com/), etc.

The goal is that these packages should be useful for anyone who is building for the web. If you're using [Remix](https://remix.run), we've designed it from the start to work with web standards. If you're using some other framework, you should easily be able to integrate these tools into your workflow as well without going full-blown Remix. If you're building your own framework, we hope you'll be able to build on this foundation as well.

## Packages

We currently publish the following packages:

- [fetch-proxy](packages/fetch-proxy): Easily build HTTP proxies using the `fetch()` API
- [file-storage](packages/file-storage): Key/value storage for JavaScript `File` objects
- [form-data-parser](packages/form-data-parser): A `request.formData()` wrapper with streaming file upload handling
- [headers](packages/headers): A toolkit for working with HTTP headers in JavaScript
- [lazy-file](packages/lazy-file): Lazy, streaming `Blob`s and `File`s for JavaScript
- [multipart-parser](packages/multipart-parser): Fast, streaming parser for multipart messages
- [node-fetch-server](packages/node-fetch-server): Build HTTP servers for Node.js using the web `fetch()` API
- [tar-parser](packages/tar-parser): Fast, streaming parser for tar archives

## Using with Remix v2

If you're trying to use these libraries with Remix v2, you'll need to [enable "Single Fetch"](https://remix.run/docs/en/main/guides/single-fetch#enabling-single-fetch) first. This tells Remix to use Node's built-in fetch primitives (`Request`, `Response`, `Headers`, etc.) instead of a broken polyfill we shipped in earlier versions of Remix.

## License

See [LICENSE](https://github.com/mjackson/remix-the-web/blob/main/LICENSE)
