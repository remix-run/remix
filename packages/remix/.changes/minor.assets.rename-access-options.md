BREAKING CHANGE: `createAssetServer()` from `remix/assets` now uses `allowFiles` and `denyFiles` instead of `allow` and `deny` for file path access rules.

```ts
import { createAssetServer } from 'remix/assets'

// Before:
export const assetServer = createAssetServer({
  allow: ['app/routes.ts', 'app/**/public/**'],
  deny: ['app/**/*.test.*'],
  /* ... */
})

// After:
export const assetServer = createAssetServer({
  allowFiles: ['app/routes.ts', 'app/**/public/**'],
  denyFiles: ['app/**/*.test.*'],
  /* ... */
})
```
