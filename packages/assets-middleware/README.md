# assets-middleware

Middleware for serving pre-built assets with manifest-based resolution.

This is the production counterpart to `remix/dev-assets-middleware`. While the dev middleware transforms source files on-the-fly, this package uses a pre-built manifest from `remix/assets` to resolve entry points to their hashed output files and all required chunks.

## Installation

```bash
npm i remix
```

## Usage

```ts
import { createRouter } from 'remix/fetch-router'
import { assets } from 'remix/assets-middleware'
import { staticFiles } from 'remix/static-middleware'
import manifest from './build/assets-manifest.json' with { type: 'json' }

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
   - `chunks`: All chunks needed for this entry (for modulepreload)
4. Dynamic imports are excluded from `chunks` (they load on-demand)

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
