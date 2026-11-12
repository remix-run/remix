const realSetTimeout = globalThis.setTimeout.bind(globalThis)
const realClearTimeout = globalThis.clearTimeout.bind(globalThis)

export function waitFor<result>(
  condition: () => result | PromiseLike<result>,
  options: { interval?: number; timeout?: number } = {},
  signal: AbortSignal,
): Promise<Awaited<result>> {
  if (typeof condition !== 'function') {
    throw new TypeError('condition must be a function')
  }
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('options must be an object')
  }

  let { interval = 50, timeout = 1000 } = options
  validateDelay(interval, 'options.interval')
  validateDelay(timeout, 'options.timeout')

  let { promise, resolve, reject } = Promise.withResolvers<Awaited<result>>()
  let settled = false
  let hasFailure = false
  let cause: unknown
  let intervalId: ReturnType<typeof setTimeout> | undefined
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  function settle(): boolean {
    if (settled) return false
    settled = true
    if (intervalId !== undefined) realClearTimeout(intervalId)
    if (timeoutId !== undefined) realClearTimeout(timeoutId)
    signal.removeEventListener('abort', onAbort)
    return true
  }

  function onAbort() {
    if (settle()) {
      // The runner already owns test termination. Abandoned waits must not report
      // a second unhandled rejection when their test is cleaned up.
      void promise.catch(() => {})
      reject(signal.reason)
    }
  }

  async function attempt() {
    if (settled) return
    try {
      let value = await condition()
      if (settle()) resolve(value)
    } catch (error) {
      if (settled) return
      hasFailure = true
      cause = error
      intervalId = realSetTimeout(attempt, interval)
    }
  }

  if (signal.aborted) {
    onAbort()
  } else {
    signal.addEventListener('abort', onAbort, { once: true })
    timeoutId = realSetTimeout(() => {
      if (settle()) {
        reject(new Error('waitFor() timed out', hasFailure ? { cause } : undefined))
      }
    }, timeout)
    void attempt()
  }

  return promise
}

function validateDelay(value: number, name: string): void {
  if (typeof value !== 'number') throw new TypeError(`${name} must be a number`)
  if (!Number.isFinite(value) || value < 0 || value > 2 ** 31 - 1) {
    throw new RangeError(`${name} must be between 0 and 2147483647`)
  }
}
