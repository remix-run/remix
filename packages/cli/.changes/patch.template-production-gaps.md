New apps now fingerprint assets in production and close the asset server on shutdown. With `NODE_ENV=production`, asset URLs include a content hash and are served with `Cache-Control: public, max-age=31536000, immutable` instead of `no-cache`. The `SIGINT` and `SIGTERM` handlers in `server.ts` also await `assets.close()` before exiting.

Existing generated apps can apply the same setup:

```diff
 // app/assets.ts
 const isDevelopment = nodeEnv === 'development'
+const isProduction = nodeEnv === 'production'

 export const assets = createAssetServer({
   minify: !isDevelopment,
+  fingerprint: isProduction,
   watch: isDevelopment,
 })
```

```diff
 // server.ts
+import { assets } from './app/assets.ts'
 import { router } from './app/router.ts'

 function shutdown() {
-  server.close(() => process.exit(0))
+  server.close(() => assets.close().finally(() => process.exit(0)))
 }
```
