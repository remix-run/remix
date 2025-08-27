# Welcome to Remix 3!

This branch (`v3`) is the source for Remix 3. It is under active development.

We published [a blog post](https://remix.run/blog/wake-up-remix) earlier this year with some of our thoughts around Remix 3. It explains our philosophy for web development and why we think the time is right for something new. In particular, we follow these principles:

1. **Model-First Development**. AI fundamentally shifts the human-computer interaction model for both user experience and developer workflows. Optimize the source code, documentation, tooling, and abstractions for LLMs. Additionally, develop abstractions for applications to use models in the product itself, not just as a tool to develop it.
2. **Build on Web APIs**. Sharing abstractions across the stack greatly reduces the amount of context switching, both for humans and machines. Build on the foundation of Web APIs and JavaScript because it is the only full stack ecosystem.
3. **Religiously Runtime**. Designing for bundlers/compilers/typegen (and any pre-runtime static analysis) leads to poor API design that eventually pollutes the entire system. All packages must be designed with no expectation of static analysis and all tests must run without bundling. Because browsers are involved, `--import` loaders for simple transformations like TypeScript and JSX are permissible.
4. **Avoid Dependencies**. Dependencies lock you into somebody else's roadmap. Choose them wisely, wrap them completely, and expect to replace most of them with our own package eventually. The goal is zero.
5. **Demand Composition**. Abstractions should be single-purpose and replaceable. A composable abstraction is easy to add and remove from an existing program. Every package must be useful and documented independent of any other context. New features should first be attempted as a new package. If impossible, attempt to break up the existing package to make it more composable. However, tightly coupled modules that almost always change together in both directions should be moved to the same package.
6. **Distribute Cohesively**. Extremely composable ecosystems are difficult to learn and use. Therefore the packages will be wrapped up into a single package as dependencies and re-exported as a single toolbox (remix) for both distribution and documentation.

## Goals

The goal is to develop all packages independently, and then stitch them together into the `remix` package for ease of use. However, all packages that make up Remix should be usable standalone as well. This forces us to consider package boundaries and helps us keep public interfaces portable and interopable.

Each package in Remix:

- Has a [single responsibility](https://en.wikipedia.org/wiki/Single-responsibility_principle)
- Prioritizes web standards to ensure maximum interoperability and portability across JavaScript runtimes
- Augments standards unobtrusively where they are missing or incomplete, minimizing incompatibility risks

This approach means the Remix code you write is **portable by default**. These packages work seamlessly across [Node.js](https://nodejs.org/), [Bun](https://bun.sh/), [Deno](https://deno.com/), [Cloudflare Workers](https://workers.cloudflare.com/), and other environments.

We leverage server-side web APIs like:

- [The Web Streams API](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API) instead of Node.js streams
- [`Uint8Array`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array) instead of Node.js `Buffer`s
- [The Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) instead of the Node.js crypto library
- [`Blob`](https://developer.mozilla.org/en-US/docs/Web/API/Blob) and [`File`](https://developer.mozilla.org/en-US/docs/Web/API/File) instead of some bespoke runtime-specific API

The benefit is code that's not just reusable, but **future-proof**.

These packages should be useful for anyone who is building for the web. If you're using [Remix](https://remix.run), we've designed it from the start to work with web standards. If you're using some other framework, you should easily be able to integrate these tools into your workflow as well without going full-blown Remix. If you're building your own framework, we hope you'll be able to build on this foundation as well.

## Packages

We currently publish the following packages:

- [fetch-proxy](packages/fetch-proxy): Seamlessly construct HTTP proxies with the familiar `fetch()` API – ideal for API gateways or abstracting microservices.
- [file-storage](packages/file-storage): Robust key/value storage tailored for JavaScript `File` objects, simplifying file management.
- [form-data-parser](packages/form-data-parser): An enhanced `request.formData()` wrapper enabling efficient, streaming file uploads.
- [headers](packages/headers): A comprehensive toolkit for effortlessly managing HTTP headers in your JavaScript applications.
- [lazy-file](packages/lazy-file): Optimize performance with lazy-loaded, streaming `Blob`s and `File`s for JavaScript.
- [multipart-parser](packages/multipart-parser): High-performance, streaming parser for multipart messages, perfect for handling complex form data.
- [node-fetch-server](packages/node-fetch-server): Build Node.js HTTP servers using the web-standard `fetch()` API, promoting code consistency.
- [route-pattern](packages/route-pattern): A powerful and flexible URL pattern matching library for modern JavaScript applications.
- [tar-parser](packages/tar-parser): A fast, streaming parser for tar archives, designed for efficient data extraction.

All packages are published in both modern ESM and legacy CJS formats for maximum compatibility with both existing and new projects.

## Contributing

We welcome contributions! If you'd like to contribute, please feel free to open an issue or submit a pull request. See [CONTRIBUTING](https://github.com/remix-run/remix/blob/v3/CONTRIBUTING.md) for more information.

## License

See [LICENSE](https://github.com/remix-run/remix/blob/v3/LICENSE)
