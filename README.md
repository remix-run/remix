This collection of packages empowers you to build modern web applications with maximum interoperability and portability, leveraging the power of web standards. Whether you're using [Remix](https://remix.run) or another framework, these tools are designed to seamlessly integrate into your workflow.

This repository is laying the groundwork for the next major evolution of Remix.

## Philosophy

Our core philosophy is simple: **build on web standards, embrace single responsibility.**

Each package in this repository:
- Adheres to the [single-responsibility principle](https://en.wikipedia.org/wiki/Single-responsibility_principle).
- Prioritizes web standards to ensure maximum interoperability and portability across JavaScript runtimes.
- Augments standards unobtrusively where they are missing or incomplete, minimizing incompatibility risks.

This approach means the JavaScript you write is **portable by default**. These packages work seamlessly across [Node.js](https://nodejs.org/), [Bun](https://bun.sh/), [Deno](https://deno.com/), [Cloudflare Workers](https://workers.cloudflare.com/), and other environments.

We leverage server-side web APIs like:

- [The Web Streams API](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API) instead of Node.js streams
- [`Uint8Array`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array) instead of Node.js `Buffer`s
- [The Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) instead of the Node.js crypto library
- [`Blob`](https://developer.mozilla.org/en-US/docs/Web/API/Blob) and [`File`](https://developer.mozilla.org/en-US/docs/Web/API/File) instead of some bespoke runtime-specific API

The benefit? Code that's not just reusable, but **future-proof**.

The goal is that these packages should be useful for anyone who is building for the web. If you're using [Remix](https://remix.run), we've designed it from the start to work with web standards. If you're using some other framework, you should easily be able to integrate these tools into your workflow as well without going full-blown Remix. If you're building your own framework, we hope you'll be able to build on this foundation as well.

## Packages

Discover our growing suite of tools:

- [fetch-proxy](packages/fetch-proxy): Seamlessly construct HTTP proxies with the familiar `fetch()` API – ideal for API gateways or abstracting microservices.
- [file-storage](packages/file-storage): Robust key/value storage tailored for JavaScript `File` objects, simplifying file management.
- [form-data-parser](packages/form-data-parser): An enhanced `request.formData()` wrapper enabling efficient, streaming file uploads.
- [headers](packages/headers): A comprehensive toolkit for effortlessly managing HTTP headers in your JavaScript applications.
- [lazy-file](packages/lazy-file): Optimize performance with lazy-loaded, streaming `Blob`s and `File`s for JavaScript.
- [multipart-parser](packages/multipart-parser): High-performance, streaming parser for multipart messages, perfect for handling complex form data.
- [node-fetch-server](packages/node-fetch-server): Build Node.js HTTP servers using the web-standard `fetch()` API, promoting code consistency.
- [tar-parser](packages/tar-parser): A fast, streaming parser for tar archives, designed for efficient data extraction.

## Why Choose These Packages?

- **Web Standard-Focused:** Write code that's portable across Node.js, Deno, Bun, Cloudflare Workers, and more.
- **Single Responsibility:** Each package is focused and does one thing well, making them easy to understand and integrate.
- **Interoperable:** Designed to work together, and with your existing tools, thanks to their adherence to web standards.
- **Future-Proof:** By building on web standards, your codebase remains adaptable and resilient to ecosystem changes.
- **Remix Ready (and Beyond!):** While born from the needs of Remix, these packages are valuable for any web developer or framework author seeking robust, standard-compliant tools.

## Using with Remix v2

If you're trying to use these libraries with Remix v2, you'll need to [enable "Single Fetch"](https://remix.run/docs/en/main/guides/single-fetch#enabling-single-fetch) first. This tells Remix to use Node's built-in fetch primitives (`Request`, `Response`, `Headers`, etc.) instead of a broken polyfill we shipped in earlier versions of Remix.

## Quick Start

Each package is available on npm and can be installed using:

```bash
npm install <package-name>
```

Then, import and use as needed in your project. Refer to individual package `README` files for specific usage instructions.

All packages are published in both modern ESM and legacy CJS formats for maximum compatibility with both existing and new projects.

## Contributing

We welcome contributions! If you'd like to contribute, please feel free to open an issue or submit a pull request. See [CONTRIBUTING](https://github.com/remix-run/remix/blob/v3/CONTRIBUTING.md) for more information.

## License

See [LICENSE](https://github.com/remix-run/remix/blob/v3/LICENSE)
