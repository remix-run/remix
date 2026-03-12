# script-handler

Compile browser JavaScript/TypeScript modules on demand and serve them from a Fetch-compatible route handler.

## Features

- **On-Demand Compilation** - Transpile browser modules as they are requested
- **Content-Addressed Imports** - Rewrite internal imports to stable hashed URLs
- **Cache-Friendly Delivery** - Entry points revalidate while internal modules are immutable
- **Module Preloads** - Generate preload URLs for an entry point's transitive dependencies
- **Source Maps** - Serve inline or external sourcemaps for browser debugging
- **Virtual Source Paths** - Keep sourcemap sources co-located and avoid leaking filesystem paths
- **Multiple Roots** - Serve modules from multiple root directories with explicit public prefixes

## Installation

```sh
npm i remix
```

## Basic Setup

Create a handler with your app root and one or more entry points:

```ts
import * as path from 'node:path'
import { createScriptHandler } from 'remix/script-handler'

let scripts = createScriptHandler({
  base: '/scripts',
  roots: [
    {
      directory: path.resolve(import.meta.dirname, '..'),
      entryPoints: ['app/assets/*.tsx'],
    },
  ],
})
```

Mount it at the same `base` path:

```ts
router.get('/scripts/*path', ({ request, params }) => {
  return scripts.handle(request, params.path)
})
```

Entry points are served at stable URLs like `/scripts/app/assets/entry.tsx`. Internal modules are rewritten to content-addressed URLs like `/scripts/app/assets/button.tsx.@abc123`.

## Source Maps

Enable sourcemaps with either `'external'` or `'inline'`:

```ts
let scripts = createScriptHandler({
  base: '/scripts',
  roots: [
    {
      directory: path.resolve(import.meta.dirname, '..'),
      entryPoints: ['app/assets/*.tsx'],
    },
  ],
  sourceMaps: 'external',
})
```

By default, sourcemap `sources` use the handler path instead of the original filesystem path:

```ts
let scripts = createScriptHandler({
  base: '/scripts',
  roots: [
    {
      directory: path.resolve(import.meta.dirname, '..'),
      entryPoints: ['app/assets/*.tsx'],
    },
  ],
  sourceMaps: 'external',
  sourceMapSourcePaths: 'virtual',
})
```

This keeps authored sources next to compiled output in browser devtools, avoids leaking filesystem paths in production, and keeps sourcemaps stable across environments.

If you want sourcemaps to point to real files on disk instead, you can opt into absolute paths:

```ts
let scripts = createScriptHandler({
  base: '/scripts',
  roots: [
    {
      directory: path.resolve(import.meta.dirname, '..'),
      entryPoints: ['app/assets/*.tsx'],
    },
  ],
  sourceMaps: 'external',
  sourceMapSourcePaths: 'absolute',
})
```

## Preloads

Use `preloads()` when rendering HTML to add `<link rel="modulepreload">` tags or send `Link` headers for an entry point and all of its transitive dependencies:

```ts
let preloadUrls = await scripts.preloads('app/assets/entry.tsx')
// ["/scripts/app/assets/entry.tsx", "/scripts/app/assets/utils.ts.@abc123"]
```

The primary input is the public module path relative to `base`. Absolute file paths also work if the file belongs to a configured root and matches that root's `entryPoints`.

## Multiple Roots

Each configured root can optionally expose a public `prefix`. Roots without a `prefix` act as the fallback directory:

```ts
let scripts = createScriptHandler({
  base: '/scripts',
  roots: [
    {
      directory: path.resolve(import.meta.dirname, '../..'),
      entryPoints: ['app/assets/*.tsx'],
    },
    {
      prefix: 'packages',
      directory: path.resolve(import.meta.dirname, '../../../../packages'),
    },
  ],
})
```

With this setup, imports from the second root are served at paths like `/scripts/packages/component/src/index.ts.@abc123`.

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
