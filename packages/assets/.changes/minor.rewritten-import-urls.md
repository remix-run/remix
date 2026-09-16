Add an `importMaps` option to `createAssetServer()`, with a default value of `true`.

Set it to `false` to allow scripts to run outside the document, such as in Web Workers and Service Workers, by rewriting imports to their resolved asset URLs. This gives up the fine-grained caching provided by import maps, so changing one module may require browsers to also download its importers again. Applications that need both behaviors can use one asset server for document scripts and another for scripts that run outside the document.

```ts
import { createAssetServer } from 'remix/assets'

let assetServer = createAssetServer({
  basePath: '/assets',
  importMaps: false,
  // ...
})
```
