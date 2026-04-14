# assets

Fetch-based server for compiling browser JS/TS assets on demand.

## Features

- **Route-Based Serving** - Map public URL patterns to files on disk
- **Access Control** - Control exactly which files can be served with allow and deny rules
- **Preloads** - Generate modulepreload URLs for `<link>` tags or `Link` headers
- **Watch Mode** - Watch for file changes and invalidate cached scripts
- **Caching** - Conservative caching by default with stable URLs, ETags, and revalidation
- **Optional Fingerprinting** - Source-based fingerprinted URLs for long-lived browser caching
- **Source Maps** - Serve inline or external sourcemaps

## Installation

```sh
npm i remix
```

## Usage

Use `createAssetServer` to serve browser modules from a URL namespace in your app.

```ts
import * as path from 'node:path'
import { createRouter } from 'remix/fetch-router'
import { createAssetServer } from 'remix/assets'

let root = path.resolve(import.meta.dirname, '..')

let assetServer = createAssetServer({
  routes: [
    { urlPattern: '/assets/app/*path', filePattern: 'app/*path' },
    { urlPattern: '/assets/npm/*path', filePattern: 'node_modules/*path' },
  ],
  allow: ['app/client/**', 'app/shared/**', 'node_modules/**'],
})

let router = createRouter()

router.get('/assets/*', ({ request }) => {
  return assetServer.fetch(request)
})
```

This example gives you an `/assets/*` endpoint that serves compiled browser JS modules from
`app/client`, `app/shared`, and `node_modules`.

## Access Control

You must provide an `allow` list to specify which files are allowed to be served. `deny` is optional and takes precedence over `allow`.

```ts
import { createAssetServer } from 'remix/assets'

let assetServer = createAssetServer({
  routes: [{ urlPattern: '/assets/app/*path', filePattern: 'app/*path' }],
  allow: ['app/client/**', 'app/shared/**'],
  deny: ['app/**/*.server.*'],
})
```

Rules for `allow` and `deny` are file paths or globs. Relative values are resolved from `root`. Absolute file paths match exactly, and absolute directory paths also match their descendants.

## Routes

Use `routes` to map public URLs to file paths.

```ts
import { createAssetServer } from 'remix/assets'

let assetServer = createAssetServer({
  routes: [
    { urlPattern: '/assets/app/*path', filePattern: 'app/*path' },
    { urlPattern: '/assets/packages/*path', filePattern: '../packages/*path' },
  ],
  allow: ['app/client/**', 'app/shared/**', '../packages/**'],
})
```

