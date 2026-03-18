# script-server

Compile browser JavaScript/TypeScript modules on demand.

## Features

- **Route-Based Serving** - Map public URL patterns to file patterns with the same declarative rules used for request handling and import rewriting
- **Access Control** - Allowed paths must be configured explicitly, with optional deny rules taking precedence
- **Customizable Caching** - Serve entry points and internal modules with ETags and `Cache-Control: no-cache` by default, with optional URL-based fingerprinting and cache control headers for internal modules
- **Preloads** - Generate `<link rel="modulepreload">` URLs or `Link` headers for an entry point
- **Compiled Asset Storage** - Cache compiled assets with pluggable `file-storage` backends
- **Source Maps and Minification** - Enable inline or external sourcemaps and minify output when needed

## Usage

```ts
import * as path from 'node:path'
import { createRouter } from 'remix/fetch-router'
import { createScriptServer } from 'remix/script-server'

let root = path.resolve(import.meta.dirname, '..')

let scriptServer = createScriptServer({
  root,
  routes: [
    {
      urlPattern: '/scripts/app/*path',
      filePattern: 'app/*path',
    },
    {
      urlPattern: '/scripts/npm/*path',
      filePattern: 'node_modules/*path',
    },
  ],
  entryPoints: ['app/assets/entry.tsx'],
  allow: ['app/**', 'node_modules/**'],
})

let router = createRouter()

router.get('/scripts/*path', ({ request }) => {
  return scriptServer.fetch(request)
})
```

With this setup:

- Entry points are served at stable URLs like `/scripts/app/assets/entry.tsx`
- Internal modules are served at stable URLs by default, and can be requested directly if they match `allow`
- If you enable `fingerprintInternalModules`, internal imports are rewritten to URLs like `/scripts/app/assets/button.tsx.@abc123`
- Only supported script module files are served by default: `.js`, `.jsx`, `.mjs`, `.mts`, `.ts`, and `.tsx`

## Routes

Use `routes` to define the public URLs and the corresponding file paths.

```ts
let scriptServer = createScriptServer({
  root,
  routes: [
    {
      urlPattern: '/scripts/app/*path',
      filePattern: 'app/*path',
    },
    {
      urlPattern: '/scripts/packages/*path',
      filePattern: '../packages/*path',
    },
  ],
  entryPoints: ['app/assets/entry.tsx'],
  allow: ['app/**', '../packages/**'],
})
```

