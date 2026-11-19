<br />
<br />

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/assets/remix-wordmark-racing-darkmode.svg">
    <img alt="Remix" src=".github/assets/remix-wordmark-racing-lightmode.svg" width="400">
  </picture>
</p>

<br />
<br />

Remix is a full-stack TypeScript framework for building web applications. It comes with everything you need to build fast, safe, modern web applications. We use it to build many of our production applications at Shopify.

## Get started

With Node.js 24.3 or later, create an app and start the development server.

```sh
npx remix new my-remix-app
cd my-remix-app
npm i
npm run dev
```

To add Remix to an existing project, install the package.

```sh
npm i remix
```

Follow the [Getting Started tutorial](https://docs.remix.run/start-here/) to build a page with an editable form. Explore the [bookstore demo](https://github.com/remix-run/remix/tree/main/demos/bookstore) to see how sign-in, a shopping cart, and checkout fit together.

### Install from `main`

To try a new feature or test a fix before the next release, install the latest build from `main` in your project.

```sh
pnpm add "$(curl -fsSL https://github.com/remix-run/previews/releases/latest/download/remix.url)"
```

This pins your project to a specific commit. Run the command again when you want a newer build. You can find the source commit and tarballs for individual packages in the [latest preview release](https://github.com/remix-run/previews/releases/latest).

If pnpm blocks tarball dependencies, set `blockExoticSubdeps: false` in your project's `pnpm-workspace.yaml`.

## Design principles

1. **Model-First Development.** We design Remix for developers who build with coding agents and use models in their apps. New apps include the [Remix skill for coding agents](https://github.com/remix-run/remix/blob/main/.agents/skills/remix/SKILL.md), and `node_modules/remix/INDEX.md` points to the guides and API docs for your installed version.
2. **Build on Web APIs.** The router accepts a standard `Request` and returns a `Response`. The generated app connects it to Node.js through a server adapter. You can test the same routes by passing requests directly to the router.
3. **Religiously Runtime.** Routes and middleware run directly from source. You can test them without bundling your app or generating types.
4. **Avoid Dependencies.** A new Remix app has one runtime dependency, `remix`. Where Remix uses third-party code, it wraps that code behind its own APIs.
5. **Demand Composition.** Each package does one job. You can use the router in an existing Fetch handler or add the session package to an app that already has a router.
6. **Distribute Cohesively.** Import what you need from a single package, such as `remix/router` for routing or `remix/component` for UI.

For the ideas behind these principles, read [Wake up, Remix!](https://remix.run/blog/wake-up-remix).

## Packages

- [assert](packages/assert): Node assert-compatible utilities for any JavaScript environment
- [assets](packages/assets): Fetch-based server for compiling browser JS/TS and CSS assets on demand
- [async-context-middleware](packages/async-context-middleware): Middleware for storing request context in AsyncLocalStorage
- [auth](packages/auth): Browser login, OAuth, and OIDC helpers for Remix
- [auth-middleware](packages/auth-middleware): Pluggable authentication middleware for Remix
- [cli](packages/cli): Command-line interface for Remix
- [component](packages/component): Component runtime with server rendering and browser hydration
- [component-hmr](packages/component-hmr): Hot module replacement runtime and transforms for Remix components
- [compression-middleware](packages/compression-middleware): Middleware for compressing HTTP responses
- [cookie](packages/cookie): A toolkit for working with cookies in JavaScript
- [cop-middleware](packages/cop-middleware): Middleware for tokenless cross-origin protection in Fetch API servers
- [cors-middleware](packages/cors-middleware): Middleware for handling CORS in Fetch API servers
- [csrf-middleware](packages/csrf-middleware): Middleware for CSRF protection in Fetch API servers
- [data-schema](packages/data-schema): Tiny, standards-aligned schema validation
- [data-table](packages/data-table): A typed, relational query toolkit for JavaScript
- [data-table-mysql](packages/data-table-mysql): MySQL database implementation for remix/data-table
- [data-table-postgres](packages/data-table-postgres): PostgreSQL database implementation for remix/data-table
- [data-table-sqlite](packages/data-table-sqlite): SQLite database implementation for remix/data-table
- [fetch-proxy](packages/fetch-proxy): An HTTP proxy for the web Fetch API
- [fetch-router](packages/fetch-router): A minimal, composable router for the web Fetch API
- [file-storage](packages/file-storage): Key/value storage for JavaScript File objects
- [file-storage-s3](packages/file-storage-s3): S3 backend for remix/file-storage
- [form-data-middleware](packages/form-data-middleware): Middleware for parsing FormData from request bodies
- [form-data-parser](packages/form-data-parser): A request.formData() wrapper with streaming file upload handling
- [fs](packages/fs): Filesystem utilities using the Web File API
- [headers](packages/headers): A toolkit for working with HTTP headers in JavaScript
- [html-template](packages/html-template): HTML template tag with auto-escaping for JavaScript
- [lazy-file](packages/lazy-file): Lazy, streaming files for JavaScript
- [logger-middleware](packages/logger-middleware): Middleware for logging HTTP requests and responses
- [method-override-middleware](packages/method-override-middleware): Middleware for overriding HTTP request methods from form data
- [mime](packages/mime): Utilities for working with MIME types
- [multipart-parser](packages/multipart-parser): A fast, efficient parser for multipart streams in any JavaScript environment
- [node-fetch-server](packages/node-fetch-server): Build servers for Node.js using the web fetch API
- [node-hmr](packages/node-hmr): Run Node.js applications with hot module reloading
- [node-tsx](packages/node-tsx): Run Node.js with TypeScript and JSX syntax support
- [remix](packages/remix): The Remix web framework
- [response](packages/response): Response helpers for the web Fetch API
- [route-pattern](packages/route-pattern): Match and generate URLs with strong typing
- [session](packages/session): Session management for JavaScript
- [session-middleware](packages/session-middleware): Middleware for managing sessions with cookie-based storage
- [session-storage-memcache](packages/session-storage-memcache): Memcache session storage for remix/session
- [session-storage-redis](packages/session-storage-redis): Redis session storage for remix/session
- [static-middleware](packages/static-middleware): Middleware for serving static files from the filesystem
- [tar-parser](packages/tar-parser): A fast, efficient parser for tar streams in any JavaScript environment
- [terminal](packages/terminal): Terminal output utilities for JavaScript libraries and CLIs
- [test](packages/test): A test framework for JavaScript and TypeScript projects
- [ui](packages/ui): Headless, accessible UI primitives and animation utilities for Remix components

## Contributing

See the [contributing guide](https://github.com/remix-run/remix/blob/main/CONTRIBUTING.md) to report a bug, propose a feature, or submit a pull request. To test a pull request, use the preview install command posted on the PR.

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
