# `assets` CHANGELOG

This is the changelog for [`assets`](https://github.com/remix-run/remix/tree/main/packages/assets). It follows [semantic versioning](https://semver.org/).

## v0.3.1

### Patch Changes

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
