Add an `allowPackages` option to `createAssetServer()` from `remix/assets`. This allows a package and its dependencies to be served without listing every file the package may load:

```ts
import { createAssetServer } from 'remix/assets'

export const assetServer = createAssetServer({
  allowFiles: ['app/routes.ts', 'app/**/public/**'],
  allowPackages: ['remix'],
})
```
