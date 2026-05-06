# assets

Fetch-based server for compiling browser assets on demand.

## Features

- **On-Demand Compilation** - Compile browser scripts and styles on demand
- **File Serving** - Serve configured file assets like images and fonts with optional transforms
- **Custom File Mapping** - Define patterns for mapping public URLs to file paths on disk
- **Access Control** - Control exactly which files can be served with allow and deny rules
- **Preloads** - Generate preload URLs for scripts and styles based on imports
- **Caching** - Conservative caching by default with stable URLs, ETags, and revalidation
- **Optional Fingerprinting** - Source-based fingerprinted URLs for long-lived browser caching
- **Source Maps** - Serve inline or external sourcemaps

## Installation

```sh
npm i remix
```

## Usage

Use `createAssetServer` to serve browser assets from a URL namespace in your app.

```ts
import { createRouter } from 'remix/fetch-router'
import { createAssetServer } from 'remix/assets'

let assetServer = createAssetServer({
  basePath: '/assets',
  fileMap: {
    '/app/*path': 'app/*path',
    '/npm/*path': 'node_modules/*path',
  },
  allow: ['app/assets/**', 'node_modules/**'],
  files: {
    extensions: ['.svg', '.png', '.jpg', '.jpeg', '.woff2'],
  },
})

let router = createRouter()

router.get('/assets/*', ({ request }) => {
  return assetServer.fetch(request)
})
```

This example gives you an `/assets/*` endpoint that serves compiled browser assets from `app/assets` and `node_modules`.

## Root Directory

Use `rootDir` to specify the root directory of the asset server, which is used to resolve relative file paths. Defaults to `process.cwd()`.

```ts
import * as path from 'node:path'
import { createAssetServer } from 'remix/assets'

let assetServer = createAssetServer({
  rootDir: path.resolve(import.meta.dirname, '..'),
  basePath: '/assets',
  fileMap: {
    '/app/*path': 'app/*path',
    '/npm/*path': 'node_modules/*path',
  },
  allow: ['app/assets/**', 'node_modules/**'],
})
```

## Access Control

You must provide an `allow` list to specify which files are allowed to be served. `deny` is optional and takes precedence over `allow`.

```ts
import { createAssetServer } from 'remix/assets'

let assetServer = createAssetServer({
  basePath: '/assets',
  fileMap: { '/app/*path': 'app/*path' },
  allow: ['app/assets/**'],
  deny: ['app/**/*.server.*'],
})
```

Rules for `allow` and `deny` are file paths or globs. Relative values are resolved from `rootDir`. Absolute file paths match exactly, and absolute directory paths also match their descendants.

## File Map

Use `fileMap` to map public URLs to file paths on disk. `basePath` defines the shared public mount point, and the `fileMap` keys are URL patterns relative to that base path. The values are root-relative file path patterns.

```ts
import { createAssetServer } from 'remix/assets'

let assetServer = createAssetServer({
  basePath: '/assets',
  fileMap: {
    '/app/*path': 'app/*path',
    '/packages/*path': '../packages/*path',
  },
  allow: ['app/assets/**', '../packages/**'],
})
```

`fileMap` entries use [`route-pattern`](https://github.com/remix-run/remix/tree/main/packages/route-pattern) syntax for both URL and file patterns. Wildcards must be named, and the same params must appear in both patterns so imports can be rewritten back to public URLs. For example, with `basePath: '/assets'`, a `fileMap` key of `'/app/*path'` is served at `/assets/app/*path`.

### File watching

The file system is watched by default so source changes are picked up without requiring a server restart.

```ts
import { createAssetServer } from 'remix/assets'

let assetServer = createAssetServer({
  basePath: '/assets',
  fileMap: { '/app/*path': 'app/*path' },
  allow: ['app/assets/**', 'app/node_modules/**'],
})
```

When finished with the asset server, call `await assetServer.close()` to clean up the file watcher.

```ts
await assetServer.close()
```

You can disable file watching if the files on disk won't change, or if watching is managed at a higher level (e.g. Node's `--watch` flag).

