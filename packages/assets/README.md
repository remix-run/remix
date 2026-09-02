# assets

Fetch-based server for compiling browser assets on demand.

## Features

- **On-Demand Compilation** - Compile browser scripts and styles on demand
- **File Serving** - Serve configured file assets like images and fonts with optional transforms
- **Access Control** - Control exactly which files and packages can be served
- **Preloads** - Generate preload URLs for scripts and styles based on imports
- **Inspection** - List browser-reachable assets and explain URL-to-file mappings
- **Caching** - Conservative caching by default with stable URLs, ETags, and revalidation
- **Optional Fingerprinting** - Source-based fingerprinted URLs for long-lived browser caching
- **Source Maps** - Serve inline or external sourcemaps
- **Hot Module Reloading** - Handle live code updates in development
- **Script Loaders** - Post-process compiled JavaScript with Node-compatible loaders

## Installation

```sh
npm i remix
```

The optional image transform examples also use Sharp:

```sh
npm i sharp
```

## Usage

Use `createAssetServer` to serve browser assets from a URL namespace in your app.

```ts
import { createRouter } from 'remix/router'
import { createAssetServer } from 'remix/assets'

let assetServer = createAssetServer({
  basePath: '/assets',
  allowFiles: ['app/routes.ts', 'app/**/public/**'],
  allowPackages: ['remix'],
  files: {
    extensions: ['.svg', '.png', '.jpg', '.jpeg', '.woff2'],
  },
})

let router = createRouter()

router.get('/assets/*', ({ request }) => {
  return assetServer.fetch(request)
})
```

This example gives you an `/assets/*` endpoint that serves compiled browser source from `public/` directories throughout `app/` and from the `remix` package.

## Shared Configuration

Keep JSON-compatible asset mapping, access, and file-type settings in `remix.json` so the running
server and Remix CLI use the same configuration:

```jsonc
{
  "$schema": "./node_modules/remix/schema/remix.json",
  "assets": {
    "basePath": "/assets",
    "mounts": {
      "app": "app",
      "npm": "node_modules",
    },
    "allowFiles": ["app/routes.ts", "app/**/public/**"],
    "allowPackages": ["remix"],
    "denyFiles": ["app/**/*.test.*"],
    "files": {
      "extensions": [".svg", ".png", ".jpg", ".woff2"],
    },
  },
}
```

Load it from application code and add runtime-only behavior there:

```ts
import { createAssetServer, defineFileTransform } from 'remix/assets'
import { loadConfig } from 'remix/cli'
import sharp from 'sharp'

let config = await loadConfig(import.meta.dirname)
if (config.assets === undefined) throw new Error('Missing assets configuration')
if (config.assets.files === undefined) throw new Error('Missing asset file configuration')

let assetServer = createAssetServer({
  ...config.assets,
  files: {
    ...config.assets.files,
    transforms: {
      webp: defineFileTransform({
        extensions: ['.png', '.jpg'],
        async transform(bytes) {
          return {
            content: await sharp(bytes).webp({ quality: 80 }).toBuffer(),
            extension: '.webp',
          }
        },
      }),
    },
  },
})
```

`loadConfig()` accepts either a config file or a directory. When given a directory, it searches
upward for the nearest `remix.json`. Run `remix assets` to list reachable files, or
`remix assets inspect <url-or-file>` to inspect one mapping and its access decision.

## Root Directory

Use `rootDir` to specify the root directory of the asset server, which is used to resolve relative file paths. Defaults to `process.cwd()`.

```ts
import * as path from 'node:path'
import { createAssetServer } from 'remix/assets'

let assetServer = createAssetServer({
  rootDir: path.resolve(import.meta.dirname, '..'),
  basePath: '/assets',
  allowFiles: ['app/routes.ts', 'app/**/public/**'],
  allowPackages: ['remix'],
})
```

## Access Control

You must provide an `allowFiles` list to specify which files are allowed to be served. You can also allow whole packages by name with `allowPackages`. `denyFiles` is optional and takes precedence over both `allowFiles` and `allowPackages`.

```ts
import { createAssetServer } from 'remix/assets'

let assetServer = createAssetServer({
  basePath: '/assets',
  allowFiles: ['app/routes.ts', 'app/**/public/**'],
  allowPackages: ['remix'],
  denyFiles: ['app/**/*.server.*'],
})
```

