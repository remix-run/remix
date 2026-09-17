Allow applications to customize transformed-file caching through a `FileCache` with only `get(key)` and `put(key, file)` methods. Existing `FileStorage` backends remain compatible and need no configuration changes. Custom caches control their own limits, eviction, and persistence (see #11859).

Caching remains disabled when `files.cache` is omitted or `false`. Set `files.cache: true` to use the built-in disk cache in `node_modules/.cache/remix/assets` under `rootDir`, with up to 256 reusable entries shared across namespaces and 4 MiB per stored entry including metadata:

```diff
 let assetServer = createAssetServer({
   files: {
+    cache: true,
     extensions: ['.svg', '.png'],
   },
 })
```

To use the same bounded cache in a custom directory, pass the exported `createFsFileCache(directory)` factory:

```diff
 import { createAssetServer } from 'remix/assets'
+import { createFsFileCache } from 'remix/assets'

 let assetServer = createAssetServer({
   files: {
-    cache: true,
+    cache: createFsFileCache('/var/cache/my-app/assets'),
     extensions: ['.svg', '.png'],
   },
 })
```

Relative directories resolve from `process.cwd()` when the factory is called, independently of the asset server's `rootDir`.

The exported `FileCache` interface accepts synchronous or asynchronous methods. `get` returns a `File` or `null` for a miss; `put` may return a stored `File` or no value. Implementations may decline admission or evict entries, and must preserve the file's bytes and metadata. `files.cacheKey` continues to namespace outputs for reuse across server restarts; change it when sources or transforms change. Existing cache entries from older formats are not reused.
