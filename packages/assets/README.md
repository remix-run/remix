# assets

Core package for unbundled asset handling.

## Installation

```sh
npm i remix
```

## Usage

### Dev handler

```ts
import { createDevAssetsHandler } from 'remix/assets'

let handler = createDevAssetsHandler({
  root: '.',
  allow: ['app/**'],
  workspaceRoot: '..',
  workspaceAllow: ['**/node_modules/**'],
})

// In your request handler:
let response = await handler.serve(request)
if (response) return response
// ...
```

### Production build

```ts
import { build } from 'remix/assets'

await build({
  scripts: ['app/entry.tsx'],
  root: '.',
  outDir: './build/assets',
  minify: true,
  sourcemap: 'external',
  fileNames: '[dir]/[name]-[hash]',
  manifest: './build/assets-manifest.json',
})
```

### Script handling (JS/TS module graph)

Use `scripts` to specify the entry points for the script graph.

```ts
import { build } from 'remix/assets'

await build({
  scripts: ['app/entry.tsx'],
})
```

Runtime behavior:

- `assets.get('app/entry.tsx')` resolves the script output.

### File handling (images/fonts/etc)

Use `files` rules to match source paths, run transforms, and optionally define named variants.

```ts
import { build } from 'remix/assets'
import type { FilesConfig } from 'remix/assets'
import sharp from 'sharp'

let files: FilesConfig = [
  {
    include: 'app/images/**/*.{png,jpg,jpeg}',
    variants: {
      thumbnail: (data) => sharp(data).resize(200).jpeg({ quality: 80 }).toBuffer(),
      card: (data) => sharp(data).resize(600).jpeg({ quality: 85 }).toBuffer(),
    },
    defaultVariant: 'card',
  },
  {
    include: 'app/icons/**/*.svg',
    transform: (data) => data,
  },
]

await build({
  scripts: ['app/entry.tsx'],
  files,
  root: '.',
  outDir: './build/assets',
  manifest: './build/assets-manifest.json',
})
```

Runtime behavior:

- `assets.get('app/images/logo.png', 'thumbnail')` resolves a file variant.
- `assets.get('app/images/logo.png')` uses `defaultVariant` when configured.
- `assets.get('app/icons/logo.svg')` resolves a non-variant transformed file.
- Missing files or invalid variants return `null`.

Development behavior:

- `createDevAssets({ root, files })` emits `href`s under `/__@files/...`.
- File transforms/variants are resolved on-demand by the dev handler.

Production behavior:

- `build()` pre-generates file outputs and writes `manifest.files.outputs`.
- Production middleware reads the manifest and serves static hashed outputs (no runtime transforms).
- You can also create an assets API directly from a manifest with `createAssets(manifest, { baseUrl? })`.

## API

### `build(options)`

Builds script/file assets for production, writes outputs, and optionally writes a manifest.

### `createDevAssetsHandler(options)`

Creates a stateful development handler with `serve(request)` for on-demand transforms.

### `createDevAssets({ root, scripts?, files? })`

Creates a dev assets API where `assets.get(entryPath, variant?)` returns `{ href, chunks } | null`.

### `createAssets<FilesConfig>(manifest, { baseUrl? })`

Creates a production assets API from a build manifest. You can pass a generic
(`createAssets<typeof files>(...)`) to narrow allowed variants in `.get()`.

### `defineFiles(files)`

Helper for defining typed file rules/variants.

### Types

Exports include `BuildOptions`, `CreateDevAssetsHandlerOptions`, `CreateAssetsOptions`,
`CreateDevAssetsOptions`, `AssetManifest`, and file rule/transform types.

## Related Packages

- [dev-assets-middleware](https://github.com/remix-run/remix/tree/main/packages/dev-assets-middleware)
- [assets-middleware](https://github.com/remix-run/remix/tree/main/packages/assets-middleware)
- [fetch-router](https://github.com/remix-run/remix/tree/main/packages/fetch-router)

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
