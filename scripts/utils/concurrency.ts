/**
 * Simple concurrency limiter for running async tasks in parallel with a maximum
 * number of concurrent operations.
 */

interface ConcurrencyLimiter {
  <Result>(fn: () => Promise<Result>): Promise<Result>
}

/**
 * Creates a concurrency limiter that allows at most `limit` concurrent operations.
 * Similar to p-limit but without the external dependency.
 */
function createLimiter(limit: number): ConcurrencyLimiter {
  let active = 0
  let queue: Array<() => void> = []

  function next() {
    if (queue.length > 0 && active < limit) {
      let resolve = queue.shift()!
      resolve()
    }
  }

  return async function limiter<Result>(fn: () => Promise<Result>): Promise<Result> {
    // Wait for a slot to become available
    if (active >= limit) {
      await new Promise<void>((resolve) => queue.push(resolve))
    }

    active++
    try {
      return await fn()
    } finally {
      active--
      next()
    }
  }
}

/**
 * Run multiple async operations in parallel with a concurrency limit.
 * Returns results in the same order as the input items.
 */
export async function mapWithConcurrency<Item, Result>(
  items: Item[],
  limit: number,
  fn: (item: Item) => Promise<Result>,
): Promise<Result[]> {
  let limiter = createLimiter(limit)
  return Promise.all(items.map((item) => limiter(() => fn(item))))
}
