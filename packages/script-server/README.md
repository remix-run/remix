# script-server

Fetch-based server for compiling browser JavaScript and TypeScript modules on demand.

## Features

- **Route-Based Serving** - Map public URL patterns to files on disk
- **Access Control** - Control exactly which files can be served with allow and deny rules
- **Preloads** - Generate modulepreload URLs for `<link>` tags or `Link` headers
- **Caching** - Conservative caching by default with stable URLs, ETags, and revalidation
- **Watch Mode** - Watch for file changes and invalidate cached scripts
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

When you enable watch mode, call `await scriptServer.close()` during shutdown so the file watcher is cleaned up properly.

```ts
process.on('SIGTERM', async () => {
  await scriptServer.close()
  process.exit(0)
})
```

## Hrefs and Preloads

Use `scriptServer.getHref()` when you need the public URL for a served file, for example in a `<script type="module" src="...">` tag.

```ts
let src = await scriptServer.getHref('app/client/entry.tsx')
// '/scripts/app/client/entry.tsx'
```

Use `scriptServer.getPreloads()` when rendering HTML so you can turn the returned URLs into `<link rel="modulepreload">` tags or `Link` headers for one or more files and their dependencies.

```ts
let preloads = await scriptServer.getPreloads(['app/client/entry.tsx', 'app/client/search.tsx'])
// [
//   '/scripts/app/client/entry.tsx',
//   '/scripts/app/client/search.tsx',
//   '/scripts/app/shared/utils.ts',
//   '/scripts/npm/@remix-run/component/index.js',
//   ...etc
// ]
```

Both helpers accept root-relative and absolute file paths, as well as `file://` URLs.

## Caching and Fingerprinting

By default, scripts are served at stable URLs with ETags and `Cache-Control: no-cache`. Responses are cached for the lifetime of the `script-server` instance.

If you want clients to cache scripts aggressively without revalidation, you can opt into source-based fingerprinting.

```ts
import { createScriptServer } from 'remix/script-server'

let scriptServer = createScriptServer({
  root,
  routes: [{ urlPattern: '/scripts/app/*path', filePattern: 'app/*path' }],
  allow: ['app/client/**', 'app/shared/**'],
  fingerprint: {
    buildId: process.env.GITHUB_SHA,
  },
})
```

When fingerprinting is enabled, scripts use a `.@<fingerprint>` suffix and are served with `Cache-Control: public, max-age=31536000, immutable`.

Source fingerprints are based on the original file contents and the build ID. The build ID must change for each deployment so that fingerprinted modules are invalidated together. This fingerprinting strategy assumes that files on disk won't change, so it cannot be used together with `watch`.

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

## Target

Use `target` to lower emitted syntax to a specific ECMAScript version.

```ts
import { createScriptServer } from 'remix/script-server'

let scriptServer = createScriptServer({
  root,
  routes: [{ urlPattern: '/scripts/app/*path', filePattern: 'app/*path' }],
  allow: ['app/client/**', 'app/shared/**'],
  target: 'es2019',
})
```

The default target is `esnext`, which means all syntax is preserved.

## Define

Use `define` to replace global identifiers with constant expressions.

```ts
import { createScriptServer } from 'remix/script-server'

let scriptServer = createScriptServer({
  root,
  routes: [{ urlPattern: '/scripts/app/*path', filePattern: 'app/*path' }],
  allow: ['app/client/**', 'app/shared/**', 'app/node_modules/**'],
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  minify: true,
})
```

Values are injected exactly as defined, so string literals must include their own quotes, e.g. `process.env.NODE_ENV` must be `"production"` rather than `production`.

## Remove Unused Imports

Use `removeUnusedImports` to remove unused static imports when the resolved module is marked side-effect free in its enclosing `package.json`.

```ts
import { createScriptServer } from 'remix/script-server'

let scriptServer = createScriptServer({
  root,
  routes: [{ urlPattern: '/scripts/app/*path', filePattern: 'app/*path' }],
  allow: ['app/client/**', 'app/shared/**', 'app/node_modules/**'],
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  minify: true,
  removeUnusedImports: true,
})
```

This is useful when `define` and `minify` make an import unreachable, and it can also remove unused imports that were already present in the source. `removeUnusedImports` defaults to `false` because it adds extra analysis work.

When enabled, `script-server` only removes an unused import if the resolved module is marked side-effect free using the `sideEffects` field:

```json
{
  "name": "example",
  "sideEffects": false
}
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

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