Values for `allowFiles` and `denyFiles` are file paths or globs. Relative values are resolved from `rootDir`. Absolute file paths match exactly, and absolute directory paths also match their descendants.

Values for `allowPackages` are exact package names. Dependencies and installed optional dependencies of packages in `allowPackages` are also allowed automatically. Peer dependencies must be listed explicitly if they should be browser-reachable. Allowed package files must still be reachable through `mounts`.

## Mounts

By default, the asset server mounts the `app` directory at `/app` and `node_modules` at `/npm`. Use `mounts` to replace these defaults. Keys are public paths relative to `basePath`, and values are directory paths relative to `rootDir`.

```ts
import { createAssetServer } from 'remix/assets'

let assetServer = createAssetServer({
  basePath: '/assets',
  mounts: {
    source: 'app',
    vendor: 'node_modules',
  },
  allowFiles: ['app/routes.ts', 'app/**/public/**'],
  allowPackages: ['remix'],
})
```

### File watching

The file system is watched by default so source changes are picked up without requiring a server restart.

```ts
import { createAssetServer } from 'remix/assets'

let assetServer = createAssetServer({
  basePath: '/assets',
  allowFiles: ['app/routes.ts', 'app/**/public/**'],
  allowPackages: ['remix'],
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
  basePath: '/assets',
  allowFiles: ['app/routes.ts', 'app/**/public/**'],
  allowPackages: ['remix'],
  watch: false,
})
```

You can optionally provide an array of glob patterns to the `watch.ignore` option:

```ts
import { createAssetServer } from 'remix/assets'

let assetServer = createAssetServer({
  basePath: '/assets',
  allowFiles: ['app/routes.ts', 'app/**/public/**'],
  allowPackages: ['remix'],
  watch: {
    ignore: ['**/node_modules/**'],
  },
})
```

## Hrefs

Use `assetServer.getHref()` when you need the public URL for a served asset. You can provide a root-relative or absolute file path, or a `file://` URL.

```ts
let src = await assetServer.getHref('app/actions/public/entry.ts')
// '/assets/app/actions/public/entry.ts'
```

## Inspection

Use `getAssets()` for a sorted list of files that are currently browser-reachable through the
asset server. Use `getAssetDetails()` with a public URL or file path to inspect its mapping, file
type, access rules, and reachability status.

```ts
let assets = await assetServer.getAssets()
// [{ url: '/assets/app/actions/public/entry.ts', filePath: '/project/app/actions/public/entry.ts', ... }]

let details = await assetServer.getAssetDetails('/assets/app/actions/public/entry.ts')
// { status: 'reachable', type: 'script', ... }
```

For configured `files` assets, you can also pass a `transform` pipeline to build a request URL with custom file transforms. Basic transforms are written as strings, while dynamic transforms use `[name, param]` tuples.

```ts
let src = await assetServer.getHref('app/media/public/image.png', {
  transform: [['resize', '100x100'], 'webp'],
})
// '/assets/app/media/public/image.png?transform=resize%3A100x100&transform=webp'
```

## Preloads

Use `assetServer.getPreloads()` when rendering HTML so you can turn the returned URLs into `<link rel="modulepreload">`, stylesheet preload tags, or `Link` headers for one or more assets and their dependencies. You can provide root-relative or absolute file paths, or `file://` URLs.

```ts
let preloads = await assetServer.getPreloads([
  'app/actions/public/entry.ts',
  'app/search/public/search.tsx',
])
// [
//   '/assets/app/actions/public/entry.ts',
//   '/assets/app/search/public/search.tsx',
//   '/assets/app/search/public/utils.ts',
//   '/assets/npm/remix/ui/index.js',
//   ...etc
// ]
```

## Fingerprinting

By default, assets are served at stable URLs with ETags and `Cache-Control: no-cache`.

If you want clients to cache assets aggressively without revalidation, you can opt into source-based fingerprinting.

```ts
import { createAssetServer } from 'remix/assets'

let assetServer = createAssetServer({
  basePath: '/assets',
  allowFiles: ['app/routes.ts', 'app/**/public/**'],
  allowPackages: ['remix'],
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
  basePath: '/assets',
  allowFiles: ['app/routes.ts', 'app/**/public/**'],
  allowPackages: ['remix'],
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
  basePath: '/assets',
  allowFiles: ['app/routes.ts', 'app/**/public/**'],
  allowPackages: ['remix'],
  sourceMaps: 'external',
})
```

