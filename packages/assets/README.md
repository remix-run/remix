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

### Asset Imports

You can generate static TypeScript files that export URLs directly, making them easily available and type safe across server, browser and test environments.

```ts
import * as entryAsset from '#assets/app/entry.tsx'
entryAsset.href // '/assets/entry-ABC123.js'
entryAsset.preloads // ['/assets/entry-ABC123.js', '/assets/app-DEF456.js', '/assets/utils-GHI789.js']

import * as imageAsset from '#assets/app/images/logo.png'
imageAsset.href // '/assets/logo-ABC123.jpg'
imageAsset.variants.thumbnail.href // '/assets/logo-@thumbnail-ABC123.jpg'
```

These imports don't require a build step to resolve — they point to real files on disk generated in the `.assets/` directory by default.

You can watch for source file changes and regenerate asset files during development:

```ts
import { codegenWatch } from 'remix/assets'

let watcher = await codegenWatch({
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
})
```

This is also handled automatically when using the assets development handler or `remix/dev-assets-middleware`.

You can also generate the files once (e.g. as part of a build step):

```ts
import { codegen } from 'remix/assets'

await codegen({
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
})
```

Generated files are placed in `.assets/` by default. Assets found via `scripts` get an `href` and `preloads` array, while assets found via `files` get an `href`, or when variants are configured, an `href` for the default variant (if present) and a `variants` object:

```ts
// .assets/app/entry.tsx.dev.ts
export const href = '/app/entry.tsx'
export const preloads = ['/app/entry.tsx']

// .assets/app/images/logo.png.dev.ts
export const href = '/__@files/app/images/logo.png?@card'
export const variants = {
  thumbnail: { href: '/__@files/app/images/logo.png?@thumbnail' },
  card: { href: '/__@files/app/images/logo.png?@card' },
  hero: { href: '/__@files/app/images/logo.png?@hero' },
}
```

To support convenient importing of these files, configure [subpath imports](https://nodejs.org/api/packages.html#subpath-imports) in `package.json` to route `#assets/*` to the generated files, selecting `.build.ts` asset files by default, and `.dev.ts` in development and test environments:

```json
{
  "imports": {
    "#assets/*": {
      "development": "./.assets/*.dev.ts",
      "test": "./.assets/*.dev.ts",
      "default": "./.assets/*.build.ts"
    }
  }
}
```

To resolve the `development` condition, pass `--conditions=development` to Node.js (e.g. `NODE_OPTIONS='--conditions=development'`).

You can also configure TypeScript to resolve using the `development` condition so that the more lightweight `.dev.ts` files are used instead of the heavier `.build.ts` files, allowing for type checking without a full build.

```json
{
  "compilerOptions": {
    "customConditions": ["development"]
  }
}
```

To verify generated files are up to date (e.g. in CI):

```ts
import { codegenCheck } from 'remix/assets'

let result = await codegenCheck({ scripts: ['app/entry.tsx'], files: [...] })
result.missing // source files with no generated file
result.stale // generated files with no matching source
result.outdated // generated files whose content is out of date
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
