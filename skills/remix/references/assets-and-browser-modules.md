# Assets and Browser Modules

Use `remix/assets` when the app needs to serve browser JavaScript or TypeScript modules from source
files. This is the right tool for client entrypoints, browser-only helpers under `app/assets/`, and
monorepo code that should be compiled and served under a public URL namespace.

Use `staticFiles()` for files that already exist on disk exactly as they should be served. Use
`createAssetServer()` for source modules that need rewriting, dependency scanning, preloads,
sourcemaps, or fingerprinted URLs.

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
})

let router = createRouter()

router.get('/assets/{path...}', ({ request }) => {
  return assetServer.fetch(request)
})
```

## Rules

- Always provide an `allow` list. Treat it as a security boundary, not just a convenience filter.
- Add a `deny` list for server-only modules such as `*.server.*`, private config, or other files
  that should never be exposed.
- Set `rootDir` explicitly in monorepos so relative paths resolve from the intended project root.
- `fileMap` keys are public URL patterns and values are root-relative file path patterns. They use
  `route-pattern` syntax on both sides.
- Keep the same wildcard params on both sides of a `fileMap` entry so import rewriting can map
  source files back to public URLs.

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

## Useful Script Options

- `scripts.minify` for production minification
- `scripts.sourceMaps` for `'external'` or `'inline'` source maps
- `scripts.target` to lower emitted syntax
- `scripts.define` to replace globals such as `process.env.NODE_ENV`
- `scripts.external` to leave specific imports untouched

## Lifecycle

If the asset server is long-lived and watching the file system, call `await assetServer.close()`
when shutting down dev servers or disposing tests.

## Common Mistakes

- Using `staticFiles()` for modules that should be compiled and import-rewritten by `remix/assets`
- Forgetting to restrict the `allow` list
- Forgetting `deny` rules for server-only files
- Omitting `rootDir` in a monorepo and accidentally resolving from the wrong directory
- Using fingerprinting while leaving `watch` enabled
- Hardcoding script URLs instead of using `getHref()` or `getPreloads()`
