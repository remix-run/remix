## v0.1.0

### Minor Changes

- Added `@remix-run/multiple-import-maps-polyfill` for loading JavaScript modules that depend on import maps added after the initial page load. `importModule()` detects browser support and uses native imports where possible. `detectMultipleImportMapSupport()` exposes the same support check, while `importShim()` and `preloadShim()` always use the polyfill. Modules preloaded through the polyfill are reused by later imports (see #11706).

  `importModule()` resolves relative paths and import map scopes using its `parentUrl` argument, which defaults to the document's base URL. See the [usage guide](https://github.com/remix-run/remix/tree/main/packages/multiple-import-maps-polyfill#usage) for client entry and HMR setup, including [Content Security Policy requirements](https://github.com/remix-run/remix/tree/main/packages/multiple-import-maps-polyfill#content-security-policy).

## Unreleased
