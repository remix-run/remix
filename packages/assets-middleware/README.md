# assets-middleware

Middleware for resolving assets from the `remix/assets` build manifest.

This is the production counterpart to `remix/dev-assets-middleware`. While the dev middleware transforms source files on-the-fly, this package uses a pre-built manifest to source file paths to their hashed output files and all required chunks.

## Installation

```bash
npm i remix
```

## Usage

```ts
import { createRouter } from 'remix/fetch-router'
import { assets } from 'remix/assets-middleware'
import { staticFiles } from 'remix/static-middleware'

// Load the manifest from the build directory:
import loadManifest from './load-manifest.ts'
let manifest = await loadManifest()

let router = createRouter({
  middleware: [assets(manifest), staticFiles('./build')],
})

router.get('/', ({ assets }) => {
  let entry = assets.get('app/entry.tsx')
  // entry.href = '/build/entry-ABC123.js' (hashed filename)
  // entry.chunks = ['/build/entry-ABC123.js', '/build/chunk-DEF456.js', ...]
})
```

## API

### `assets(manifest)`

Creates middleware that attaches `context.assets` from a `remix/assets` manifest.
Use `context.assets.get(entryPath, variant?)` in route handlers to read hashed output URLs/chunks.

## How it works

1. At build time, `remix/assets` generates an assets manifest with information about all outputs
2. `assets()` processes this manifest to build lookup tables:
   - Entry point path → output file path
   - Output file → all transitive static imports (chunks)
3. `context.assets.get('app/entry.tsx')` returns:
   - `href`: The hashed output file URL (e.g., `/build/entry-ABC123.js`)
   - `chunks`: All chunks needed for this entry for modulepreload. Dynamic imports are excluded from `chunks` as they load on-demand.

## Related Packages

- [`fetch-router`](https://github.com/remix-run/remix/tree/main/packages/fetch-router) - Router for the web Fetch API
- [`assets`](https://github.com/remix-run/remix/tree/main/packages/assets) - Unbundled browser build tooling and development handler
- [`dev-assets-middleware`](https://github.com/remix-run/remix/tree/main/packages/dev-assets-middleware) - Middleware for transforming assets with `remix/assets` and serving them in development

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