Routes use [`route-pattern`](https://github.com/remix-run/remix/tree/main/packages/route-pattern) syntax for both URLs and file paths. Wildcards must be named, and the same params must appear in both patterns so imports can be rewritten back to public URLs.

## Hrefs

Use `assetServer.getHref()` when you need the public URL for a served asset. You can provide a root-relative or absolute file path, or a `file://` URL.

```ts
let src = await assetServer.getHref('app/client/entry.tsx')
// '/assets/app/client/entry.tsx'
```

## Preloads

Use `assetServer.getPreloads()` when rendering HTML so you can turn the returned URLs into `<link rel="modulepreload">` tags or `Link` headers for one or more assets and their dependencies. You can provide root-relative or absolute file paths, or `file://` URLs.

```ts
let preloads = await assetServer.getPreloads(['app/client/entry.tsx', 'app/client/search.tsx'])
// [
//   '/assets/app/client/entry.tsx',
//   '/assets/app/client/search.tsx',
//   '/assets/app/shared/utils.ts',
//   '/assets/npm/@remix-run/component/index.js',
//   ...etc
// ]
```

### Watch Mode

To pick up changes to source files without requiring a server restart, enable `watch` mode.

```ts
import { createAssetServer } from 'remix/assets'

let assetServer = createAssetServer({
  routes: [{ urlPattern: '/assets/app/*path', filePattern: 'app/*path' }],
  allow: ['app/client/**', 'app/shared/**', 'app/node_modules/**'],
  watch: true,
})
```

You can optionally provide an array of glob patterns to the `ignore` option:

```ts
import { createAssetServer } from 'remix/assets'

let assetServer = createAssetServer({
  routes: [{ urlPattern: '/assets/app/*path', filePattern: 'app/*path' }],
  allow: ['app/client/**', 'app/shared/**', 'app/node_modules/**'],
  watch: {
    ignore: ['**/node_modules/**'],
  },
})
```

When you enable watch mode, call `await assetServer.close()` when finished with the asset server or during shutdown so the file watcher is cleaned up properly.

```ts
await assetServer.close()
```

## Fingerprinting

By default, scripts are served at stable URLs with ETags and `Cache-Control: no-cache`. Responses are cached for the lifetime of the asset server instance.

If you want clients to cache scripts aggressively without revalidation, you can opt into source-based fingerprinting.

```ts
import { createAssetServer } from 'remix/assets'

let assetServer = createAssetServer({
  routes: [{ urlPattern: '/assets/app/*path', filePattern: 'app/*path' }],
  allow: ['app/client/**', 'app/shared/**'],
  fingerprint: {
    buildId: process.env.GITHUB_SHA,
  },
})
```

When fingerprinting is enabled, scripts use a `.@<fingerprint>` segment before the file extension and are served with `Cache-Control: public, max-age=31536000, immutable`.

Source fingerprints are based on the original file contents and the build ID. The build ID must change for each deployment so that fingerprinted modules are invalidated together. This fingerprinting strategy assumes that files on disk won't change, so it cannot be used together with `watch`.

## Script Options

### Minification

Enable minification with `scripts.minify`:

```ts
import { createAssetServer } from 'remix/assets'

let assetServer = createAssetServer({
  routes: [{ urlPattern: '/assets/app/*path', filePattern: 'app/*path' }],
  allow: ['app/client/**', 'app/shared/**'],
  scripts: {
    minify: true,
  },
})
```

### Target

Use `scripts.target` to lower emitted syntax to a specific ECMAScript version.

```ts
import { createAssetServer } from 'remix/assets'

let assetServer = createAssetServer({
  routes: [{ urlPattern: '/assets/app/*path', filePattern: 'app/*path' }],
  allow: ['app/client/**', 'app/shared/**'],
  scripts: {
    target: 'es2019',
  },
})
```

The default target is `esnext`, which means all syntax is preserved.

### Define

Use `scripts.define` to replace global identifiers with constant expressions.

```ts
import { createAssetServer } from 'remix/assets'

let assetServer = createAssetServer({
  routes: [{ urlPattern: '/assets/app/*path', filePattern: 'app/*path' }],
  allow: ['app/client/**', 'app/shared/**', 'app/node_modules/**'],
  scripts: {
    define: {
      'process.env.NODE_ENV': '"production"',
    },
    minify: true,
  },
})
```

Values are injected exactly as defined, so string literals must include their own quotes, e.g. `process.env.NODE_ENV` must be `"production"` rather than `production`.

### Source Maps

Enable sourcemaps with either `'external'` or `'inline'` using `scripts.sourceMaps`:

```ts
import { createAssetServer } from 'remix/assets'

let assetServer = createAssetServer({
  routes: [{ urlPattern: '/assets/app/*path', filePattern: 'app/*path' }],
  allow: ['app/client/**', 'app/shared/**'],
  scripts: {
    sourceMaps: 'external',
  },
})
```

By default, sourcemap `sources` use URLs so they're presented alongside the compiled output in your browser's developer tools. You can also use file system paths instead with `scripts.sourceMapSourcePaths`:

```ts
import { createAssetServer } from 'remix/assets'

let assetServer = createAssetServer({
  routes: [{ urlPattern: '/assets/app/*path', filePattern: 'app/*path' }],
  allow: ['app/client/**', 'app/shared/**'],
  scripts: {
    sourceMaps: 'inline',
    sourceMapSourcePaths: 'absolute',
  },
})
```

### External Imports

Use `scripts.external` to leave specific import specifiers unchanged by providing an array of specifiers.

```ts
import { createAssetServer } from 'remix/assets'

let assetServer = createAssetServer({
  routes: [{ urlPattern: '/assets/app/*path', filePattern: 'app/*path' }],
  allow: ['app/client/**', 'app/shared/**'],
  scripts: {
    external: ['my-external-import'],
  },
})
```

## Error Handling

Use `onError` to report unexpected compilation failures or return a custom response.

```ts
import { createAssetServer } from 'remix/assets'

let assetServer = createAssetServer({
  routes: [{ urlPattern: '/assets/app/*path', filePattern: 'app/*path' }],
  allow: ['app/client/**', 'app/shared/**'],
  onError(error) {
    console.error('Failed to build client module', error)
    return new Response('Client module build failed', { status: 500 })
  },
})
```

If `onError` returns nothing, the asset server responds with the default `500 Internal Server Error` response.

## Related Packages

- [`fetch-router`](https://github.com/remix-run/remix/tree/main/packages/fetch-router) - A Fetch-based router that pairs naturally with `assets`
- [`route-pattern`](https://github.com/remix-run/remix/tree/main/packages/route-pattern) - Route-pattern syntax for URL and route file matching

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
