# multiple-import-maps-polyfill

Polyfill for dynamic JavaScript imports that depend on import maps added after the document's initial import map. Browsers with native support for multiple import maps continue to use native dynamic imports.

The module loading logic in this package was adapted from [ES Module Shims](https://github.com/guybedford/es-module-shims) by Guy Bedford.

This package assumes the initial document contains one complete import map before any module scripts. It is designed to load dynamic imports that depend on additional import maps installed after the initial page load.

## Features

- Detects native support for multiple import maps
- Loads dynamic imports through every import map in the document when a polyfill is required
- Preloads dynamic modules through the same polyfill cache
- Resolves native module types through import maps while leaving their loading semantics to the browser
- Supports import-map integrity metadata

## Installation

```sh
npm i remix
```

## Usage

Use `importModule` in place of `import()` when a dynamic import may depend on an import map added at runtime:

```ts
import { importModule } from 'remix/multiple-import-maps-polyfill'

let moduleUrl = new URL('./features/search.ts', import.meta.url).href
let feature = await importModule(moduleUrl)
feature.openSearch()
```

`importModule` uses native `import()` when the browser supports multiple import maps. In other browsers, it loads the module through the polyfill using every import map currently installed in the document.

For integrations that manage dynamic module loading and preloading separately, use `detectMultipleImportMapSupport`, `importShim`, and `preloadShim`. For example, configure Remix UI to load client entries discovered during navigation:

```ts
import {
  detectMultipleImportMapSupport,
  importShim,
  preloadShim,
} from 'remix/multiple-import-maps-polyfill'
import { run } from 'remix/ui'

let supportsMultipleImportMapsPromise = detectMultipleImportMapSupport()

run({
  async loadModule(moduleUrl, exportName) {
    let module = (await supportsMultipleImportMapsPromise)
      ? await import(moduleUrl)
      : await importShim(moduleUrl)

    return module[exportName]
  },
  async processClientEntryPreloads(preloads) {
    if (await supportsMultipleImportMapsPromise) return preloads

    preloadShim(preloads)
    return []
  },
})
```

Browsers with multiple import map support retain native module loading and native `<link rel="modulepreload">` elements. Other browsers load late client entries and preloads through the polyfill.

`detectMultipleImportMapSupport()` returns a cached promise. When it detects that the polyfill is required, it begins loading the polyfill runtime in the background so the work can overlap with a later `importShim()` or `preloadShim()` call. Browsers with multiple import map support do not load the polyfill runtime.

`importShim()` always uses the polyfill to load a dynamic JavaScript import using every import map currently installed in the document. It does not detect native support. `preloadShim()` always uses the polyfill fetch cache rather than native module preload links. Like native module preloads, it fetches only the supplied module specifier or array of specifiers and caches their responses for later imports. Preload failures are ignored. `importShim()` reports the failure if the module is later required.

## Content Security Policy

Polyfilled module graphs are evaluated from blob URLs, and `es-module-lexer` compiles its parser from Wasm. Content Security Policies must allow `blob:` module scripts and Wasm compilation with `'wasm-unsafe-eval'`.

The support detector creates a Trusted Types policy named `remix/multiple-import-maps-polyfill`. Allow this policy when Trusted Types are required for scripts, for example:

```http
Content-Security-Policy: script-src 'self' blob: 'wasm-unsafe-eval'; require-trusted-types-for 'script'; trusted-types remix/multiple-import-maps-polyfill;
```

## `remix/assets` HMR Support

HMR appends mappings for updated modules to the document in additional `<script type="importmap">` elements. Configure the Remix asset server's `hmr.moduleImporter` option to use the polyfilled `importModule` function when these updates must work in browsers without native support for multiple import maps:

```ts
import { createAssetServer } from 'remix/assets'
import { createBrowserHmrChannel } from 'remix/node-hmr/runtime'

let assets = createAssetServer({
  hmr: {
    channel: createBrowserHmrChannel,
    moduleImporter: 'remix/multiple-import-maps-polyfill',
  },
  watch: true,
})
```

The module importer and its dependencies must be available through the document's initial import map. Importing `remix/multiple-import-maps-polyfill` from the application's main client entry satisfies this requirement.

## Related Packages

- [`assets`](https://github.com/remix-run/remix/tree/main/packages/assets) - Compiles and serves browser assets
- [`ui`](https://github.com/remix-run/remix/tree/main/packages/ui) - Loads client entries discovered during navigation

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/packages/multiple-import-maps-polyfill/LICENSE)
