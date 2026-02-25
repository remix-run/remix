# assets-middleware

Middleware for resolving assets from the `remix/assets` build manifest.

This is the production counterpart to `remix/dev-assets-middleware`. While the dev middleware transforms source files on-the-fly, this package uses a pre-built manifest to source file paths to their hashed output files and all required module preloads.

## Installation

```bash
npm i remix
```

## Usage

```ts
import { createRouter } from 'remix/fetch-router'
import { assets } from 'remix/assets-middleware'
import { staticFiles } from 'remix/static-middleware'

// Load the assets manifest from the build directory
import { loadManifest } from './load-manifest.ts'
let manifest = await loadManifest()

let router = createRouter({
  middleware: [assets(manifest, { baseUrl: '/assets' }), staticFiles('./build')],
})

router.get('/', ({ assets }) => {
  let entry = assets.resolve('app/entry.tsx')
  // entry.href = '/build/assets/entry-ABC123.js'
  // entry.preloads = ['/build/assets/entry-ABC123.js', '/build/assets/utils-DEF456.js', ...]
})
```

`resolve()` throws an `AssetError` (from `remix/assets`) if the path isn't in the manifest or the variant arguments are invalid. Because missing assets are typically programmer errors, it's common to let the error propagate to a top-level error handler rather than catching it at every call site.

```ts
import { AssetError } from 'remix/assets'

router.get('/', ({ assets }) => {
  try {
    let entry = assets.resolve('app/entry.tsx')
    // use entry ...
  } catch (err) {
    if (err instanceof AssetError) {
      return new Response('Asset not found', { status: 500 })
    }
    throw err
  }
})
```

## Related Packages

- [`fetch-router`](https://github.com/remix-run/remix/tree/main/packages/fetch-router) - Router for the web Fetch API
- [`assets`](https://github.com/remix-run/remix/tree/main/packages/assets) - Unbundled browser build tooling and development handler
- [`dev-assets-middleware`](https://github.com/remix-run/remix/tree/main/packages/dev-assets-middleware) - Middleware for transforming assets with `remix/assets` and serving them in development

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
