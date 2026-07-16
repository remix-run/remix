BREAKING CHANGE: `createAssetServer()` from `remix/assets` now uses `allowFiles` and `denyFiles` instead of `allow` and `deny` for file path access rules.

```ts
import { createAssetServer } from 'remix/assets'

// Before:
export const assetServer = createAssetServer({
  allow: ['app/assets/**'],
  deny: ['app/**/*.server.*'],
  /* ... */
})

// After:
export const assetServer = createAssetServer({
  allowFiles: ['app/assets/**'],
  denyFiles: ['app/**/*.server.*'],
  /* ... */
})
```
