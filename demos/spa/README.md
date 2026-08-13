# SPA Demo

This Vite app uses Remix as a client-only router while preserving the fetch router's normal
`Request` to `Response` contract. Each route returns `nodeResponse(node)`, and
`run(router, { fallback })` from `remix/ui/spa` renders a live Remix fallback while the existing
top-frame navigation runtime loads the associated route node.

The demo keeps the entire application in `app/main.tsx` so the setup is easy to see. It covers a
direct deep link, client-side links, aborting delayed routes, POST form data, and push/replace
history behavior. The static `index.html` owns the document shell; the fallback and route nodes
render into its `body`.

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
