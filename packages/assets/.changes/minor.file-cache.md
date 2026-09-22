Customize transformed-file caching through the new `FileCache` interface, which requires only `get` and `put` methods. Existing `FileStorage` backends remain compatible without configuration changes (see #11859).

The new `createFsFileCache()` factory provides an opt-in filesystem LRU cache with configurable directory, entry count, and per-file and total size limits. It accepts native `File` objects and structurally compatible implementations such as `LazyFile`. Caching remains disabled when `files.cache` is omitted.

Reduce memory allocations when serving and caching transformed files.
