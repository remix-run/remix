# fetch-router Deno Example

This example is a [Deno](https://deno.com/) server that handles routing using `@remix-run/fetch-router`.

It is the same blog application as the [Node](https://github.com/remix-run/remix/tree/main/packages/fetch-router/demos/node) and [Bun](https://github.com/remix-run/remix/tree/main/packages/fetch-router/demos/bun) examples, which shows that the router, middleware, and route helpers are all runtime-agnostic. Only the server entry point in `main.ts` is Deno-specific.

## Running

```sh
pnpm install
deno task dev
```

The application will be available at `http://localhost:44100`.

Use `deno task start` to run without file watching, and `deno task typecheck` to type check the demo.

## What This Demonstrates

- **`Deno.serve()` with `router.fetch()`**: the router is a plain `Request` → `Response` function, so it plugs straight into Deno's built-in HTTP server.
- **Graceful shutdown**: `main.ts` listens for `SIGINT`/`SIGTERM` and awaits `server.shutdown()` so in-flight requests finish before the process exits.
- **npm packages from a pnpm workspace**: `deno.json` sets `"nodeModulesDir": "manual"` so Deno resolves `@remix-run/*` from the `node_modules` directory pnpm installs, instead of managing its own dependencies.
- **Explicit permissions**: the tasks grant only `--allow-net`, `--allow-read`, and `--allow-env`.
- **Node built-ins in Deno**: `app/router.ts` uses `node:url` to resolve the `public` directory, and `staticFiles()` reads it through `node:fs` under the hood.

## Key APIs

- `createRouter()` from `@remix-run/fetch-router` with `logger()`, `staticFiles()`, `formData()`, and `session()` middleware
- `route()`, `form()`, and `resources()` route helpers from `@remix-run/fetch-router/routes` for typed `href()` generation
- `router.map()` with an `actions` object, including per-action `middleware` for the authenticated "new post" route
- `html` from `@remix-run/html-template` for escaped HTML, returned with `createHtmlResponse()` from `@remix-run/response/html`
