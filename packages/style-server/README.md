# style-server

Fetch-based server for compiling app-level CSS entrypoints on demand.

## Features

- **Route-Based Serving** - Map public URL patterns to files on disk
- **Caching** - Conservative caching by default with stable URLs, ETags, and revalidation
- **Watch Mode** - Watch for file changes and invalidate cached styles
- **Optional Fingerprinting** - Source-based fingerprinted URLs for long-lived browser caching
- **Source Maps** - Serve either inline or external sourcemaps
- **Browserslist Targets** - Compile for browserslist queries using Lightning CSS
- **Preloads** - Generate stylesheet preload URLs for one or more CSS files and their internal `@import` graphs

## Installation

```sh
npm i remix
```

## Usage

Use `style-server` to serve CSS files from a URL namespace in your app.

```ts
import * as path from 'node:path'
import { createRouter } from 'remix/fetch-router'
import { createStyleServer } from 'remix/style-server'

let root = path.resolve(import.meta.dirname, '..')

let styleServer = createStyleServer({
  root,
  routes: [{ urlPattern: '/styles/*path', filePattern: 'app/styles/*path' }],
})

let router = createRouter()

router.get('/styles/*', ({ request }) => {
  return styleServer.fetch(request)
})
```

This example gives you a `/styles/*` endpoint that serves compiled CSS from `app/styles`.

## Routes

Use `routes` to map public URLs to file-space paths.

```ts
import { createStyleServer } from 'remix/style-server'

let styleServer = createStyleServer({
  routes: [
    { urlPattern: '/styles/app/*path', filePattern: 'app/styles/*path' },
    { urlPattern: '/styles/packages/*path', filePattern: '../packages/*path' },
  ],
})
```

Route patterns use [`route-pattern`](https://github.com/remix-run/remix/tree/main/packages/route-pattern) syntax for both URLs and file paths. Wildcards must be named, and the same params must appear in both patterns so internal `@import` dependencies can be rewritten back to public URLs.

## CSS Imports and Asset URLs

Relative `@import` dependencies are treated as internal stylesheet graph edges.

```css
@import './tokens.css';
@import './components/card.css';
```

Those relative stylesheet imports are resolved through `style-server`, rewritten to served URLs, and included in `getPreloads()`.

All `url(...)` values are treated as external and are emitted exactly as authored.

```css
.hero {
  background-image: url('../images/logo.svg');
}
```

Root-relative stylesheet imports such as `@import "/styles/app.css"` are also treated as external rather than being mapped back through `style-server`.

## Hrefs and Preloads

Use `styleServer.getHref()` when you need the public URL for a served stylesheet, for example in a `<link rel="stylesheet">` tag.

```ts
let href = await styleServer.getHref('app/styles/app.css')
// '/styles/app.css'
```

Use `styleServer.getPreloads()` when using internal `@import` dependencies and rendering HTML so you can turn the returned URLs into `<link rel="preload" as="style">` tags or `Link` headers for one or more stylesheets and their dependencies.

```ts
let preloads = await styleServer.getPreloads(['app/styles/app.css', 'app/styles/print.css'])
// [
//   '/styles/app.css',
//   '/styles/print.css',
//   '/styles/tokens.css',
//   ...etc
// ]
```

Both helpers accept root-relative and absolute file paths, as well as `file://` URLs.

### Watch Mode

To pick up changes to source files without requiring a server restart, enable `watch` mode.

```ts
import { createStyleServer } from 'remix/style-server'

let styleServer = createStyleServer({\
  routes: [{ urlPattern: '/styles/*path', filePattern: 'app/styles/*path' }],
  watch: true,
})
```

You can optionally provide an array of glob patterns to the `ignore` option:

```ts
import { createStyleServer } from 'remix/style-server'

let styleServer = createStyleServer({
  routes: [{ urlPattern: '/styles/*path', filePattern: 'app/styles/*path' }],
  watch: {
    ignore: ['**/node_modules/**'],
  },
})
```

When you enable watch mode, call `await styleServer.close()` during shutdown so the file watcher is cleaned up properly.

```ts
process.on('SIGTERM', async () => {
  await styleServer.close()
  process.exit(0)
})
```

## Caching and Fingerprinting

By default, styles are served at stable URLs with ETags and `Cache-Control: no-cache`. Responses are cached for the lifetime of the `style-server` instance.

If you want clients to cache styles aggressively without revalidation, you can opt into source-based fingerprinting.

```ts
import { createStyleServer } from 'remix/style-server'

let styleServer = createStyleServer({
  routes: [{ urlPattern: '/styles/*path', filePattern: 'app/styles/*path' }],
  fingerprint: {
    buildId: process.env.GITHUB_SHA,
  },
})
```

When fingerprinting is enabled, CSS files use a `.@<fingerprint>` segment before the file extension and are served with `Cache-Control: public, max-age=31536000, immutable`.

Source fingerprints are based on the original file contents and the build ID. The build ID must change for each deployment so that fingerprinted styles are invalidated together. This fingerprinting strategy assumes that files on disk won't change, so it cannot be used together with `watch`.

## Minification

Enable minification with the `minify` option:

```ts
import { createStyleServer } from 'remix/style-server'

let styleServer = createStyleServer({
  routes: [{ urlPattern: '/styles/*path', filePattern: 'app/styles/*path' }],
  minify: true,
})
```

## Browserslist

Use the `browserslist` option to compile CSS for a [browserslist](https://github.com/browserslist/browserslist) query.

```ts
import { createStyleServer } from 'remix/style-server'

let styleServer = createStyleServer({
  routes: [{ urlPattern: '/styles/*path', filePattern: 'app/styles/*path' }],
  browserslist: 'defaults',
})
```

The `browserslist` query is resolved with the standard [`browserslist`](https://github.com/browserslist/browserslist) package, then converted to Lightning CSS targets internally.

## Source Maps

Enable sourcemaps with either `'external'` or `'inline'`:

```ts
import { createStyleServer } from 'remix/style-server'

let styleServer = createStyleServer({
  routes: [{ urlPattern: '/styles/*path', filePattern: 'app/styles/*path' }],
  sourceMaps: 'external',
})
```

By default, sourcemap `sources` use served URLs so they appear alongside the compiled output in your browser's developer tools.

## Error Handling

Use `onError` to report unexpected compilation failures or return a custom response.

```ts
import { createStyleServer } from 'remix/style-server'

let styleServer = createStyleServer({
  routes: [{ urlPattern: '/styles/*path', filePattern: 'app/styles/*path' }],
  onError(error) {
    console.error('Failed to build stylesheet', error)
    return new Response('Stylesheet build failed', { status: 500 })
  },
})
```

If `onError` returns nothing, `style-server` responds with the default `500 Internal Server Error` response.

## Related Packages

- [`fetch-router`](https://github.com/remix-run/remix/tree/main/packages/fetch-router) - A Fetch-based router that pairs naturally with `style-server`
- [`route-pattern`](https://github.com/remix-run/remix/tree/main/packages/route-pattern) - Route-pattern syntax for URL and route file matching

## Related Work

- [`lightningcss`](https://lightningcss.dev/) - CSS parser, transformer, and target-aware compiler used by `style-server`
- [`browserslist`](https://github.com/browserslist/browserslist) - Standard query format for defining browser support targets

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
