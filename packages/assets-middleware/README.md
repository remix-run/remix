# @remix-run/assets-middleware

Middleware for serving pre-built assets with manifest-based resolution.

This is the production counterpart to `@remix-run/dev-assets-middleware`. While the dev middleware transforms source files on-the-fly, this package uses a pre-built manifest (from esbuild's metafile) to resolve entry points to their hashed output files and all required chunks.

## Installation

```bash
npm install @remix-run/assets-middleware
```

## Usage

```ts
import { createRouter } from '@remix-run/fetch-router'
import { assets } from '@remix-run/assets-middleware'
import { staticFiles } from '@remix-run/static-middleware'
import manifest from './build/metafile.json' with { type: 'json' }

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

Creates middleware that provides asset resolution from an esbuild metafile.

- `manifest` - An esbuild metafile (or the `AssetManifest` subset)
- Returns middleware that sets `context.assets`

### `AssetManifest`

A subset of esbuild's metafile format containing only the information needed for asset resolution:

```ts
interface AssetManifest {
  outputs: {
    [outputPath: string]: {
      entryPoint?: string
      imports?: Array<{ path: string; kind: string }>
    }
  }
}
```

## How it works

1. At build time, esbuild generates a metafile with information about all outputs
2. `assets()` processes this metafile to build lookup tables:
   - Entry point path → output file path
   - Output file → all transitive static imports (chunks)
3. `context.assets.get('app/entry.tsx')` returns:
   - `href`: The hashed output file URL (e.g., `/build/entry-ABC123.js`)
   - `chunks`: All chunks needed for this entry (for modulepreload)
4. Dynamic imports are excluded from `chunks` (they load on-demand)

## License

MIT
