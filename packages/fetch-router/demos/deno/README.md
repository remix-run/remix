# fetch-router Deno Example

This example is a [Deno](https://deno.com/) server that handles routing using `@remix-run/fetch-router`.

It is the same blog application as the [Node](https://github.com/remix-run/remix/tree/main/packages/fetch-router/demos/node) and [Bun](https://github.com/remix-run/remix/tree/main/packages/fetch-router/demos/bun) examples, which shows that the router, middleware, and route helpers are all runtime-agnostic. Here there is no server entry point at all: `deno serve` runs `app/router.ts` directly.

## Running

```sh
pnpm install
deno task dev
```

The application will be available at `http://localhost:44100`.

Use `deno task start` to run without file watching, and `deno task typecheck` to type check every module in the demo.

## What This Demonstrates

- **`deno serve` with no server code**: a router is already a `{ fetch }` object, which is exactly the default export shape `deno serve` expects, so `app/router.ts` is the whole server. Deno owns the listener, port, and graceful shutdown on `SIGINT`/`SIGTERM`.
- **npm packages from a pnpm workspace**: `deno.json` sets `"nodeModulesDir": "manual"` so Deno resolves `@remix-run/*` from the `node_modules` directory pnpm installs, instead of managing its own dependencies.
- **Least-privilege permissions**: the tasks grant read access to `./public` only, and env access to the four variables `logger()` inspects for color detection (`CI`, `FORCE_COLOR`, `NO_COLOR`, `TERM`). Static imports need no read permission, and `deno serve` provides the network access itself, so nothing else is granted.
- **Node built-ins in Deno**: `app/router.ts` uses `node:url` to resolve the `public` directory, and `staticFiles()` reads it through `node:fs` under the hood.

## Key APIs

- `createRouter()` from `@remix-run/fetch-router` with `logger()`, `staticFiles()`, `formData()`, and `session()` middleware
- `route()`, `form()`, and `resources()` route helpers from `@remix-run/fetch-router/routes` for typed `href()` generation
- `router.map()` with an `actions` object, including per-action `middleware` for the authenticated "new post" route
- `html` from `@remix-run/html-template` for escaped HTML, returned with `createHtmlResponse()` from `@remix-run/response/html`