By default, sourcemap `sources` use URLs so they're presented alongside the compiled output in your browser's developer tools. You can also use file system paths instead with `sourceMapSourcePaths`:

```ts
import { createAssetServer } from 'remix/assets'

let assetServer = createAssetServer({
  basePath: '/assets',
  allowFiles: ['app/routes.ts', 'app/**/public/**'],
  allowPackages: ['remix'],
  sourceMaps: 'inline',
  sourceMapSourcePaths: 'absolute',
})
```

### Minification

Enable minification with `minify`:

```ts
import { createAssetServer } from 'remix/assets'

let assetServer = createAssetServer({
  basePath: '/assets',
  allowFiles: ['app/routes.ts', 'app/**/public/**'],
  allowPackages: ['remix'],
  minify: true,
})
```

## Script Options

### Define

Use `scripts.define` to replace global identifiers with constant expressions.

```ts
import { createAssetServer } from 'remix/assets'

let assetServer = createAssetServer({
  basePath: '/assets',
  allowFiles: ['app/routes.ts', 'app/**/public/**'],
  allowPackages: ['remix'],
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
  basePath: '/assets',
  allowFiles: ['app/routes.ts', 'app/**/public/**'],
  allowPackages: ['remix'],
  scripts: {
    external: ['my-external-import'],
  },
})
```

### Loaders

