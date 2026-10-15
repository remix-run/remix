import type { FileCache } from './file-cache.ts';
/** Directory and limits for a filesystem file cache. */
export interface FsFileCacheOptions {
    /**
     * Directory dedicated to this cache, created on first use if needed.
     * Defaults to `node_modules/.cache/remix/assets`. Relative paths resolve from
     * `process.cwd()` when the factory is called.
     */
    directory?: string;
    /** Maximum number of cached files (defaults to `1024`). */
    maxEntries?: number;
    /** Maximum bytes per stored entry, including cache metadata (defaults to 4 MiB). */
    maxFileSize?: number;
    /** Maximum total stored entry bytes, including cache metadata (defaults to 256 MiB). */
    maxTotalSize?: number;
}
/**
 * Creates a persistent filesystem cache that evicts least recently used entries.
 * Reads and writes refresh an in-memory index. On first use, the index is rebuilt
 * from stored write timestamps; read recency is not preserved across restarts.
 * Use one cache instance per directory. For shared multi-process caching, provide
 * a custom `FileCache`. Files exceeding either byte limit are not cached. All limits
 * must be positive safe integers. Storage metadata and filesystem overhead are
 * additional to the byte budgets.
 *
 * @param options Cache directory, entry count, and byte limits.
 * @returns A file cache suitable for `files.cache` in `createAssetServer()`.
 */
export declare function createFsFileCache(options?: FsFileCacheOptions): FileCache;
export declare function createTransformCacheKey(namespace: string, identity: string): Promise<string>;
//# sourceMappingURL=cache.d.ts.map