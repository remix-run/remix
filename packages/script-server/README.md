# script-server

Compile browser JavaScript and TypeScript modules on demand. Map request URLs to files on disk, compile them as ESM, and serve them with configurable caching and optional fingerprinting.

## Features

- **Route-Based Serving** - Map public URL patterns to files on disk
- **Access Control** - Explicit allow and optional deny rules for served files
- **Preloads** - Generate `<link rel="modulepreload">` URLs or `Link` headers
- **Conservative Caching** - Stable URLs, ETags, and `Cache-Control: no-cache` by default
- **Optional Fingerprinting** - Source-based fingerprinted URLs for long-lived browser caching
- **File Storage Cache** - Reuse compiled modules across server restarts with a `buildId` and file storage backend
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
  allow: ['app/**', 'node_modules/**'],
})

let router = createRouter()

router.get('/scripts/*path', ({ request }) => {
  return scriptServer.fetch(request)
})
```

This gives you a `/scripts/*path` endpoint that serves allow-listed modules from `app` and `node_modules`.

## Routes

Use `routes` to map public URLs to file-space paths.

```ts
let scriptServer = createScriptServer({
  root,
  routes: [
    { urlPattern: '/scripts/app/*path', filePattern: 'app/*path' },
    { urlPattern: '/scripts/packages/*path', filePattern: '../packages/*path' },
  ],
  allow: ['app/**', '../packages/**'],
})
```

Route patterns use [`route-pattern`](https://github.com/remix-run/remix/tree/main/packages/route-pattern) syntax for both URLs and file paths. Wildcards must be named, and the same params must appear in both patterns so imports can be rewritten back to public URLs.

## Access Control

You must provide an `allow` list to specify which files are allowed to be served. `deny` is optional and takes precedence over `allow`.

```ts
let scriptServer = createScriptServer({
  root,
  routes: [{ urlPattern: '/scripts/app/*path', filePattern: 'app/*path' }],
  allow: ['app/**', '/absolute/path/to/shared'],
  deny: ['app/private/**'],
})
```

Rules for `allow` and `deny` are file paths or globs. Relative values are resolved from `root`. Absolute file paths match exactly, and absolute directory paths also match their descendants.

## Caching

By default, modules are served at stable URLs with ETags and `Cache-Control: no-cache`. The browser revalidates instead of caching forever and receives a 304 Not Modified response if the content has not changed. To enable this, the server checks for file changes on every request.

You can customize this behavior by setting the `cacheStrategy` option.

### File Storage Cache

If you're serving a production app, you probably want to reuse compiled artifacts across server restarts for one build, so provide a `buildId` and a shared [`file-storage`](https://github.com/remix-run/remix/tree/main/packages/file-storage) backend:

```ts
import { createFsFileStorage } from 'remix/file-storage/fs'

let scriptServer = createScriptServer({
  root,
  routes: [{ urlPattern: '/scripts/app/*path', filePattern: 'app/*path' }],
  allow: ['app/**'],
  cacheStrategy: {
    buildId: process.env.GITHUB_SHA ?? String(Date.now()),
    fileStorage: createFsFileStorage('.cache/script-server'),
  },
})
```

The `buildId` option serves as the key for this cache. In practice, this should typically be a commit hash or build timestamp. Once `buildId` is present, cached modules are treated as immutable for that build instead of being revalidated against the file system on every request.

### Fingerprinting

If you also want the browser to stop revalidating non-entry module URLs, you can opt into source fingerprinting.

```ts
let scriptServer = createScriptServer({
  root,
  routes: [{ urlPattern: '/scripts/app/*path', filePattern: 'app/*path' }],
  allow: ['app/**'],
  cacheStrategy: {
    fingerprint: 'source',
    entryPoints: ['app/assets/entry.tsx'],
    buildId: process.env.GITHUB_SHA ?? String(Date.now()),
  },
})
```

Fingerprints are in the format of `.@<fingerprint>` appended to the end of the module URL.

Modules matching `cacheStrategy.entryPoints` keep stable non-fingerprinted URLs. Other served modules are rewritten to fingerprinted URLs and served with `Cache-Control: public, max-age=31536000, immutable`.

Source fingerprints are based on `sourceText + buildId`. The build ID must change for each deployment so that fingerprinted modules are invalidated together.

## Preloads

Use `preloads()` when rendering HTML so you can add `<link rel="modulepreload">` tags or `Link` headers for a stable module URL and its transitive dependencies.

```ts
let urls = await scriptServer.preloads('/scripts/app/assets/entry.tsx')
// [
//   '/scripts/app/assets/entry.tsx',
//   '/scripts/app/assets/utils.ts.@abc123',
//   '/scripts/npm/react/index.js.@def456',
// ]
```

Pass the same stable non-fingerprinted request path you would use in your `<script type="module" src="...">` tag. Do not pass a fingerprinted URL.

## Minification

Minification happens during the transform step:

```ts
let scriptServer = createScriptServer({
  root,
  routes: [{ urlPattern: '/scripts/app/*path', filePattern: 'app/*path' }],
  allow: ['app/**'],
  minify: true,
})
```

## Source Maps

Enable sourcemaps with either `'external'` or `'inline'`:

```ts
let scriptServer = createScriptServer({
  root,
  routes: [{ urlPattern: '/scripts/app/*path', filePattern: 'app/*path' }],
  allow: ['app/**'],
  sourceMaps: 'external',
})
```

By default, sourcemap `sources` use URLs so they're presented alongside the compiled output in your browser's developer tools. You can also use file system paths instead:

```ts
let scriptServer = createScriptServer({
  root,
  routes: [{ urlPattern: '/scripts/app/*path', filePattern: 'app/*path' }],
  allow: ['app/**'],
  sourceMaps: 'inline',
  sourceMapSourcePaths: 'absolute',
})
```

## Error Handling

Use `onError` to report unexpected compilation failures or return a custom response.

```ts
let scriptServer = createScriptServer({
  root,
  routes: [{ urlPattern: '/scripts/app/*path', filePattern: 'app/*path' }],
  allow: ['app/**'],
  onError(error) {
    console.error(error)
  },
})
```

If `onError` returns nothing, `script-server` responds with `500 Internal Server Error`.

## Related Packages

- [`fetch-router`](https://github.com/remix-run/remix/tree/main/packages/fetch-router) - A Fetch-based router that pairs naturally with `script-server`
- [`route-pattern`](https://github.com/remix-run/remix/tree/main/packages/route-pattern) - Route-pattern syntax for URL and route file matching
- [`file-storage`](https://github.com/remix-run/remix/tree/main/packages/file-storage) - Storage backends for compiled asset persistence

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
