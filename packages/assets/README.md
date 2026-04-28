# assets

Fetch-based server for compiling browser JS/TS and CSS assets on demand.

## Features

- **On-Demand Compilation** - Compile browser scripts and styles on demand
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

Use `createAssetServer` to serve browser JS/TS and CSS assets from a URL namespace in your app.

```ts
import { createRouter } from 'remix/fetch-router'
import { createAssetServer } from 'remix/assets'

let assetServer = createAssetServer({
  fileMap: {
    '/assets/app/*path': 'app/*path',
    '/assets/npm/*path': 'node_modules/*path',
  },
  allow: ['app/assets/**', 'node_modules/**'],
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
  fileMap: {
    '/assets/app/*path': 'app/*path',
    '/assets/npm/*path': 'node_modules/*path',
  },
  allow: ['app/assets/**', 'node_modules/**'],
})
```

## Access Control

You must provide an `allow` list to specify which files are allowed to be served. `deny` is optional and takes precedence over `allow`.

```ts
import { createAssetServer } from 'remix/assets'

let assetServer = createAssetServer({
  fileMap: { '/assets/app/*path': 'app/*path' },
  allow: ['app/assets/**'],
  deny: ['app/**/*.server.*'],
})
```

Rules for `allow` and `deny` are file paths or globs. Relative values are resolved from `rootDir`. Absolute file paths match exactly, and absolute directory paths also match their descendants.

## File Map

Use `fileMap` to map public URLs to file paths on disk. The keys are public URL patterns, and the values are root-relative file path patterns.

```ts
import { createAssetServer } from 'remix/assets'

let assetServer = createAssetServer({
  fileMap: {
    '/assets/app/*path': 'app/*path',
    '/assets/packages/*path': '../packages/*path',
  },
  allow: ['app/assets/**', '../packages/**'],
})
```

`fileMap` entries use [`route-pattern`](https://github.com/remix-run/remix/tree/main/packages/route-pattern) syntax for both URL and file patterns. Wildcards must be named, and the same params must appear in both patterns so imports can be rewritten back to public URLs.

### File watching

The file system is watched by default so source changes are picked up without requiring a server restart.

```ts
import { createAssetServer } from 'remix/assets'

let assetServer = createAssetServer({
  fileMap: { '/assets/app/*path': 'app/*path' },
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
  fileMap: { '/assets/app/*path': 'app/*path' },
  allow: ['app/assets/**', 'app/node_modules/**'],
  watch: false,
})
```

You can optionally provide an array of glob patterns to the `watch.ignore` option:

```ts
import { createAssetServer } from 'remix/assets'

let assetServer = createAssetServer({
  fileMap: { '/assets/app/*path': 'app/*path' },
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

By default, assets are served at stable URLs with ETags and `Cache-Control: no-cache`. Responses are cached for the lifetime of the asset server instance.

If you want clients to cache assets aggressively without revalidation, you can opt into source-based fingerprinting.

```ts
import { createAssetServer } from 'remix/assets'

let assetServer = createAssetServer({
  fileMap: { '/assets/app/*path': 'app/*path' },
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
  fileMap: { '/assets/app/*path': 'app/*path' },
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
  fileMap: { '/assets/app/*path': 'app/*path' },
  allow: ['app/assets/**'],
  sourceMaps: 'external',
})
```

By default, sourcemap `sources` use URLs so they're presented alongside the compiled output in your browser's developer tools. You can also use file system paths instead with `sourceMapSourcePaths`:

```ts
import { createAssetServer } from 'remix/assets'

let assetServer = createAssetServer({
  fileMap: { '/assets/app/*path': 'app/*path' },
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
  fileMap: { '/assets/app/*path': 'app/*path' },
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
  fileMap: { '/assets/app/*path': 'app/*path' },
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
  fileMap: { '/assets/app/*path': 'app/*path' },
  allow: ['app/assets/**'],
  scripts: {
    external: ['my-external-import'],
  },
})
```

## CSS Imports

Relative CSS `@import` rules are rewritten to asset server URLs. External `@import` URLs are left unchanged automatically. `url()` references are preserved as authored.

```css
/* Rewritten to asset server URL: */
@import './reset.css';
/* External URL: */
@import 'https://fonts.googleapis.com/css2?family=Inter';
```

## Error Handling

Use `onError` to report unexpected compilation failures and/or return a custom response.

```ts
import { createAssetServer } from 'remix/assets'

let assetServer = createAssetServer({
  fileMap: { '/assets/app/*path': 'app/*path' },
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
