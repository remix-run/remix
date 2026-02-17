# assets

Unbundled browser build tooling and development handler.

## Installation

```sh
npm i remix
```

## Usage

### Build

```ts
import { build } from 'remix/assets'

await build({
  scripts: ['app/entry.tsx'],
  files: [
    {
      include: 'app/**/*.{png,jpg,jpeg}',
      variants: {
        original: (buffer) => buffer,
        thumbnail: async (buffer) => {
          let { generateThumbnail } = await import('./generate-thumbnail.ts')
          return await generateThumbnail(buffer)
        },
      },
      defaultVariant: 'original',
    },
  ],
  outDir: './build/assets',
  fileNames: '[dir]/[name]-[hash]',
  minify: true,
  sourcemap: 'external',
  manifest: './build/assets-manifest.json',
})
```

Resolving assets:

```ts
import { createAssetResolver } from 'remix/assets'

// Load the assets manifest from the build directory
import { loadManifest } from './load-manifest.ts'
let manifest = await loadManifest()

let resolveAsset = createAssetResolver(manifest, { baseUrl: '/assets' })

let entry = resolveAsset('app/entry.tsx')
entry?.href // '/build/assets/entry-ABC123.js'
entry?.preloads // ['/build/assets/entry-ABC123.js', '/build/assets/utils-DEF456.js', ...]

let thumbnail = resolveAsset('app/images/logo.png', 'thumbnail')
thumbnail?.href // '/build/assets/images/logo-@thumbnail-ABC123.png'
```

### Development Assets Handler

```ts
import { createDevAssetsHandler } from 'remix/assets'

let handler = createDevAssetsHandler({
  allow: ['app/**', '**/node_modules/**'],
  files: [
    {
      include: 'app/**/*.{png,jpg,jpeg}',
      variants: {
        original: (buffer) => buffer,
        thumbnail: async (buffer) => {
          let { generateThumbnail } = await import('./generate-thumbnail.ts')
          return await generateThumbnail(buffer)
        },
      },
      defaultVariant: 'original',
    },
  ],
})

// For example, in a request handler:
export async function fetch(request: Request) {
  let response = await handler.serve(request)
  return response ?? new Response('Not Found', { status: 404 })
}
```

Resolving development assets:

```ts
import { createDevAssetResolver } from 'remix/assets'

let resolveAsset = createDevAssetResolver({
  root: '.',
  files: [
    {
      include: 'app/**/*.{png,jpg,jpeg}',
      variants: {
        original: (buffer) => buffer,
        thumbnail: async (buffer) => {
          let { generateThumbnail } = await import('./generate-thumbnail.ts')
          return await generateThumbnail(buffer)
        },
      },
      defaultVariant: 'original',
    },
  ],
})

let entry = resolveAsset('app/entry.tsx')
entry?.href // '/app/entry.tsx'
entry?.preloads // ['/app/entry.tsx']

let thumbnail = resolveAsset('app/images/logo.png', 'thumbnail')
thumbnail?.href // '/__@files/app/images/logo.png?@thumbnail'
```

### Workspace Access

To handle files from outside the project root, you can configure the `workspaceRoot` option.

```ts
import { build } from 'remix/assets'

await build({
  scripts: ['app/entry.tsx'],
  workspaceRoot: '../..',
  // ...
})
```

In development you can also configure the optional `workspaceAllow` and `workspaceDeny` patterns that replace the top-level `allow` and `deny` patterns.

```ts
import { createDevAssetsHandler } from 'remix/assets'

let handler = createDevAssetsHandler({
  allow: ['app/**', '**/node_modules/**'],
  workspaceRoot: '../..',
  workspaceAllow: ['packages/*/src/**/*', '**/node_modules/**'],
})
```

## Related Packages

- [assets-middleware](https://github.com/remix-run/remix/tree/main/packages/assets-middleware)
- [dev-assets-middleware](https://github.com/remix-run/remix/tree/main/packages/dev-assets-middleware)
- [fetch-router](https://github.com/remix-run/remix/tree/main/packages/fetch-router)

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
