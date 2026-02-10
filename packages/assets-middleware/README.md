# @remix-run/assets-middleware

Middleware for serving pre-built assets with manifest-based resolution.

This is the production counterpart to `@remix-run/dev-assets-middleware`. While the dev middleware transforms source files on-the-fly, this package uses a pre-built manifest from `@remix-run/assets` to resolve entry points to their hashed output files and all required chunks.

## Installation

```bash
npm install @remix-run/assets-middleware
```

## Usage

```ts
import { createRouter } from '@remix-run/fetch-router'
import { assets } from '@remix-run/assets-middleware'
import { staticFiles } from '@remix-run/static-middleware'
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

Creates middleware that provides asset resolution from an assets manifest.

- `manifest` - An assets manifest from `@remix-run/assets`
- Returns middleware that sets `context.assets`

## How it works

1. At build time, `@remix-run/assets` generates an assets manifest with information about all outputs
2. `assets()` processes this manifest to build lookup tables:
   - Entry point path → output file path
   - Output file → all transitive static imports (chunks)
3. `context.assets.get('app/entry.tsx')` returns:
   - `href`: The hashed output file URL (e.g., `/build/entry-ABC123.js`)
   - `chunks`: All chunks needed for this entry (for modulepreload)
4. Dynamic imports are excluded from `chunks` (they load on-demand)

## License

MIT
