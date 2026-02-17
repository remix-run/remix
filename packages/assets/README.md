# assets

Unbundled browser build tooling and development handler.

## Installation

```sh
npm i remix
```

## Usage

### Dev handler

```ts
import { createDevAssetsHandler } from 'remix/assets'

let handler = createDevAssetsHandler({
  allow: ['app/**', '**/node_modules/**'],
  files: [
    {
      include: 'app/**/*.{png,jpg,jpeg}',
      variants: {
        original: (buffer) => buffer,
        thumbnail: (buffer) => generateThumbnail(buffer),
      },
      defaultVariant: 'original',
    },
  ],
})

// In your request handler:
let response = await handler.serve(request)
if (response) return response
// ...
```

Resolving dev assets:

```ts
import { createDevAssets } from 'remix/assets'
import generateThumbnail from './generate-thumbnail.ts'

let assets = createDevAssets({
  allow: ['app/**', '**/node_modules/**'],
  files: [
    {
      include: 'app/**/*.{png,jpg,jpeg}',
      variants: {
        original: (buffer) => buffer,
        thumbnail: (buffer) => generateThumbnail(buffer),
      },
      defaultVariant: 'original',
    },
  ],
})
```

### Production build

```ts
import { build } from 'remix/assets'
import generateThumbnail from './generate-thumbnail.ts'

await build({
  scripts: ['app/entry.tsx'],
  files: [
    {
      include: 'app/**/*.{png,jpg,jpeg}',
      variants: {
        original: (buffer) => buffer,
        thumbnail: (buffer) => generateThumbnail(buffer),
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

### Workspace configuration

To serve files from outside the project root, you can configure the `workspaceRoot` option, along with optional `workspaceAllow` and `workspaceDeny` patterns that replace the top-level `allow` and `deny` patterns.

```ts
import { createDevAssetsHandler } from 'remix/assets'

let handler = createDevAssetsHandler({
  allow: ['app/**', '**/node_modules/**'],
  workspaceRoot: '../..',
  workspaceAllow: ['packages/*/src/**/*', '**/node_modules/**'],
})
```

## Related Packages

- [dev-assets-middleware](https://github.com/remix-run/remix/tree/main/packages/dev-assets-middleware)
- [assets-middleware](https://github.com/remix-run/remix/tree/main/packages/assets-middleware)
- [fetch-router](https://github.com/remix-run/remix/tree/main/packages/fetch-router)

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
