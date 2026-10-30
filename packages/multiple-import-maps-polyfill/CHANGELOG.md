## v1.0.1

### Patch Changes

- Fix `importShim()` throwing `Cannot destructure property 'l'` under a Content Security Policy without `'unsafe-eval'` when a module has both a static import and a dynamic `import()` ([#12059](https://github.com/remix-run/remix/pull/12059))

  Modules are now parsed with the asm.js build of `es-module-lexer` (`es-module-lexer/minimal/js`), the build ES Module Shims uses. The default build decodes import specifiers with `eval`, so a CSP without `'unsafe-eval'` silently dropped every static import from the module graph. The asm.js build needs neither `'unsafe-eval'` nor `'wasm-unsafe-eval'`, so a CSP only has to allow `blob:` module scripts.

## v1.0.0

### Major Changes

- First stable release.

## v0.1.1

### Patch Changes

- Declare which package modules have side effects.

## v0.1.0

### Minor Changes

- Added `@remix-run/multiple-import-maps-polyfill` for loading JavaScript modules that depend on import maps added after the initial page load. `importModule()` detects browser support and uses native imports where possible. `detectMultipleImportMapSupport()` exposes the same support check, while `importShim()` and `preloadShim()` always use the polyfill. Modules preloaded through the polyfill are reused by later imports (see #11706).

  `importModule()` resolves relative paths and import map scopes using its `parentUrl` argument, which defaults to the document's base URL. See the [usage guide](https://github.com/remix-run/remix/tree/main/packages/multiple-import-maps-polyfill#usage) for client entry and HMR setup, including [Content Security Policy requirements](https://github.com/remix-run/remix/tree/main/packages/multiple-import-maps-polyfill#content-security-policy).

## Unreleased
