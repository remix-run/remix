/**
 * A cache of files addressed by opaque string keys. Implementations own admission,
 * eviction, and persistence, and may discard entries at any time.
 */
export interface FileCache {
  /**
   * Returns a cached file, preserving its bytes, name, type, and `lastModified` value.
   *
   * @param key The cache key.
   * @returns The file, or `null` for a cache miss.
   */
  get(key: string): File | null | Promise<File | null>
  /**
   * Stores or replaces a file. The cache may decline to store it according to its policy.
   *
   * @param key The cache key.
   * @param file The file to cache.
   * @returns The stored file or no value, optionally wrapped in a promise. The asset server ignores this value.
   */
  put(key: string, file: File): File | void | Promise<File | void>
}
