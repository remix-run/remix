/**
 * Result of incrementing a rate limit bucket.
 */
export interface RateLimitStoreEntry {
  /**
   * Number of requests counted in the active window.
   */
  count: number
  /**
   * Unix epoch timestamp in milliseconds when the active window resets.
   */
  resetAt: number
}

/**
 * Storage adapter used by `rateLimit()` to count requests per key.
 *
 * Adapters should increment the bucket for `key` in an atomic operation and return the new count
 * plus the timestamp when the current window resets.
 */
export interface RateLimitStore {
  /**
   * Increment the count for a key in the current window.
   *
   * @param key Bucket identifier.
   * @param window Window size in milliseconds.
   * @returns The updated bucket count and reset timestamp.
   */
  increment(key: string, window: number): Promise<RateLimitStoreEntry>

  /**
   * Delete any stored bucket for a key.
   *
   * @param key Bucket identifier.
   * @returns A promise that resolves when the key has been reset.
   */
  reset(key: string): Promise<void>
}

interface MemoryBucket {
  count: number
  resetAt: number
}

/**
 * Creates an in-memory fixed-window store.
 *
 * @returns A store that keeps counters in the current JavaScript process.
 */
export function memoryStore(): RateLimitStore {
  let buckets = new Map<string, MemoryBucket>()

  return {
    async increment(key, window) {
      let now = Date.now()
      let bucket = buckets.get(key)

      if (bucket == null || bucket.resetAt <= now) {
        bucket = {
          count: 0,
          resetAt: now + window,
        }
      }

      bucket.count += 1
      buckets.set(key, bucket)
      pruneExpiredBuckets(buckets, now)

      return {
        count: bucket.count,
        resetAt: bucket.resetAt,
      }
    },

    async reset(key) {
      buckets.delete(key)
    },
  }
}

function pruneExpiredBuckets(buckets: Map<string, MemoryBucket>, now: number): void {
  for (let [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key)
    }
  }
}
