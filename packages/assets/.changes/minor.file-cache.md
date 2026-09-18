Allow applications to customize transformed-file caching through a `FileCache` with only `get(key)` and `put(key, file)` methods. Existing `FileStorage` backends remain compatible and need no configuration changes. Custom caches control their own limits, eviction, and persistence (see #11859).

Caching remains disabled when `files.cache` is omitted or `false`. Set `files.cache: true` to use the built-in filesystem LRU cache in `node_modules/.cache/remix/assets` under `rootDir`. It retains up to 1,024 entries and 256 MiB total, with a 4 MiB maximum per entry. Byte limits include embedded cache metadata; storage metadata, the recency index, and filesystem overhead are additional.

Call `createFsFileCache()` for the default directory and limits, or use `createFsFileCache(options)` to choose the directory and override the positive-integer `maxEntries`, `maxFileSize`, and `maxTotalSize` limits:

```diff
- import { createAssetServer } from 'remix/assets'
+ import { createAssetServer, createFsFileCache } from 'remix/assets'

  let assetServer = createAssetServer({
    basePath: '/assets',
    files: {
+     cache: createFsFileCache({
+       directory: '/var/cache/my-app/assets',
+       maxEntries: 2048,
+       maxFileSize: 8 * 1024 * 1024,
+       maxTotalSize: 512 * 1024 * 1024,
+     }),
      extensions: ['.svg', '.png'],
    },
  })
```

The factory defaults to `node_modules/.cache/remix/assets`. Relative directories resolve from `process.cwd()` when the factory is called, independently of the asset server's `rootDir`. Reads and writes refresh recency, which persists across restarts. Instances and namespaces sharing a directory share its budgets and should use the same limits. Cache operations use a filesystem lock; contention causes a miss or skips admission, and interrupted operations discard the cache on recovery.

The exported `FileCache` interface accepts synchronous or asynchronous methods. `get` returns a `File` or `null` for a miss; `put` may return a stored `File` or no value. Implementations may decline admission or evict entries, and must preserve the file's bytes and metadata. `files.cacheKey` continues to namespace outputs for reuse across server restarts; change it when sources or transforms change. Existing cache entries from older formats are not reused.