Script routes use [`route-pattern`](https://github.com/remix-run/remix/tree/main/packages/route-pattern) syntax for both URLs and file paths. Wildcards in these route patterns must be named (e.g. `*path` rather than `*`). The same params must be present in both patterns so that they can be used to map incoming requests to files and resolved imports back to URLs.

## Caching and Fingerprints

The default caching strategy is intentionally conservative:

- Entry points always use `Cache-Control: no-cache` with ETags
- Internal modules default to `Cache-Control: no-cache` with ETags
- Internal modules default to stable, unhashed URLs with ETags

```ts
let scriptServer = createScriptServer({
  root,
  routes: [
    {
      urlPattern: '/scripts/app/*path',
      filePattern: 'app/*path',
    },
  ],
  entryPoints: ['app/assets/entry.tsx'],
  allow: ['app/**'],
})
```

If you want fingerprinted internal URLs, opt in explicitly:

```ts
let scriptServer = createScriptServer({
  root,
  routes: [
    {
      urlPattern: '/scripts/app/*path',
      filePattern: 'app/*path',
    },
  ],
  entryPoints: ['app/assets/entry.tsx'],
  allow: ['app/**'],
  fingerprintInternalModules: true,
})
```

Fingerprints are based on `sourceText + version`. This means unchanged modules keep the same internal fingerprint even if one of their own dependencies changes.

```ts
let scriptServer = createScriptServer({
  root,
  routes: [
    {
      urlPattern: '/scripts/app/*path',
      filePattern: 'app/*path',
    },
  ],
  entryPoints: ['app/assets/entry.tsx'],
  allow: ['app/**'],
  fingerprintInternalModules: true,
  version: process.env.RELEASE_ID ?? '',
  internalModuleCacheControl: 'public, max-age=31536000, immutable',
})
```

When you choose stronger browser caching, you are also responsible for choosing a `version` that covers whatever non-source changes should invalidate those cached internal responses.

## Access Control

`allow` is required. `deny` is optional and takes precedence over `allow`.

```ts
let scriptServer = createScriptServer({
  root,
  routes: [
    {
      urlPattern: '/scripts/app/*path',
      filePattern: 'app/*path',
    },
  ],
  entryPoints: ['app/assets/entry.tsx'],
  allow: ['app/**', '/absolute/path/to/shared'],
  deny: ['app/private/**'],
})
```

Rules are written as filesystem globs and paths:

- Relative rules are resolved from `root`
- Absolute file paths match exactly
- Absolute directory paths allow descendants
- Recursive patterns like `app/**` use Node's built-in glob matching semantics

## Compiled Asset Storage

Compiled JavaScript, sourcemaps, and response metadata can be persisted through `fileStorage`.

```ts
import { createFsFileStorage } from 'remix/file-storage/fs'

let scriptServer = createScriptServer({
  root,
  routes: [
    {
      urlPattern: '/scripts/app/*path',
      filePattern: 'app/*path',
    },
  ],
  entryPoints: ['app/assets/entry.tsx'],
  allow: ['app/**'],
  fileStorage: createFsFileStorage('./.cache/script-server'),
})
```

If you omit `fileStorage`, `script-server` uses in-memory storage.

## Preloads

Use `preloads()` when rendering HTML so you can add `<link rel="modulepreload">` tags or `Link` headers for an entry point and its transitive dependencies.

```ts
let urls = await scriptServer.preloads('/scripts/app/assets/entry.tsx')
// [
//   '/scripts/app/assets/entry.tsx',
//   '/scripts/app/assets/utils.ts.@abc123',
//   '/scripts/npm/react/index.js.@def456',
// ]
```

`preloads()` is URL-oriented. Pass the same request path you would use in your `<script type="module" src="...">` tag.

## Source Maps and Minification

Enable sourcemaps with either `'external'` or `'inline'`:

```ts
let scriptServer = createScriptServer({
  root,
  routes: [
    {
      urlPattern: '/scripts/app/*path',
      filePattern: 'app/*path',
    },
  ],
  entryPoints: ['app/assets/entry.tsx'],
  allow: ['app/**'],
  sourceMaps: 'external',
})
```

By default, sourcemap `sources` are written as browser-visible script paths. If you want real file system paths instead:

```ts
let scriptServer = createScriptServer({
  root,
  routes: [
    {
      urlPattern: '/scripts/app/*path',
      filePattern: 'app/*path',
    },
  ],
  entryPoints: ['app/assets/entry.tsx'],
  allow: ['app/**'],
  sourceMaps: 'inline',
  sourceMapSourcePaths: 'absolute',
})
```

Minification happens during the transform step:

```ts
let scriptServer = createScriptServer({
  root,
  routes: [
    {
      urlPattern: '/scripts/app/*path',
      filePattern: 'app/*path',
    },
  ],
  entryPoints: ['app/assets/entry.tsx'],
  allow: ['app/**'],
  minify: true,
})
```

## Error Handling

Use `onError` to report unexpected compilation failures or return a custom response.

```ts
let scriptServer = createScriptServer({
  root,
  routes: [
    {
      urlPattern: '/scripts/app/*path',
      filePattern: 'app/*path',
    },
  ],
  entryPoints: ['app/assets/entry.tsx'],
  allow: ['app/**'],
  onError(error) {
    console.error(error)
  },
})
```

If `onError` returns nothing, `script-server` responds with `500 Internal Server Error`.

## Related Packages

- [`fetch-router`](https://github.com/remix-run/remix/tree/main/packages/fetch-router) - A Fetch-based router that pairs naturally with `script-server`
- [`route-pattern`](https://github.com/remix-run/remix/tree/main/packages/route-pattern) - The route-pattern syntax used for URL and file-space matching
- [`file-storage`](https://github.com/remix-run/remix/tree/main/packages/file-storage) - Storage backends for compiled asset persistence

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