```ts
import { createAssetServer } from 'remix/assets'

let assetServer = createAssetServer({
  basePath: '/assets',
  fileMap: { '/app/*path': 'app/*path' },
  allow: ['app/assets/**', 'app/node_modules/**'],
  watch: false,
})
```

You can optionally provide an array of glob patterns to the `watch.ignore` option:

```ts
import { createAssetServer } from 'remix/assets'

let assetServer = createAssetServer({
  basePath: '/assets',
  fileMap: { '/app/*path': 'app/*path' },
  allow: ['app/assets/**', 'app/node_modules/**'],
  watch: {
    ignore: ['**/node_modules/**'],
  },
})
```

## Hrefs

Use `assetServer.getHref()` when you need the public URL for a served asset. You can provide a root-relative or absolute file path, or a `file://` URL.

```ts
let src = await assetServer.getHref('app/assets/entry.tsx')
// '/assets/app/assets/entry.tsx'
```

For configured `files` assets, you can also pass a `transform` pipeline to build a request URL with custom file transforms. Basic transforms are written as strings, while dynamic transforms use `[name, param]` tuples.

```ts
let src = await assetServer.getHref('app/assets/logo.png', {
  transform: ['grayscale', ['resize', { height: 100 }]],
})
// '/assets/app/assets/logo.png?transform=["grayscale",["resize",{"height":100}]]'
```

## Preloads

Use `assetServer.getPreloads()` when rendering HTML so you can turn the returned URLs into `<link rel="modulepreload">`, stylesheet preload tags, or `Link` headers for one or more assets and their dependencies. You can provide root-relative or absolute file paths, or `file://` URLs.

```ts
let preloads = await assetServer.getPreloads(['app/assets/entry.tsx', 'app/assets/search.tsx'])
// [
//   '/assets/app/assets/entry.tsx',
//   '/assets/app/assets/search.tsx',
//   '/assets/app/assets/utils.ts',
//   '/assets/npm/@remix-run/ui/index.js',
//   ...etc
// ]
```

## Fingerprinting

By default, assets are served at stable URLs with ETags and `Cache-Control: no-cache`.

If you want clients to cache assets aggressively without revalidation, you can opt into source-based fingerprinting.

```ts
import { createAssetServer } from 'remix/assets'

let assetServer = createAssetServer({
  basePath: '/assets',
  fileMap: { '/app/*path': 'app/*path' },
  allow: ['app/assets/**'],
  watch: false,
  fingerprint: {
    buildId: process.env.GITHUB_SHA,
  },
})
```

When fingerprinting is enabled, assets use a `.@<fingerprint>` segment before the file extension and are served with `Cache-Control: public, max-age=31536000, immutable`.

Source fingerprints are based on the original file contents and the build ID. The build ID must change for each deployment so that fingerprinted assets are invalidated together. This fingerprinting strategy assumes that files on disk won't change, so fingerprinting requires `watch: false`.

## Target

Use `target` to lower emitted syntax to a specific browser support policy and/or ECMAScript version.

```ts
import { createAssetServer } from 'remix/assets'

let assetServer = createAssetServer({
  basePath: '/assets',
  fileMap: { '/app/*path': 'app/*path' },
  allow: ['app/assets/**'],
  target: {
    chrome: '109',
    ios: '15.6',
    es: '2020',
  },
})
```

Supported target options are `chrome`, `firefox`, `safari`, `edge`, `opera`, `ios`, `samsung`, and `es` (ECMAScript version).

### Source Maps

Enable sourcemaps with either `'external'` or `'inline'` using `sourceMaps`:

```ts
import { createAssetServer } from 'remix/assets'

let assetServer = createAssetServer({
  basePath: '/assets',
  fileMap: { '/app/*path': 'app/*path' },
  allow: ['app/assets/**'],
  sourceMaps: 'external',
})
```

