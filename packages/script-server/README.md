# script-server

Fetch-based server for compiling browser JavaScript and TypeScript modules on demand.

## Features

- **Route-Based Serving** - Map public URL patterns to files on disk
- **Access Control** - Control exactly which files can be served with allow and deny rules
- **Preloads** - Generate modulepreload URLs for `<link>` tags or `Link` headers
- **Caching** - Conservative caching by default with stable URLs, ETags, and revalidation
- **Optional Fingerprinting** - Source-based fingerprinted URLs for long-lived browser caching
- **Source Maps** - Server either inline or external sourcemaps

## Installation

```sh
npm i remix
```

## Usage

Use `script-server` to serve browser modules from a URL namespace in your app.

```ts
import * as path from 'node:path'
import { createRouter } from 'remix/fetch-router'
import { createScriptServer } from 'remix/script-server'

let root = path.resolve(import.meta.dirname, '..')

let scriptServer = createScriptServer({
  root,
  routes: [
    { urlPattern: '/scripts/app/*path', filePattern: 'app/*path' },
    { urlPattern: '/scripts/npm/*path', filePattern: 'node_modules/*path' },
  ],
  allow: ['app/client/**', 'app/shared/**', 'node_modules/**'],
})

let router = createRouter()

router.get('/scripts/*', ({ request }) => {
  return scriptServer.fetch(request)
})
```

This example gives you a `/scripts/*` endpoint that serves compiled browser JS modules from
`app/client`, `app/shared`, and `node_modules`.

## Routes

Use `routes` to map public URLs to file-space paths.

```ts
import { createScriptServer } from 'remix/script-server'

let scriptServer = createScriptServer({
  root,
  routes: [
    { urlPattern: '/scripts/app/*path', filePattern: 'app/*path' },
    { urlPattern: '/scripts/packages/*path', filePattern: '../packages/*path' },
  ],
  allow: ['app/client/**', 'app/shared/**', '../packages/**'],
})
```

