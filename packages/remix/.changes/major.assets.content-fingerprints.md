BREAKING CHANGE: Fingerprinted assets from `remix/assets` now use hashes of their final emitted bytes instead of per-build source hashes. Replace `createAssetServer({ fingerprint: { buildId } })` with `createAssetServer({ fingerprint: true })`.

If you enabled fingerprinting in `app/assets.ts`, update the option:

```diff
 import { createAssetServer } from 'remix/assets'

 export const assets = createAssetServer({
   basePath: '/assets',
-  fingerprint: { buildId: process.env.GIT_COMMIT_SHA },
+  fingerprint: true,
   // ...
 })
```

If you use `files.cache` and previously relied on `fingerprint.buildId` to namespace persisted transformed file cache entries, move that value to `files.cacheKey`:

```diff
 export const assets = createAssetServer({
   files: {
     cache,
+    cacheKey: process.env.GIT_COMMIT_SHA,
   },
   fingerprint: true,
   // ...
 })
```