By default, sourcemap `sources` use URLs so they're presented alongside the compiled output in your browser's developer tools. You can also use file system paths instead with `sourceMapSourcePaths`:

```ts
import { createAssetServer } from 'remix/assets'

let assetServer = createAssetServer({
  basePath: '/assets',
  fileMap: { '/app/*path': 'app/*path' },
  allow: ['app/assets/**'],
  sourceMaps: 'inline',
  sourceMapSourcePaths: 'absolute',
})
```

### Minification

Enable minification with `minify`:

```ts
import { createAssetServer } from 'remix/assets'

let assetServer = createAssetServer({
  basePath: '/assets',
  fileMap: { '/app/*path': 'app/*path' },
  allow: ['app/assets/**'],
  minify: true,
})
```

## Script Options

### Define

Use `scripts.define` to replace global identifiers with constant expressions.

```ts
import { createAssetServer } from 'remix/assets'

let assetServer = createAssetServer({
  basePath: '/assets',
  fileMap: { '/app/*path': 'app/*path' },
  allow: ['app/assets/**', 'app/node_modules/**'],
  scripts: {
    define: {
      'process.env.NODE_ENV': '"production"',
    },
  },
})
```

Values are injected exactly as defined, so string literals must include their own quotes, e.g. `process.env.NODE_ENV` must be `"production"` rather than `production`.

### External Imports

Use `scripts.external` to leave specific import specifiers unchanged by providing an array of specifiers.

```ts
import { createAssetServer } from 'remix/assets'

let assetServer = createAssetServer({
  basePath: '/assets',
  fileMap: { '/app/*path': 'app/*path' },
  allow: ['app/assets/**'],
  scripts: {
    external: ['my-external-import'],
  },
})
```

## File Options

Use `files` to serve additional leaf assets like images and fonts. File extensions must include the leading dot and are only served when explicitly configured.

```ts
import { createAssetServer } from 'remix/assets'

let assetServer = createAssetServer({
  basePath: '/assets',
  fileMap: { '/app/*path': 'app/*path' },
  allow: ['app/assets/**'],
  files: {
    extensions: ['.svg', '.png', '.jpg', '.jpeg', '.woff2'],
  },
})
```

JavaScript/TypeScript and CSS extensions not supported in `files.extensions` as they are not leaf assets and have their own module systems.

### File transforms

Files can optionally be transformed before serving.

Use `files.transforms` for named transforms that callers can opt into per request, provided via the `transform` option when calling `assetServer.getHref()`.

```ts
import { createAssetServer, defineFileTransform } from 'remix/assets'
import sharp from 'sharp'

let assetServer = createAssetServer({
  basePath: '/assets',
  fileMap: { '/app/*path': 'app/*path' },
  allow: ['app/assets/**'],
  files: {
    extensions: ['.svg', '.png', '.jpg', '.jpeg'],
    transforms: {
      webp: defineFileTransform({
        extensions: ['.png', '.jpg', '.jpeg'],
        async transform(bytes) {
          return {
            content: await sharp(bytes).webp({ quality: 80 }).toBuffer(),
            extension: '.webp',
          }
        },
      }),
    },
  },
})

let imageUrl = await assetServer.getHref('app/assets/photo.jpg', {
  transform: ['webp'],
})
```

Transforms can also accept a single param value, provided as a `[name, param]` tuple in the `transform` array when calling `assetServer.getHref()`.

```ts
import { createAssetServer, defineFileTransform } from 'remix/assets'
import { string } from 'remix/data-schema'

let assetServer = createAssetServer({
  basePath: '/assets',
  fileMap: { '/app/*path': 'app/*path' },
  allow: ['app/assets/**'],
  files: {
    extensions: ['.svg', '.png', '.jpg', '.jpeg'],
    transforms: {
      recolor: defineFileTransform({
        extensions: ['.svg'],
        paramSchema: string()
          .refine(
            (value) => /^#?(?:[\da-f]{3,4}|[\da-f]{6}(?:[\da-f]{2})?)$/i.test(value),
            'Expected a hex color, with or without a leading #',
          )
          .transform((value) => `${!value.startsWith('#') ? '#' : ''}${value}`),
        async transform(bytes, { param }) {
          let svg = new TextDecoder().decode(bytes)
          return svg.replaceAll('currentColor', param)
        },
      }),
    },
  },
})

let imageUrl = await assetServer.getHref('app/assets/logo.svg', {
  transform: [['recolor', '#8B5CF6']],
})
```

