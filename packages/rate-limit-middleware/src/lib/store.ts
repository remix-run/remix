/** Input for one atomic fixed-window counter increment. */
export interface RateLimitStoreIncrement {
  /** Stable, non-secret identifier for the client bucket. */
  readonly key: string
  /** Name of the rate limit policy. */
  readonly name: string
  /** Window size in milliseconds. */
  readonly window: number
}

/** Result of one atomic fixed-window counter increment. */
export interface RateLimitStoreEntry {
  /** Number of requests counted in the active window. */
  readonly count: number
  /** Unix epoch timestamp in milliseconds when the active window resets. */
  readonly resetAt: number
}

/** Storage adapter used by `rateLimit()` to count requests. */
export interface RateLimitStore {
  /**
   * Atomically increments one policy and client bucket.
   *
   * @param input Policy, client key, and window configuration.
   * @returns The updated count and reset timestamp.
   */
  increment(input: RateLimitStoreIncrement): Promise<RateLimitStoreEntry>
}

interface MemoryBucket {
  count: number
  resetAt: number
}

interface MemoryWindow {
  current: Map<string, MemoryBucket>
  previous: Map<string, MemoryBucket>
  rotateAt: number
}

/**
 * Creates a fixed-window store for deliberate single-process use.
 *
 * Inactive buckets are discarded by rotating map generations instead of scanning every bucket on
 * each request. Multi-process and multi-host deployments should use a shared store.
 *
 * @returns An in-memory rate limit store.
 */
export function memoryStore(): RateLimitStore {
  let windows = new Map<number, MemoryWindow>()

  return {
    async increment(input) {
      let now = Date.now()
      let memoryWindow = windows.get(input.window)

      if (memoryWindow == null) {
        memoryWindow = {
          current: new Map(),
          previous: new Map(),
          rotateAt: now + input.window,
        }
        windows.set(input.window, memoryWindow)
      } else {
        rotateMemoryWindow(memoryWindow, input.window, now)
      }

      let bucketKey = JSON.stringify([input.name, input.key])
      let bucket = memoryWindow.current.get(bucketKey)

      if (bucket == null) {
        bucket = memoryWindow.previous.get(bucketKey)
        memoryWindow.previous.delete(bucketKey)
      }

      if (bucket == null || bucket.resetAt <= now) {
        bucket = { count: 0, resetAt: now + input.window }
      }

      bucket.count += 1
      memoryWindow.current.set(bucketKey, bucket)

      return { count: bucket.count, resetAt: bucket.resetAt }
    },
  }
}

/**
 * Rotates inactive in-memory buckets without iterating over client keys.
 *
 * @param memoryWindow Generational maps for one window duration.
 * @param window Window size in milliseconds.
 * @param now Current Unix epoch timestamp in milliseconds.
 */
function rotateMemoryWindow(memoryWindow: MemoryWindow, window: number, now: number): void {
  if (now < memoryWindow.rotateAt) return

  if (now >= memoryWindow.rotateAt + window) {
    memoryWindow.previous = new Map()
    memoryWindow.current = new Map()
  } else {
    memoryWindow.previous = memoryWindow.current
    memoryWindow.current = new Map()
  }

  let elapsedWindows = Math.floor((now - memoryWindow.rotateAt) / window) + 1
  memoryWindow.rotateAt += elapsedWindows * window
}
