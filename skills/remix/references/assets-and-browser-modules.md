# Assets and Browser Modules

## What This Covers

How to serve browser scripts and styles from source. Read this when the task involves:

- Configuring `createAssetServer` (`fileMap`, `allow`, `deny`, fingerprinting, compiler options)
- Choosing between `staticFiles()` for already-built files and `createAssetServer()` for source
  assets that need import rewriting, preloads, or fingerprinted URLs
- Generating script URLs or `<link rel="modulepreload">` tags for a client entry
- Keeping server-only files out of the browser via `deny` rules

For routing the URL namespace itself, see `routing-and-controllers.md`. For client entry
hydration, see `hydration-frames-navigation.md`.

## When To Reach For It

Use `remix/assets` when the app serves browser JavaScript, TypeScript, or CSS from source files.
This is the right tool for client entrypoints, browser-only helpers, styles under `app/assets/`,
and monorepo code that should be compiled and served under a public URL namespace.

Use `staticFiles()` for files that already exist on disk exactly as they should be served. Use
`createAssetServer()` for source scripts or styles that need rewriting, dependency scanning,
preloads, sourcemaps, or fingerprinted URLs.

## Default Pattern

```typescript
import * as path from 'node:path'

import { createAssetServer } from 'remix/assets'
import { createRouter } from 'remix/fetch-router'

let assetServer = createAssetServer({
  rootDir: path.resolve(import.meta.dirname, '..'),
  fileMap: {
    '/assets/app/*path': 'app/*path',
    '/assets/packages/*path': '../packages/*path',
  },
  allow: ['app/assets/**', '../packages/**'],
  deny: ['app/**/*.server.*'],
  target: { es: '2020', chrome: '109', safari: '16.4' },
  sourceMaps: process.env.NODE_ENV === 'development' ? 'external' : undefined,
  minify: process.env.NODE_ENV === 'production',
  scripts: {
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'development'),
    },
  },
})

let router = createRouter()

router.get('/assets/*path', ({ request }) => {
  return assetServer.fetch(request)
})
```

## Rules

- Treat `allow` and `deny` as the security boundary for browser-reachable source files.
- Add a `deny` list for server-only modules such as `*.server.*`, private config, or other files
  that should never be exposed.
- Set `rootDir` explicitly in monorepos so relative paths resolve from the intended project root.
- `fileMap` keys are public URL patterns and values are root-relative file path patterns. They use
  `route-pattern` syntax on both sides.
- Keep the same wildcard params on both sides of a `fileMap` entry so import rewriting can map
  source files back to public URLs.
- CSS files are compiled and served alongside scripts. Local CSS `@import` rules are rewritten and
  fingerprinted with the same asset server routing rules.

## Rendering HTML

Use `getHref()` when you need the public URL for one module, and `getPreloads()` when you want
`<link rel="modulepreload">` tags or `Link` headers for one or more entrypoints and their
dependencies.

```typescript
let entryHref = await assetServer.getHref('app/assets/entry.ts')
let preloads = await assetServer.getPreloads(['app/assets/entry.ts'])
```

Use this when rendering documents or layouts that boot browser behavior with a known client entry.

## Development vs Deployment

In development:

- Keep `watch` enabled so source changes are picked up without restarting the server
- Prefer stable URLs with normal revalidation
- Enable source maps when debugging browser code

In deployment:

- Set `watch: false`
- Use `fingerprint: { buildId }` for long-lived immutable caching
- Make sure `buildId` changes for each deploy

Fingerprinting assumes files on disk are stable and requires `watch: false`.

## Useful Compiler Options

- `minify` for production minification of scripts and styles
- `sourceMaps` for `'external'` or `'inline'` source maps for scripts and styles
- `sourceMapSourcePaths` for `'url'` or `'absolute'` source map paths
- `target` as an object for shared browser targets and script-only ECMAScript output, such as
  `{ es: '2020', chrome: '109', safari: '16.4' }`
- `scripts.define` to replace globals such as `process.env.NODE_ENV`
- `scripts.external` to leave specific script imports untouched

Do not nest shared compiler options under `scripts`. Use top-level `minify`, `sourceMaps`,
`sourceMapSourcePaths`, and `target` so they apply to styles as well as scripts.

## Lifecycle

If the asset server is long-lived and watching the file system, call `await assetServer.close()`
when shutting down dev servers or disposing tests.