#### Global file transforms

Use `files.globalTransforms` to define transforms that should always happen before a file is served. These transforms are run after any request-level transforms for all configured file extensions, and can return `null` to skip themselves for a given input.

```ts
import { createAssetServer } from 'remix/assets'
import { optimize as optimizeSvg } from 'svgo'

let assetServer = createAssetServer({
  basePath: '/assets',
  fileMap: { '/app/*path': 'app/*path' },
  allow: ['app/assets/**'],
  files: {
    extensions: ['.svg', '.png', '.jpg', '.jpeg'],
    globalTransforms: [
      {
        extensions: ['.svg'],
        async transform(bytes) {
          let svg = new TextDecoder().decode(bytes)
          return optimizeSvg(svg, { multipass: true }).data
        },
      },
    ],
  },
})
```

#### File transform caching

Use `files.cache` to store transformed file outputs via a [`file-storage`](https://github.com/remix-run/remix/tree/main/packages/file-storage) backend.

Without `files.cache`, transformed file outputs are recomputed per request.

If `fingerprint.buildId` is set, the file cache can be reused across server restarts for the same build.

```ts
import * as path from 'node:path'
import { createAssetServer } from 'remix/assets'
import { createFsFileStorage } from 'remix/file-storage/fs'

let assetServer = createAssetServer({
  basePath: '/assets',
  fileMap: { '/app/*path': 'app/*path' },
  allow: ['app/assets/**'],
  files: {
    extensions: ['.svg'],
    cache: createFsFileStorage(path.resolve('.tmp/assets-cache')),
  },
})
```

#### Request transform limits

Use `files.maxRequestTransforms` to cap request transform pipelines. It defaults to `5`.

```ts
import { createAssetServer } from 'remix/assets'

let assetServer = createAssetServer({
  basePath: '/assets',
  fileMap: { '/app/*path': 'app/*path' },
  allow: ['app/assets/**'],
  files: {
    extensions: ['.svg'],
    transforms: {
      /*...*/
    },
    maxRequestTransforms: 5,
  },
})
```

## CSS Imports

Relative CSS `@import` rules and `url()` references are rewritten to asset server URLs.

```css
/* Rewritten to asset server URLs: */
@import './reset.css';
.selector {
  background-image: url('../images/logo.svg');
}

/* External URLs: */
@import 'https://fonts.googleapis.com/css2?family=Inter';
.selector {
  background-image: url('https://example.com/logo.svg');
}
```

File transforms can also be applied to relative CSS `url()` references:

```css
.selector {
  background-image: url('../images/logo.png?transform=[["width",100]]');
}
```

## Error Handling

Use `onError` to report unexpected compilation failures and/or return a custom response.

```ts
import { createAssetServer } from 'remix/assets'

let assetServer = createAssetServer({
  basePath: '/assets',
  fileMap: { '/app/*path': 'app/*path' },
  allow: ['app/assets/**'],
  onError(error) {
    console.error('Failed to build client assets', error)
    return new Response('Client asset build failed', { status: 500 })
  },
})
```

If `onError` returns nothing, the asset server responds with the default `500 Internal Server Error` response.

## Related Packages

- [`fetch-router`](https://github.com/remix-run/remix/tree/main/packages/fetch-router) - A Fetch-based router that pairs naturally with `assets`
- [`route-pattern`](https://github.com/remix-run/remix/tree/main/packages/route-pattern) - Route-pattern syntax for URL and route file matching

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
