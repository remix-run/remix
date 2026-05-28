BREAKING CHANGE: `createAssetServer()` now uses `allowFiles` and `denyFiles` instead of `allow` and `deny` for file path access rules.

Migration guide:

```diff
import { createAssetServer } from 'remix/assets'

export const assetServer = createAssetServer({
-  allow: ['app/assets/**'],
+  allowFiles: ['app/assets/**'],
-  deny: ['app/**/*.server.*'],
+  denyFiles: ['app/**/*.server.*']
  /* ... */
})
```
