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

### With fetch-router (via dev-assets-middleware)

```ts
import { devAssets } from '@remix-run/dev-assets-middleware'
// devAssets uses createDevAssetsHandler under the hood
```

## API

- **createDevAssetsHandler(options)** – Stateful handler; owns module graph and caches. Returns `{ serve(pathname, headers) => Promise<Response | null> }`.
- **createDevAssets(root, entryPoints?)** – Dev-mode assets API (`get(entryPath)` → `{ href, chunks }`). Used by the middleware to set `context.assets`.
- **Types:** `CreateDevAssetsHandlerOptions`, `DevAssetsWorkspaceOptions`, `DevAssetsEsbuildConfig`.

## License

MIT