Use `scripts.loaders` to post-process compiled JavaScript. Loaders use the same function signature and chaining behavior as synchronous [`load` hooks in Node's module API](https://nodejs.org/api/module.html#customization-hooks).

```ts
import { createAssetServer } from 'remix/assets'

let assetServer = createAssetServer({
  basePath: '/assets',
  allowFiles: ['app/routes.ts', 'app/**/public/**'],
  denyFiles: ['app/**/*.test.*'],
  scripts: {
    loaders: [
      (url, context, nextLoad) => {
        let result = nextLoad(url, context)
        return {
          ...result,
          source: `${result.source}\nconsole.log('loaded')`,
        }
      },
    ],
  },
})
```

Loaders receive JavaScript after the asset server transforms TypeScript and JavaScript, and run before HMR analysis and minification. They must return `format: 'module'`. Import attributes are not supported.

## File Options

Use `files` to serve additional leaf assets like images and fonts. File extensions must include the leading dot and are only served when explicitly configured.

```ts
import { createAssetServer } from 'remix/assets'

let assetServer = createAssetServer({
  basePath: '/assets',
  allowFiles: ['app/routes.ts', 'app/**/public/**'],
  allowPackages: ['remix'],
  files: {
    extensions: ['.svg', '.png', '.jpg', '.jpeg', '.woff2'],
  },
})
```

JavaScript/TypeScript and CSS extensions not supported in `files.extensions` as they are not leaf assets and have their own module systems.

### File transforms

Files can optionally be transformed before serving.

Use `files.transforms` for named transforms that callers can opt into per request, provided via the `transform` option when calling `assetServer.getHref()`.

```ts
import { createAssetServer, defineFileTransform } from 'remix/assets'
import sharp from 'sharp'

let assetServer = createAssetServer({
  basePath: '/assets',
  allowFiles: ['app/routes.ts', 'app/**/public/**'],
  allowPackages: ['remix'],
  files: {
    extensions: ['.svg', '.png', '.jpg', '.jpeg', '.woff2'],
    transforms: {
      webp: defineFileTransform({
        extensions: ['.png', '.jpg', '.jpeg'],
        async transform(bytes) {
          return {
            content: await sharp(bytes).webp({ quality: 80 }).toBuffer(),
            extension: '.webp',
          }
        },
      }),
    },
  },
})

let imageUrl = await assetServer.getHref('app/media/public/photo.jpg', {
  transform: ['webp'],
})
```

Transforms can also accept a single string param value, provided as a `[name, param]` tuple in the `transform` array when calling `assetServer.getHref()`.

```ts
import { createAssetServer, defineFileTransform } from 'remix/assets'

let assetServer = createAssetServer({
  basePath: '/assets',
  allowFiles: ['app/routes.ts', 'app/**/public/**'],
  allowPackages: ['remix'],
  files: {
    extensions: ['.svg', '.png', '.jpg', '.jpeg', '.woff2'],
    transforms: {
      recolor: defineFileTransform({
        extensions: ['.svg'],
        param: true,
        async transform(bytes, { param }) {
          if (!/^#?(?:[\da-f]{3,4}|[\da-f]{6}(?:[\da-f]{2})?)$/i.test(param)) {
            throw new TypeError('Expected a hex color, with or without a leading #')
          }

          let svg = new TextDecoder().decode(bytes)
          return svg.replaceAll('currentColor', `${!param.startsWith('#') ? '#' : ''}${param}`)
        },
      }),
    },
  },
})

let imageUrl = await assetServer.getHref('app/media/public/logo.svg', {
  transform: [['recolor', '0000ff']],
})
```

Hand-authored URLs use repeated `transform` search params with `name` or `name:param` values:

```css
.selector {
  background-image: url('/assets/app/media/public/image.png?transform=resize:100x100&transform=webp');
}
```

#### Global file transforms

Use `files.globalTransforms` to define transforms that should always happen before a file is served. These transforms are run after any request-level transforms for all configured file extensions, and can return `null` to skip themselves for a given input.

```ts
import { createAssetServer } from 'remix/assets'
import { optimize as optimizeSvg } from 'svgo'

let assetServer = createAssetServer({
  basePath: '/assets',
  allowFiles: ['app/routes.ts', 'app/**/public/**'],
  allowPackages: ['remix'],
  files: {
    extensions: ['.svg', '.png', '.jpg', '.jpeg', '.woff2'],
    globalTransforms: [
      {
        extensions: ['.svg'],
        async transform(bytes) {
          let svg = new TextDecoder().decode(bytes)
          return optimizeSvg(svg, { multipass: true }).data
        },
      },
    ],
  },
})
```

#### File transform caching

Use `files.cache` to store transformed file outputs via a [`file-storage`](https://github.com/remix-run/remix/tree/main/packages/file-storage) backend.

Without `files.cache`, transformed file outputs are recomputed per request.

If `fingerprint.buildId` is set, the file cache can be reused across server restarts for the same build.

```ts
import * as path from 'node:path'
import { createAssetServer } from 'remix/assets'
import { createFsFileStorage } from 'remix/file-storage/fs'

let assetServer = createAssetServer({
  basePath: '/assets',
  allowFiles: ['app/routes.ts', 'app/**/public/**'],
  allowPackages: ['remix'],
  files: {
    cache: createFsFileStorage(path.resolve('.tmp/assets-cache')),
    extensions: ['.svg', '.png', '.jpg', '.jpeg', '.woff2'],
    transforms: {
      /*...*/
    },
  },
})
```

#### Request transform limits

Use `files.maxRequestTransforms` to cap request transform pipelines. It defaults to `5`.

```ts
import { createAssetServer } from 'remix/assets'

let assetServer = createAssetServer({
  basePath: '/assets',
  allowFiles: ['app/routes.ts', 'app/**/public/**'],
  allowPackages: ['remix'],
  files: {
    maxRequestTransforms: 5,
    extensions: ['.svg', '.png', '.jpg', '.jpeg', '.woff2'],
    transforms: {
      /*...*/
    },
  },
})
```

## CSS Imports

Relative CSS `@import` rules and `url()` references are rewritten to asset server URLs.

```css
/* Rewritten to asset server URLs: */
@import './reset.css';
.selector {
  background-image: url('./image.png');
}

/* External URLs: */
@import 'https://fonts.googleapis.com/css2?family=Inter';
.selector {
  background-image: url('https://example.com/logo.svg');
}
```

File transforms can also be applied to relative CSS `url()` references:

```css
.selector {
  background-image: url('./image.png?transform=resize:100x100&transform=webp');
}
```

## Error Handling

Use `onError` to report unexpected compilation failures and/or return a custom response.

```ts
import { createAssetServer } from 'remix/assets'

let assetServer = createAssetServer({
  basePath: '/assets',
  allowFiles: ['app/routes.ts', 'app/**/public/**'],
  allowPackages: ['remix'],
  onError(error) {
    console.error('Failed to build client assets', error)
    return new Response('Client asset build failed', { status: 500 })
  },
})
```

If `onError` returns nothing, the asset server responds with the default `500 Internal Server Error` response.

## Hot Module Reloading

Use `hmr` with `watch` to enable the `import.meta.hot` API for browser modules. The `hmr` option is designed for integrating assets with a server-level HMR runtime such as [`node-hmr`](https://github.com/remix-run/remix/tree/main/packages/node-hmr) so server and browser updates can be coordinated.

The `hmr` option accepts an async function that creates a `BrowserHmrChannel`, such as the `createBrowserHmrChannel` function from [`node-hmr`](https://github.com/remix-run/remix/tree/main/packages/node-hmr):

```ts
import { createAssetServer } from 'remix/assets'

let isDevelopment = process.env.NODE_ENV === 'development'
let assetServer = createAssetServer({
  basePath: '/assets',
  allowFiles: ['app/routes.ts', 'app/**/public/**'],
  denyFiles: ['app/**/*.test.*'],
  hmr: isDevelopment
    ? async () => (await import('remix/node-hmr/runtime')).createBrowserHmrChannel()
    : undefined,
  watch: isDevelopment,
})
```

### `import.meta.hot`

The `import.meta.hot` API provided by `assets` is a small runtime contract for modules that can handle updates without reloading the page. It is primarily intended for browser modules compiled by `assets`, but it can also be used directly.

To type `import.meta.hot`, add the HMR types to your TypeScript config:

```json
{
  "compilerOptions": {
    "types": ["remix/assets/types/hmr"]
  }
}
```

HMR accept calls are statically analyzed. Write them directly as `import.meta.hot.accept(...)`. Dependency accepts must use string literals or arrays of string literals; do not alias `import.meta.hot` or pass dynamically constructed dependency lists.

```ts
if (import.meta.hot) {
  import.meta.hot.accept()
}
```

### Accepting updates

Calling `accept()` makes the current module an HMR boundary. When the module changes, `assets` evaluates the updated module and calls your callback with its exports.

```ts
export let value = 1

if (import.meta.hot) {
  import.meta.hot.accept((module) => {
    if (typeof module.value !== 'number') {
      import.meta.hot?.invalidate('Updated module no longer exports value')
      return
    }

    value = module.value
  })
}
```

You can also accept updates from direct dependencies.

```ts
import { value } from './value.ts'

let currentValue = value

export function readValue() {
  return currentValue
}

if (import.meta.hot) {
  import.meta.hot.accept('./value.ts', (module) => {
    if (typeof module.value !== 'number') {
      import.meta.hot?.invalidate('Updated dependency no longer exports value')
      return
    }

    currentValue = module.value
  })
}
```

Multiple dependencies can be accepted at once. The callback receives an array where only the changed dependency is defined.

```ts
if (import.meta.hot) {
  import.meta.hot.accept(['./one.ts', './two.ts'], ([oneModule, twoModule]) => {
    // oneModule is defined when ./one.ts changed.
    // twoModule is defined when ./two.ts changed.
  })
}
```

### Cleaning up

Register cleanup that should run before the module is replaced or disposed.

```ts
let interval = setInterval(refreshCache, 30_000)

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    clearInterval(interval)
  })
}
```

The `data` object is preserved across updates for the same module. Use it for small pieces of state.

```ts
let count = Number(import.meta.hot?.data.count ?? 0)

export function increment() {
  count++
}

if (import.meta.hot) {
  import.meta.hot.dispose((data) => {
    data.count = count
  })
}
```

### Invalidating updates

Call `invalidate()` inside an accept callback when the update cannot be applied safely. If no other boundary accepts the update, the browser reloads.

```ts
if (import.meta.hot) {
  import.meta.hot.accept((module) => {
    if (typeof module.value !== 'number') {
      import.meta.hot?.invalidate('Updated module no longer exports value')
      return
    }
  })
}
```

### Server update events

When the browser HMR channel comes from `remix/node-hmr/runtime`, server updates are sent to browser modules as `server:update` events.

```ts
if (import.meta.hot) {
  import.meta.hot.on('server:update', () => {
    window.location.reload()
  })
}
```

## Related Packages

- [`fetch-router`](https://github.com/remix-run/remix/tree/main/packages/fetch-router) - A Fetch-based router that pairs naturally with `assets`
- [`node-hmr`](https://github.com/remix-run/remix/tree/main/packages/node-hmr) - Provides the server-side `import.meta.hot` runtime and browser HMR channel used by `hmr`
- [`ui-hmr`](https://github.com/remix-run/remix/tree/main/packages/ui-hmr) - Provides a Remix UI component HMR loader for `scripts.loaders`

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
