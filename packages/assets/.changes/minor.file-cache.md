BREAKING CHANGE: `files.cache` accepts a `FileCache` with `get(key)` and `put(key, file)` methods instead of a `FileStorage`. Transformed outputs are cached on disk by default, with up to 256 reusable entries of 4 MiB each including metadata. Custom caches control their own limits and eviction policy (see #11859).

Remove an existing `FileStorage` option to use the bounded default cache in `node_modules/.cache/remix/assets` under `rootDir`:

```diff
-import { createFsFileStorage } from 'remix/file-storage/fs'

 let assetServer = createAssetServer({
   files: {
-    cache: createFsFileStorage('.tmp/assets-cache'),
     extensions: ['.svg', '.png'],
   },
 })
```

To retain recomputation on every request, set `files.cache: false`:

```diff
 let assetServer = createAssetServer({
   files: {
+    cache: false,
     extensions: ['.svg', '.png'],
   },
 })
```

The exported `FileCache` interface accepts synchronous or asynchronous methods. `get` returns a `File` or `null` for a miss; `put` stores or replaces the ordinary file without returning a value. Implementations may decline admission or evict entries, and must preserve the file's bytes and metadata. `files.cacheKey` continues to namespace outputs for reuse across server restarts; change it when sources or transforms change. Existing cache entries from older formats are not reused.
