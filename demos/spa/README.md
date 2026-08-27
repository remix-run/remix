# SPA Demo

This Vite app uses Remix as a client-only router while preserving the fetch router's normal
`Request` to `Response` contract. The `render()` middleware exposes `context.render(node)` to routes
and hides the response carrier used by the UI runtime. `run(router, { fallback })` renders a live
Remix fallback while the existing top-frame navigation runtime loads the associated route node.

The application is split by responsibility: `app/main.tsx` configures and starts the SPA,
`app/routes.ts` defines its URL contract, `app/components.tsx` contains its UI, and `app/utils.ts`
contains shared support code. The demo covers a direct deep link, client-side links, aborting
delayed routes, POST form data, and push/replace history behavior. The static `index.html` owns the
document shell; the fallback and route nodes render into its `body`.

## Run It

```sh
pnpm -C demos/spa dev
```

Then open `http://localhost:44100`.

## Test It

The end-to-end tests build and preview the production app by default. Change `mode` in the test
file to `development` to run the same suite against Vite's development server.

```sh
pnpm -C demos/spa test
```
