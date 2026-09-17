Allow applications to customize transformed-file caching through a `FileCache` with only `get(key)` and `put(key, file)` methods. Existing `FileStorage` backends remain compatible and need no configuration changes. Custom caches control their own limits, eviction, and persistence (see #11859).

When `files.cache` is omitted, transformed outputs now use a default disk cache in `node_modules/.cache/remix/assets` under `rootDir`, with up to 256 reusable entries shared across namespaces and 4 MiB per stored entry including metadata. To retain recomputation on every request, set `files.cache: false`:

```diff
 let assetServer = createAssetServer({
   files: {
+    cache: false,
     extensions: ['.svg', '.png'],
   },
 })
```

The exported `FileCache` interface accepts synchronous or asynchronous methods. `get` returns a `File` or `null` for a miss; `put` may return a stored `File` or no value. Implementations may decline admission or evict entries, and must preserve the file's bytes and metadata. `files.cacheKey` continues to namespace outputs for reuse across server restarts; change it when sources or transforms change. Existing cache entries from older formats are not reused.
