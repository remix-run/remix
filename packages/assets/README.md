# @remix-run/assets

Core package for unbundled asset handling.

## Installation

```sh
npm install @remix-run/assets
```

## Usage

### Dev handler

```ts
import { createDevAssetsHandler } from '@remix-run/assets'

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
import { build } from '@remix-run/assets'

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
import { build } from '@remix-run/assets'

await build({
  scripts: ['app/entry.tsx'],
})
```

Runtime behavior:

- `assets.get('app/entry.tsx')` resolves the script output.

### File handling (images/fonts/etc)

Use `files` rules to match source paths, run transforms, and optionally define named variants.

```ts
import { build } from '@remix-run/assets'
import type { FilesConfig } from '@remix-run/assets'
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

- **build(options)** – Programmatic production build: discovers module graph from entry points, transforms and writes 1:1 output, optional manifest.
- **createDevAssetsHandler(options)** – Stateful handler; owns module graph and caches. Returns `{ serve(request) => Promise<Response | null> }`.
- **createDevAssets({ root, scripts?, files? })** – Dev-mode assets API (`get(entryPath, variant?)` → `{ href, chunks } | null`). Used by the middleware to set `context.assets`.
- **createAssets<FilesConfig>(manifest, { baseUrl? })** – Production assets API from manifest (`get(entryPath, variant?)` → `{ href, chunks } | null`). Provide an optional generic (e.g. `createAssets<typeof files>(...)`) to narrow `.get()` variants.
- **FilesConfig / FileRule / FileTransform** – File rules and transforms used by `build({ files })` and dev file handling.

## Related Packages

- [dev-assets-middleware](https://github.com/remix-run/remix/tree/main/packages/dev-assets-middleware) – Development middleware that uses this package to transform and serve source files.
- [assets-middleware](https://github.com/remix-run/remix/tree/main/packages/assets-middleware) – Production middleware for serving pre-built assets; consumes the manifest produced by `build()`.
- [fetch-router](https://github.com/remix-run/remix/tree/main/packages/fetch-router) – Router for the web Fetch API (used with the middleware above).

## License

MIT
