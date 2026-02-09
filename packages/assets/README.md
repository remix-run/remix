# @remix-run/assets

Core package for unbundled asset handling.

## Installation

```sh
npm install @remix-run/assets esbuild
```

## Usage

### Dev handler

```ts
import { createDevAssetsHandler } from '@remix-run/assets'

let handler = createDevAssetsHandler({
  root: '.',
  allow: ['app/**'],
  workspace: { root: '..', allow: ['**/node_modules/**'] },
})

// In your request handler:
let response = await handler.serve(request.url.pathname, request.headers)
if (response) return response
// else: next()
```

### Production build (JS API)

```ts
import { build } from '@remix-run/assets'

await build({
  entryPoints: ['app/entry.tsx'],
  root: '.',
  outDir: './build/assets',
  esbuildConfig: {
    /** Your esbuild config */
  },
  fileNames: '[dir]/[name]-[hash]',
  manifest: './build/assets-manifest.json',
})
```

## API

- **build(options)** – Programmatic production build: discovers module graph from entry points, transforms and writes 1:1 output, optional manifest.
- **createDevAssetsHandler(options)** – Stateful handler; owns module graph and caches. Returns `{ serve(pathname, headers) => Promise<Response | null> }`.
- **createDevAssets(root, entryPoints?)** – Dev-mode assets API (`get(entryPath)` → `{ href, chunks }`). Used by the middleware to set `context.assets`.
- **Types:** `BuildOptions`, `CreateDevAssetsHandlerOptions`, `DevAssetsWorkspaceOptions`, `DevAssetsEsbuildConfig`.

## Related Packages

- [dev-assets-middleware](https://github.com/remix-run/remix/tree/main/packages/dev-assets-middleware) – Development middleware that uses this package to transform and serve source files.
- [assets-middleware](https://github.com/remix-run/remix/tree/main/packages/assets-middleware) – Production middleware for serving pre-built assets; consumes the manifest produced by `build()`.
- [fetch-router](https://github.com/remix-run/remix/tree/main/packages/fetch-router) – Router for the web Fetch API (used with the middleware above).

## License

MIT
