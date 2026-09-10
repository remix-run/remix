Add an `importMaps` option to `createAssetServer()`, with a default value of `true`. Set it to `false` to rewrite internal script imports to their served URLs instead of relying on generated import maps.

```ts
import { createAssetServer } from 'remix/assets'

let assetServer = createAssetServer({
  basePath: '/assets',
  importMaps: false,
  // ...
})
```

The option is also supported as `assets.importMaps` in `remix.json`.

When import maps are disabled, `getImportMap()` returns `{ imports: {} }`, and `getScriptEntry()` includes the same empty value in its `importMap` field. With fingerprinting enabled, dependency changes produce new URLs for the affected import chain.
