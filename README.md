# Welcome to Remix 3!

This is the source repository for Remix 3. It is under active development.

We published [a blog post](https://remix.run/blog/wake-up-remix) earlier this year with some of our thoughts around Remix 3. It explains our philosophy for web development and why we think the time is right for something new. When working on Remix 3, we follow these principles:

1. **Model-First Development**. AI fundamentally shifts the human-computer interaction model for both user experience and developer workflows. Optimize the source code, documentation, tooling, and abstractions for LLMs. Additionally, develop abstractions for applications to use models in the product itself, not just as a tool to develop it.
2. **Build on Web APIs**. Sharing abstractions across the stack greatly reduces the amount of context switching, both for humans and machines. Build on the foundation of Web APIs and JavaScript because it is the only full stack ecosystem.
3. **Religiously Runtime**. Designing for bundlers/compilers/typegen (and any pre-runtime static analysis) leads to poor API design that eventually pollutes the entire system. All packages must be designed with no expectation of static analysis and all tests must run without bundling. Because browsers are involved, `--import` loaders for simple transformations like TypeScript and JSX are permissible.
4. **Avoid Dependencies**. Dependencies lock you into somebody else's roadmap. Choose them wisely, wrap them completely, and expect to replace most of them with our own package eventually. The goal is zero.
5. **Demand Composition**. Abstractions should be single-purpose and replaceable. A composable abstraction is easy to add and remove from an existing program. Every package must be useful and documented independent of any other context. New features should first be attempted as a new package. If impossible, attempt to break up the existing package to make it more composable. However, tightly coupled modules that almost always change together in both directions should be moved to the same package.
6. **Distribute Cohesively**. Extremely composable ecosystems are difficult to learn and use. Remix will be distributed as a single `remix` package for both distribution and documentation.

## Goals

Although we recommend the `remix` package for ease of use, all packages that make up Remix should be usable standalone as well. This forces us to consider package boundaries and helps us define public interfaces that are portable and interoperable.

Each package in Remix:

- Has a [single responsibility](https://en.wikipedia.org/wiki/Single-responsibility_principle)
- Prioritizes web standards to ensure maximum interoperability and portability across JavaScript runtimes
- Augments standards unobtrusively where they are missing or incomplete, minimizing incompatibility risks

This means Remix code is **portable by default**. Remix packages work seamlessly across [Node.js](https://nodejs.org/), [Bun](https://bun.sh/), [Deno](https://deno.com/), [Cloudflare Workers](https://workers.cloudflare.com/), and other environments.

We leverage server-side web APIs when they are available:

- [The Web Streams API](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API) instead of `node:stream`
- [`Uint8Array`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array) instead of Node.js `Buffer`s
- [The Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) instead of `node:crypto`
- [`Blob`](https://developer.mozilla.org/en-US/docs/Web/API/Blob) and [`File`](https://developer.mozilla.org/en-US/docs/Web/API/File) instead of some bespoke runtime-specific API

The benefit is code that's not just reusable, but **future-proof**.

## Packages

We currently publish the following packages:

- [async-context-middleware](packages/async-context-middleware): Middleware for storing request context in AsyncLocalStorage
- [component](packages/component): A minimal component system that leans on JavaScript and DOM primitives
- [compression-middleware](packages/compression-middleware): Middleware for compressing HTTP responses
- [cookie](packages/cookie): A toolkit for working with cookies in JavaScript
- [fetch-proxy](packages/fetch-proxy): An HTTP proxy for the web Fetch API
- [fetch-router](packages/fetch-router): A minimal, composable router for the web Fetch API
- [file-storage](packages/file-storage): Key/value storage for JavaScript File objects
- [form-data-middleware](packages/form-data-middleware): Middleware for parsing FormData from request bodies
- [form-data-parser](packages/form-data-parser): A request.formData() wrapper with streaming file upload handling
- [fs](packages/fs): Filesystem utilities using the Web File API
- [headers](packages/headers): A toolkit for working with HTTP headers in JavaScript
- [html-template](packages/html-template): HTML template tag with auto-escaping for JavaScript
- [interaction](packages/interaction): Like components but for events
- [lazy-file](packages/lazy-file): Lazy, streaming files for JavaScript
- [logger-middleware](packages/logger-middleware): Middleware for logging HTTP requests and responses
- [method-override-middleware](packages/method-override-middleware): Middleware for overriding HTTP request methods from form data
- [mime](packages/mime): Utilities for dealing with MIME types
- [multipart-parser](packages/multipart-parser): A fast, efficient parser for multipart streams in any JavaScript environment
- [node-fetch-server](packages/node-fetch-server): Build servers for Node.js using the web fetch API
- [route-pattern](packages/route-pattern): Match and generate URLs with strong typing
- [session](packages/session): Session management for JavaScript
- [session-middleware](packages/session-middleware): Middleware for managing sessions with cookie-based storage
- [static-middleware](packages/static-middleware): Middleware for serving static files from the filesystem
- [tar-parser](packages/tar-parser): A fast, efficient parser for tar streams in any JavaScript environment

## Contributing

We welcome contributions! If you'd like to contribute, please feel free to open an issue or submit a pull request. See [CONTRIBUTING](https://github.com/remix-run/remix/blob/main/CONTRIBUTING.md) for more information.

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
