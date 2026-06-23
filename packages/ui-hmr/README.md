# ui-hmr

Hot module replacement module hooks for Remix UI components.

`ui-hmr` rewrites supported Remix UI component modules so they can use the standard `import.meta.hot` APIs provided by packages like [`assets`](https://github.com/remix-run/remix/tree/main/packages/assets) and [`node-hmr`](https://github.com/remix-run/remix/tree/main/packages/node-hmr).

## Features

- **Stable Components** - Keep component identity stable while swapping implementations
- **Remount Fallbacks** - Mark components stale when their setup scope changes
- **Node Module Hooks** - Transform server component modules through Node's module hook API
- **Browser Module Hooks** - Transform browser component modules through `remix/assets`

## Installation

```sh
npm i remix
```

## Usage

Use `remix/ui-hmr/node` as a Node import hook for server modules:

```sh
node --import remix/node-tsx --import remix/ui-hmr/node ./server.ts
```

Use `uiHmr()` from `remix/ui-hmr/browser-module-hooks` with `remix/assets` for browser modules:

```ts
import { createAssetServer } from 'remix/assets'
import { uiHmr } from 'remix/ui-hmr/browser-module-hooks'

let isDevelopment = process.env.NODE_ENV === 'development'

let assetServer = createAssetServer({
  basePath: '/assets',
  fileMap: { '/app/*path': 'app/*path' },
  allow: ['app/**'],
  hmr: isDevelopment
    ? async () => (await import('remix/node-hmr/runtime')).createBrowserHmrChannel()
    : undefined,
  scripts: {
    moduleHooks: isDevelopment ? [uiHmr()] : undefined,
  },
  watch: isDevelopment,
})
```

## Direct Transforms

Use the direct transform APIs when you are writing your own module hooks or build integration.

```ts
import { transformComponentsForBrowser } from 'remix/ui-hmr'

let result = transformComponentsForBrowser(source, {
  importSource: 'remix',
  moduleUrl: '/assets/app/routes.tsx',
})

if (result.transformed) {
  console.log(result.componentNames)
}
```

`transformComponentsForBrowser(source, options)` rewrites browser component modules and emits `import.meta.hot.accept()` code for browser updates. The direct transform uses `importSource` to derive imports for the UI refresh runtime and browser HMR runtime.

```ts
import { transformComponentsForServer } from 'remix/ui-hmr'

let result = transformComponentsForServer(source, {
  importSource: 'remix',
  moduleUrl: 'file:///app/routes.tsx',
})
```

`transformComponentsForServer(source, options)` rewrites server component modules and registers updated component implementations for the current module URL. The direct transform uses `importSource` to derive imports for the server HMR runtime.

Both transforms return:

```ts
type ComponentsHmrTransformResult = {
  code: string
  componentNames: string[]
  map: string | null
  transformed: boolean
}
```

Pass `sourceMap: true` to generate a source map.

Use `importSource` to define where injected imports come from, typically either `remix` or `@remix-run`:

```ts
transformComponentsForBrowser(source, {
  importSource: 'remix',
  moduleUrl: '/assets/app/routes.tsx',
})

transformComponentsForServer(source, {
  importSource: 'remix',
  moduleUrl: 'file:///app/routes.tsx',
})
```

`importSource: 'remix'` generates imports from `remix/ui` and `remix/ui-hmr`. `importSource: '@remix-run'` generates imports from `@remix-run/ui` and `@remix-run/ui-hmr`. Custom import sources follow the same nested import layout.

## Runtime Imports

The `remix/ui-hmr/browser-runtime` and `remix/ui-hmr/server-runtime` imports are public so generated code can target them directly. Most apps should not call these runtime functions by hand; use the module hooks or direct transforms instead.

## Related Packages

- [`assets`](https://github.com/remix-run/remix/tree/main/packages/assets) - Runs browser module hooks while compiling assets
- [`node-hmr`](https://github.com/remix-run/remix/tree/main/packages/node-hmr) - Provides the server-side `import.meta.hot` runtime
- [`ui`](https://github.com/remix-run/remix/tree/main/packages/ui) - Component APIs transformed by `ui-hmr`

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
