# `assets` CHANGELOG

This is the changelog for [`assets`](https://github.com/remix-run/remix/tree/main/packages/assets). It follows [semantic versioning](https://semver.org/).

## v0.7.0

### Minor Changes

- BREAKING CHANGE: Fingerprinted assets now use hashes of their final emitted bytes instead of per-build source hashes. Replace `createAssetServer({ fingerprint: { buildId } })` with `createAssetServer({ fingerprint: true })` (see #11706).

  If you enabled fingerprinting in `app/assets.ts`, update the option:

  ```diff
   import { createAssetServer } from 'remix/assets'

   export const assets = createAssetServer({
     basePath: '/assets',
  -  fingerprint: { buildId: process.env.GIT_COMMIT_SHA },
  +  fingerprint: true,
     // ...
   })
  ```

  If you use `files.cache` and previously relied on `fingerprint.buildId` to namespace persisted transformed file cache entries, move that value to `files.cacheKey`:

  ```diff
   export const assets = createAssetServer({
     files: {
       cache,
  +    cacheKey: process.env.GIT_COMMIT_SHA,
     },
     fingerprint: true,
     // ...
   })
  ```

  Production servers can then reuse transformed file outputs across restarts for the same build. When `files.cacheKey` is omitted, transformed file caches use a random per-process namespace.

- BREAKING CHANGE: Custom browser HMR update events now carry JSON data in a `data` record instead of top-level `timestamp` and `updates` fields (see #11706).

  Apps using the standard asset server and `createBrowserHmrChannel()` integration need no changes to their event handling. Give each tool a separate key in the record, for example `{ type: 'update', data: { 'my-tool@1': { version: 1 } } }`.

  ```diff
   type BrowserHmrEvent = {
     type: 'update'
  -  timestamp: number
  -  updates: HmrBrowserUpdate[]
  +  data: Record<string, BrowserHmrData>
   }
  ```

- BREAKING CHANGE: Browser scripts now use import maps to resolve imports instead of rewriting import specifiers to asset URLs (see #11706). Apps must render each script entry's import map before its modulepreload links and module script.

  To migrate an app created from the Remix app template:

  In `app/assets.ts`, replace the separate entry href and preload calls with `getScriptEntry()`:

  ```diff
   const entry = 'app/actions/public/entry.ts'
  -export const entryHref = await assets.getHref(entry)
  -export const entryPreloads = await assets.getPreloads(entry)
  +export const scriptEntry = await assets.getScriptEntry(entry)
  ```

  HMR appends mappings for updated modules to the document in additional `<script type="importmap">` elements. When HMR must support browsers without native support for multiple import maps, configure `remix/multiple-import-maps-polyfill` as its module importer:

  ```diff
   export const assets = createAssetServer({
     // ...
     hmr: isHmr
  -    ? async () => (await import('remix/node-hmr/runtime')).createBrowserHmrChannel()
  +    ? {
  +        channel: async () =>
  +          (await import('remix/node-hmr/runtime')).createBrowserHmrChannel(),
  +        moduleImporter: 'remix/multiple-import-maps-polyfill',
  +      }
       : undefined,
     scripts: { loaders: isHmr ? [uiHmr()] : undefined },
   })
  ```

  In `app/actions/document.tsx`, render the managed import map before the entry's preloads and module script:

  ```diff
   import type { Handle, RemixNode } from 'remix/ui'
   import { css } from 'remix/ui'
  +import { ImportMap } from 'remix/ui/server'

  -import { entryHref, entryPreloads } from '../assets.ts'
  +import { scriptEntry } from '../assets.ts'

   export function Document(handle: Handle<DocumentProps>) {
     return () => {
       let { children, head, title = DEFAULT_TITLE } = handle.props
  +    let { href, importMap, preloads } = scriptEntry

       return (
         <html lang="en">
           <head>
             {/* ... */}
  -          {entryPreloads.map((href) => (
  -            <link key={href} rel="modulepreload" href={href} />
  +          <ImportMap value={importMap} />
  +          {preloads.map((preloadHref) => (
  +            <link key={preloadHref} rel="modulepreload" href={preloadHref} />
             ))}
  -          <script type="module" src={entryHref}></script>
  +          <script type="module" src={href}></script>
           </head>
           {/* ... */}
  ```

  `<ImportMap>` combines the entry map with mappings from blocking client entries so the initial document contains a single complete import map. Regular `<script type="importmap">` elements remain supported when this behavior is not needed.

  The standard `render({ assets })` middleware resolves client entries with `getScriptEntry()` and includes their import maps in rendered documents and frame responses. Custom rendering pipelines must include the returned `importMap` in their `resolveClientEntry()` metadata.

  In `app/actions/public/entry.ts`, use `importModule()` to load client entries and `processClientEntryPreloads` to preload them in browsers that need the polyfill:

  ```ts
  import {
    detectMultipleImportMapSupport,
    importModule,
    preloadShim,
  } from 'remix/multiple-import-maps-polyfill'
  import { run } from 'remix/ui'

  run({
    async loadModule(moduleUrl, exportName) {
      let module = await importModule(moduleUrl)
      let Component = module[exportName]
      if (typeof Component !== 'function') {
        throw new Error(`Unknown component: ${moduleUrl}#${exportName}`)
      }
      return Component
    },
    async processClientEntryPreloads(preloads) {
      if (await detectMultipleImportMapSupport()) return preloads

      preloadShim(preloads)
      return []
    },
  })
  ```

  Modules referenced by dynamic `import()` expressions are now fetched when the import runs, instead of being preloaded with the entry script. Imports with static specifiers still have entries in the import map.

  The HMR module importer must be included in the initial import map. Importing it from the main client entry, as shown above, meets this requirement. If your app sets a Content Security Policy, follow the [polyfill CSP requirements](https://github.com/remix-run/remix/tree/main/packages/multiple-import-maps-polyfill#content-security-policy).

  If you call `renderToStream()` directly, resolve client entries with `getScriptEntry()` and include their `importMap` in the object returned from `resolveClientEntry()`:

  ```diff
   let stream = renderToStream(node, {
     async resolveClientEntry(entryId, component) {
  -    let [href, preloads] = await Promise.all([
  -      assets.getHref(entryId),
  -      assets.getPreloads(entryId),
  -    ])
  +    let { href, importMap, preloads } = await assets.getScriptEntry(entryId)

       return {
         href,
  +      importMap,
         exportName: component.name,
         preloads,
       }
     },
   })
  ```

  `assets.getImportMap()` combines import maps for multiple script entries. The public types are `ScriptEntry` and `ScriptImportMap`.

  In development, HMR installs new import map entries before loading an update. If an existing mapping would change, it reloads the page. Custom HMR importers can use `hmr.moduleImporter`, a module specifier resolved relative to the asset server root. That module must export `importModule(specifier, parentUrl)`.

### Patch Changes

- Fixed `IMPORT_OUTSIDE_MOUNTS` errors when serving dependencies installed in pnpm's global virtual store outside `rootDir`. The asset server now finds the store automatically, without requiring an extra mount in your configuration (see #11814).

## v0.6.0

### Minor Changes

- BREAKING CHANGE: In `createAssetServer`, replace the `fileMap` option with optional directory-based `mounts`. Mounts recursively preserve the path beneath each public and filesystem root, keeping module URLs aligned with the filesystem hierarchy used for package resolution.

  When `mounts` is omitted, the asset server uses `{ app: 'app', npm: 'node_modules' }`.

  To migrate an app whose `fileMap` is equivalent to the new defaults, remove the `fileMap` option entirely:

  ```ts
  // before
  createAssetServer({
    basePath: '/assets',
    fileMap: {
      '/app/*path': 'app/*path',
      '/npm/*path': 'node_modules/*path',
    },
    // ...
  })

  // after
  createAssetServer({
    basePath: '/assets',
    // ...
  })
  ```

  To migrate custom `fileMap` rules that preserve directory hierarchy, remove the trailing wildcard from both sides and rename `fileMap` to `mounts`:

  ```ts
  // before
  createAssetServer({
    basePath: '/assets',
    fileMap: {
      '/source/*path': 'app/*path',
      '/vendor/*path': 'node_modules/*path',
    },
    // ...
  })

  // after
  createAssetServer({
    basePath: '/assets',
    mounts: {
      source: 'app',
      vendor: 'node_modules',
    },
    // ...
  })
  ```

- Add `assetServer.getAssets()` for listing browser-reachable files and `assetServer.getAssetDetails(urlOrFile)` for inspecting URL mappings, file types, access rules, and reachability status. These APIs use the asset server's configured mapping and access policy, so diagnostic results match request handling (see #11726).

## v0.5.0

### Minor Changes

- BREAKING CHANGE: `createAssetServer()` now uses `allowFiles` and `denyFiles` instead of `allow` and `deny` for file path access rules.

  ```ts
  import { createAssetServer } from 'remix/assets'

  // Before:
  export const assetServer = createAssetServer({
    allow: ['app/routes.ts', 'app/**/public/**'],
    deny: ['app/**/*.test.*'],
    /* ... */
  })

  // After:
  export const assetServer = createAssetServer({
    allowFiles: ['app/routes.ts', 'app/**/public/**'],
    denyFiles: ['app/**/*.test.*'],
    /* ... */
  })
  ```

- Add an `allowPackages` option to `createAssetServer()` for package-level access control, allowing packages and their dependencies to be served, e.g. `allowPackages: ['remix']`

- Added `hmr` support to `createAssetServer` that provides an `import.meta.hot` API to JS assets.

- Added `scripts.loaders` to `createAssetServer` for post-processing compiled JavaScript with Node-compatible synchronous loaders.

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`route-pattern@0.24.0`](https://github.com/remix-run/remix/releases/tag/route-pattern@0.24.0)

## v0.4.4

### Patch Changes

- Fixed asset route resolution for URL pathnames that contain percent-encoded file path characters, including scoped package names such as `%40remix-run`.

- Bumped `@remix-run/*` dependencies:
  - [`file-storage@0.13.7`](https://github.com/remix-run/remix/releases/tag/file-storage@0.13.7)
  - [`mime@0.4.2`](https://github.com/remix-run/remix/releases/tag/mime@0.4.2)
  - [`route-pattern@0.23.0`](https://github.com/remix-run/remix/releases/tag/route-pattern@0.23.0)

## v0.4.3

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`route-pattern@0.22.1`](https://github.com/remix-run/remix/releases/tag/route-pattern@0.22.1)

## v0.4.2

### Patch Changes

- Use canonical realpath asset URLs for package imports so symlinked package paths and their real paths do not produce duplicate browser modules.

- Use polling for asset server file watching by default on Windows to avoid native filesystem watcher crashes while still allowing explicit `watch.poll` overrides.

- Bumped `@remix-run/*` dependencies:
  - [`file-storage@0.13.6`](https://github.com/remix-run/remix/releases/tag/file-storage@0.13.6)
  - [`headers@0.21.1`](https://github.com/remix-run/remix/releases/tag/headers@0.21.1)
  - [`route-pattern@0.22.0`](https://github.com/remix-run/remix/releases/tag/route-pattern@0.22.0)

## v0.4.1

### Patch Changes

- Resolve bare imports from symlinked packages using the package's real filesystem path so pnpm virtual-store dependencies can be served through the asset server (see #11438).

- Bumped `@remix-run/*` dependencies:
  - [`file-storage@0.13.5`](https://github.com/remix-run/remix/releases/tag/file-storage@0.13.5)
  - [`headers@0.21.0`](https://github.com/remix-run/remix/releases/tag/headers@0.21.0)
  - [`route-pattern@0.21.1`](https://github.com/remix-run/remix/releases/tag/route-pattern@0.21.1)

## v0.4.0

### Minor Changes

- Add support for serving configured leaf file assets via a new `files` option in `createAssetServer()`.

  Relative CSS `url()` references are now resolved through the asset server, rewriting supported file assets to asset server URLs and surfacing errors for missing or unsupported files.

### Patch Changes

- Preserve `node_modules` package symlink identity paths when rewriting script imports, while still reading, caching, and invalidating modules through their canonical real paths.

- Bumped `@remix-run/*` dependencies:
  - [`headers@0.20.0`](https://github.com/remix-run/remix/releases/tag/headers@0.20.0)
  - [`route-pattern@0.21.0`](https://github.com/remix-run/remix/releases/tag/route-pattern@0.21.0)

## v0.3.0

### Minor Changes

- BREAKING CHANGE: `createAssetServer()` now requires a `basePath` option, and `fileMap` URL patterns are now relative to that base path.

  ```ts
  // Before:
  createAssetServer({
    fileMap: {
      '/assets/app/*path': 'app/*path',
      '/assets/npm/*path': 'node_modules/*path',
    },
    allow: ['app/**', 'node_modules/**'],
  })

  // After:
  createAssetServer({
    basePath: '/assets',
    fileMap: {
      '/app/*path': 'app/*path',
      '/npm/*path': 'node_modules/*path',
    },
    allow: ['app/**', 'node_modules/**'],
  })
  ```

### Patch Changes

- The `@oxc-project/runtime` package which provides helpers for generated code targeting older browsers is now served automatically by the asset server and doesn't need to be manually installed.

## v0.2.0

### Minor Changes

- BREAKING CHANGE: `target` configuration is now configured at the top level with an object format, supporting `es` version targets along with browser version targets.

  Browser targets are configured with string versions such as `target: { chrome: '109', safari: '16.4' }`, and scripts can specify `es` as a year of `2015` or higher such as `target: { es: '2020' }`.

  To migrate existing script configuration, replace `scripts.target` options like `scripts: { target: 'es2020' }` with `target: { es: '2020' }`.

- BREAKING CHANGE: Shared compiler options are now provided at the top level of `createAssetServer()`. Use `sourceMaps`, `sourceMapSourcePaths`, and `minify` directly on the asset server options instead of being nested under `scripts`. This allows these options to also be used for styles as well as scripts.

  To migrate existing configuration, move `scripts.minify`, `scripts.sourceMaps`, `scripts.sourceMapSourcePaths` to the top-level asset server options.

- `createAssetServer()` now compiles and serves `.css` files alongside scripts, including local `@import` rewriting, fingerprinting, and shared compiler options for minification, source maps, and browser compatibility targeting.

### Patch Changes

- Fix matching of dot-prefixed files and directories in `allow` and `deny` globs

- Improve asset server import errors to include the resolved file path when a resolved import is later rejected by validation for allow/deny rules, supported file types and `fileMap` configuration.

## v0.1.0

### Minor Changes

- Initial release of `@remix-run/assets`.

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`route-pattern@0.20.1`](https://github.com/remix-run/remix/releases/tag/route-pattern@0.20.1)