Route patterns use [`route-pattern`](https://github.com/remix-run/remix/tree/main/packages/route-pattern) syntax for both URLs and file paths. Wildcards must be named, and the same params must appear in both patterns so imports can be rewritten back to public URLs.

## Access Control

You must provide an `allow` list to specify which files are allowed to be served. `deny` is optional and takes precedence over `allow`.

```ts
import { createScriptServer } from 'remix/script-server'

let scriptServer = createScriptServer({
  root,
  routes: [{ urlPattern: '/scripts/app/*path', filePattern: 'app/*path' }],
  allow: ['app/client/**', 'app/shared/**'],
  deny: ['app/**/*.server.*'],
})
```

Rules for `allow` and `deny` are file paths or globs. Relative values are resolved from `root`. Absolute file paths match exactly, and absolute directory paths also match their descendants.

### Watch Mode

To pick up changes to source files without requiring a server restart, enable `watch` mode.

```ts
import { createScriptServer } from 'remix/script-server'

let scriptServer = createScriptServer({
  root,
  routes: [{ urlPattern: '/scripts/app/*path', filePattern: 'app/*path' }],
  allow: ['app/client/**', 'app/shared/**', 'app/node_modules/**'],
  watch: true,
})
```

You can optionally provide an array of glob patterns to the `ignore` option:

```ts
import { createScriptServer } from 'remix/script-server'

let scriptServer = createScriptServer({
  root,
  routes: [{ urlPattern: '/scripts/app/*path', filePattern: 'app/*path' }],
  allow: ['app/client/**', 'app/shared/**', 'app/node_modules/**'],
  watch: {
    ignore: ['**/node_modules/**'],
  },
})
```

## Preloads

Use `preloads()` when rendering HTML so you can turn the returned URLs into `<link rel="modulepreload">` tags or `Link` headers for one or more stable module URLs and their transitive dependencies. Pass the same stable non-fingerprinted request paths you would use in your `<script type="module" src="...">` tags.

```ts
let urls = await scriptServer.preloads('/scripts/app/client/entries/entry.tsx')
// [
//   '/scripts/app/client/entries/entry.tsx',
//   '/scripts/app/shared/utils.ts.@abc123',
//   '/scripts/npm/@remix-run/component/index.js.@def456',
//   ...etc
// ]

let combinedUrls = await scriptServer.preloads([
  '/scripts/app/client/entries/entry.tsx',
  '/scripts/app/client/entries/search.tsx',
])
```

## Caching and Fingerprinting

By default, modules are served at stable URLs with ETags and `Cache-Control: no-cache`. Responses are cached for the lifetime of the `script-server` instance, so source changes are picked up when your app recreates the server (for example, after a dev-server restart).

If you want the browser to stop revalidating non-entry module URLs, you can opt into source fingerprinting.

```ts
import { createScriptServer } from 'remix/script-server'

let scriptServer = createScriptServer({
  root,
  routes: [{ urlPattern: '/scripts/app/*path', filePattern: 'app/*path' }],
  allow: ['app/client/**', 'app/shared/**'],
  entryPoints: ['app/client/entries/*'],
  fingerprintInternalModules: {
    buildId: process.env.GITHUB_SHA,
  },
})
```

Modules matching `entryPoints` keep stable non-fingerprinted URLs.

Any module you need to reference directly from app code (e.g. in a `<script type="module" src="...">` tag) must be included in `entryPoints`. All other served modules are rewritten to URLs suffixed with `.@<fingerprint>` and served with `Cache-Control: public, max-age=31536000, immutable` by default.

Source fingerprints are based on `sourceText + buildId`. The build ID must change for each deployment so that fingerprinted modules are invalidated together.

You can also override the default cache header for fingerprinted internal modules:

```ts
let scriptServer = createScriptServer({
  root,
  routes: [{ urlPattern: '/scripts/app/*path', filePattern: 'app/*path' }],
  allow: ['app/client/**', 'app/shared/**'],
  entryPoints: ['app/client/entries/*'],
  fingerprintInternalModules: {
    buildId: process.env.GITHUB_SHA,
    cacheControl: 'public, max-age=600',
  },
})
```

The caching strategy set by `fingerprintInternalModules` assumes that files on disk won't change, so it cannot be used together with `watch`.

## Minification

Enable minification with the `minify` option:

```ts
import { createScriptServer } from 'remix/script-server'

let scriptServer = createScriptServer({
  root,
  routes: [{ urlPattern: '/scripts/app/*path', filePattern: 'app/*path' }],
  allow: ['app/client/**', 'app/shared/**'],
  minify: true,
})
```

## Source Maps

Enable sourcemaps with either `'external'` or `'inline'`:

```ts
import { createScriptServer } from 'remix/script-server'

let scriptServer = createScriptServer({
  root,
  routes: [{ urlPattern: '/scripts/app/*path', filePattern: 'app/*path' }],
  allow: ['app/client/**', 'app/shared/**'],
  sourceMaps: 'external',
})
```

By default, sourcemap `sources` use URLs so they're presented alongside the compiled output in your browser's developer tools. You can also use file system paths instead:

```ts
import { createScriptServer } from 'remix/script-server'

let scriptServer = createScriptServer({
  root,
  routes: [{ urlPattern: '/scripts/app/*path', filePattern: 'app/*path' }],
  allow: ['app/client/**', 'app/shared/**'],
  sourceMaps: 'inline',
  sourceMapSourcePaths: 'absolute',
})
```

## Error Handling

Use `onError` to report unexpected compilation failures or return a custom response.

```ts
import { createScriptServer } from 'remix/script-server'

let scriptServer = createScriptServer({
  root,
  routes: [{ urlPattern: '/scripts/app/*path', filePattern: 'app/*path' }],
  allow: ['app/client/**', 'app/shared/**'],
  onError(error) {
    console.error('Failed to build client module', error)
    return new Response('Client module build failed', { status: 500 })
  },
})
```

If `onError` returns nothing, `script-server` responds with the default `500 Internal Server Error` response.

## External Imports

Use `external` to leave specific import specifiers unchanged by providing an array of specifiers.

```ts
import { createScriptServer } from 'remix/script-server'

let scriptServer = createScriptServer({
  root,
  routes: [{ urlPattern: '/scripts/app/*path', filePattern: 'app/*path' }],
  allow: ['app/client/**', 'app/shared/**'],
  external: ['my-external-import'],
})
```

## Related Packages

- [`fetch-router`](https://github.com/remix-run/remix/tree/main/packages/fetch-router) - A Fetch-based router that pairs naturally with `script-server`
- [`route-pattern`](https://github.com/remix-run/remix/tree/main/packages/route-pattern) - Route-pattern syntax for URL and route file matching

## Related Work

- [esbuild](https://esbuild.github.io/) - Fast ESM transform and resolution engine used internally by `script-server`
- [Import Maps](https://wicg.github.io/import-maps/) - A complementary browser-native way to control module specifier resolution

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
