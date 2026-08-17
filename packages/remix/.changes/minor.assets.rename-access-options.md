BREAKING CHANGE: `createAssetServer()` from `remix/assets` now uses `allowFiles` and `denyFiles` instead of `allow` and `deny` for file path access rules:

```diff
 import { createAssetServer } from 'remix/assets'

 export const assetServer = createAssetServer({
-  allow: ['app/routes.ts', 'app/**/public/**'],
-  deny: ['app/**/*.test.*'],
+  allowFiles: ['app/routes.ts', 'app/**/public/**'],
+  denyFiles: ['app/**/*.test.*'],
 })
```
