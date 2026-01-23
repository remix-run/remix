### Resolution batching and caching

Batch all bare specifier resolutions into a single esbuild call per file, and cache results.

**Acceptance Criteria:**

- [x] All bare specifiers from a file are resolved in one esbuild call
- [x] Resolution results are cached by (specifier, importer directory)
- [x] Cache is used on subsequent requests
- [x] Measurable performance improvement (22x faster on cache hit: 13.7ms → 0.6ms)
