# `assets` CHANGELOG

This is the changelog for [`assets`](https://github.com/remix-run/remix/tree/main/packages/assets). It follows [semantic versioning](https://semver.org/).

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
