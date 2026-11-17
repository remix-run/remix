import { replaceProperty } from './mock.ts'

/**
 * Options for `t.useFakeTimers()`.
 */
export interface FakeTimersOptions {
  /**
   * Wall-clock time the fake clock starts at, read by `Date.now()` and
   * `new Date()`. Defaults to `0` (the Unix epoch), matching Node's mock
   * timers. Vitest and Jest start at the real current time instead.
   */
  now?: number | Date
}

/**
 * Handle returned by `t.useFakeTimers()` for driving fake timers during a
 * test. While enabled, `setTimeout`, `setInterval`, `setImmediate`, their
 * clear functions, `AbortSignal.timeout()`, `Date`, and `performance.now()`
 * use the fake clock instead of the real one; timers fire and time moves
 * forward only when the test calls `advance` (or `advanceAsync`). Immediates
 * fire on the next advance, including `advance(0)`. `Date.now()` and
 * `new Date()` start at the `now` option (default `0`, the Unix epoch) and
 * `performance.now()` starts at `0`. The clear functions still cancel real
 * timers created before the fakes were installed.
 * `AbortSignal.timeout()` requires an integer from `0` to `4294967295`,
 * matching Node's validation in every runtime.
 *
 * @example
 * ```ts
 * it('debounces save calls', (t) => {
 *   let timers = t.useFakeTimers()
 *   let save = t.mock.fn()
 *   let debounced = debounce(save, 100)
 *   debounced(); debounced(); debounced()
 *   timers.advance(100)
 *   assert.equal(save.mock.calls.length, 1)
 * })
 *
 * it('expires sessions after an hour', (t) => {
 *   let timers = t.useFakeTimers({ now: new Date('2030-01-01T00:00:00Z') })
 *   let session = createSession()
 *   timers.advance(60 * 60 * 1000)
 *   assert.equal(session.isExpired(), true)
 * })
 * ```
 */
export interface FakeTimers {
  /**
   * Advance the fake clock by `ms` milliseconds, synchronously firing every
   * timer whose deadline is reached during the advance.
   *
   * @param ms Number of milliseconds to advance.
   */
  advance(ms: number): void
  /**
   * Like `advance`, but yields to microtasks between each timer firing so
   * Promise continuations (and any timers they schedule) can settle before
   * the next firing is processed. Use this when a callback awaits work that
   * itself depends on the fake clock.
   *
   * @param ms Number of milliseconds to advance.
   * @returns A promise that resolves once all reachable timers have fired.
   */
  advanceAsync(ms: number): Promise<void>
  /**
   * Restore the original timer functions, `AbortSignal.timeout()`, `Date`,
   * and `performance.now()`.
   * Called automatically after the test finishes; may also be called early to
   * disable fake timers mid-test. Repeated calls after successful restoration have no effect.
   * Attempts every property even if one cannot be restored, then throws the
   * restoration errors. A later call retries any failed properties.
   */
  restore(): void
}

interface FakeTimer {
  id: number
  fn: (...args: unknown[]) => void
  args: unknown[]
  delay: number
  time: number
  repeat: boolean
  cleared: boolean
}

// Matches Sinon. Keeps fake IDs clear of real numeric browser timer IDs, so the
// fake clear functions can pass real IDs through to the real ones.
const firstFakeId = 1e12
const ownerKey = Symbol.for('remix.test.fakeTimerOwner')
const realm = globalThis as typeof globalThis & {
  [ownerKey]?: { owner?: object; nextId?: number }
}
const timerState = (realm[ownerKey] ??= {})

export function createFakeTimers(options: FakeTimersOptions = {}): FakeTimers {
  let startNow = Number(options.now ?? 0)
  let currentTime = 0
  let nextId = timerState.nextId ?? firstFakeId
  let pending = new Map<number, FakeTimer>()
  let restored = false
  let owner = {}
  let restorers: Array<() => void> = []

  let RealDate = globalThis.Date
  let realClearTimeout = globalThis.clearTimeout
  let realClearInterval = globalThis.clearInterval
  let realClearImmediate = globalThis.clearImmediate
  let returnsHandles = false

  // Mirrors the parts of Node's Timeout that production code commonly calls.
  class FakeTimeout {
    #timer: FakeTimer
    #ref = true

    constructor(timer: FakeTimer) {
      this.#timer = timer
    }

    static getTimer(handle: FakeTimeout) {
      return handle.#timer
    }

    ref() {
      this.#ref = true
      return this
    }

    unref() {
      this.#ref = false
      return this
    }

    hasRef() {
      return this.#ref
    }

    refresh() {
      let timer = this.#timer
      if (!restored && !timer.cleared) {
        timer.time = currentTime + timer.delay
        pending.delete(timer.id)
        pending.set(timer.id, timer)
      }
      return this
    }

    [Symbol.toPrimitive]() {
      return this.#timer.id
    }
  }

  function schedule(fn: unknown, delay: unknown, args: unknown[], repeat: boolean) {
    if (restored) throw new Error('Fake timers have been restored')
    let ms = Math.max(0, Number(delay) || 0)
    let timer: FakeTimer = {
      id: nextId++,
      fn: typeof fn === 'function' ? (fn as FakeTimer['fn']) : () => {},
      args,
      delay: repeat ? Math.max(1, ms) : ms,
      time: currentTime + ms,
      repeat,
      cleared: false,
    }
    timerState.nextId = nextId
    pending.set(timer.id, timer)
    return returnsHandles ? new FakeTimeout(timer) : timer.id
  }

  function createClear(realClear: (handle: any) => void) {
    return (handle: unknown) => {
      let id = handle instanceof FakeTimeout ? Number(handle) : handle
      if (typeof id === 'number' && id >= firstFakeId && id < nextId) {
        let timer = handle instanceof FakeTimeout ? FakeTimeout.getTimer(handle) : pending.get(id)
        if (timer) timer.cleared = true
        pending.delete(id)
      } else {
        // A real timer created before the fakes were installed, such as the
        // test runner's own timeout timer.
        realClear(handle)
      }
    }
  }

  function FakeDate(...args: unknown[]) {
    // Called without `new`, Date() returns the current time as a string.
    if (!new.target) return new RealDate(startNow + currentTime).toString()
    return Reflect.construct(
      RealDate,
      args.length === 0 ? [startNow + currentTime] : args,
      new.target,
    )
  }
  // Sharing the prototype keeps `instanceof Date` working for every date.
  FakeDate.prototype = RealDate.prototype
  FakeDate.now = () => startNow + currentTime
  FakeDate.parse = RealDate.parse
  FakeDate.UTC = RealDate.UTC

  function replace(target: object, key: PropertyKey, value: object): void {
    restorers.push(replaceProperty(target, key, value))
  }

  function restore(): void {
    restored = true
    pending.clear()
    currentTime = 0
    let errors: unknown[] = []
    for (let index = restorers.length - 1; index >= 0; index--) {
      try {
        restorers[index]()
        restorers.splice(index, 1)
      } catch (error) {
        errors.push(error)
      }
    }
    if (restorers.length === 0 && timerState.owner === owner) timerState.owner = undefined
    if (errors.length === 1) throw errors[0]
    if (errors.length > 1) throw new AggregateError(errors, 'Failed to restore fake timers')
  }

  if (timerState.owner) throw new Error('Another fake timer clock is already active')
  timerState.owner = owner
  try {
    // Node and Bun return Timeout objects; browsers and Deno return numbers.
    let probe = globalThis.setTimeout(() => {}, 0)
    returnsHandles = typeof probe === 'object'
    realClearTimeout(probe)

    replace(globalThis, 'setTimeout', (fn: unknown, delay?: unknown, ...args: unknown[]) =>
      schedule(fn, delay, args, false),
    )
    replace(globalThis, 'clearTimeout', createClear(realClearTimeout))
    replace(globalThis, 'setInterval', (fn: unknown, delay?: unknown, ...args: unknown[]) =>
      schedule(fn, delay, args, true),
    )
    replace(globalThis, 'clearInterval', createClear(realClearInterval))
    if (typeof globalThis.setImmediate === 'function') {
      replace(globalThis, 'setImmediate', (fn: unknown, ...args: unknown[]) =>
        schedule(fn, 0, args, false),
      )
    }
    if (typeof realClearImmediate === 'function') {
      replace(globalThis, 'clearImmediate', createClear(realClearImmediate))
    }
    if (typeof globalThis.AbortSignal?.timeout === 'function') {
      replace(globalThis.AbortSignal, 'timeout', (ms: number) => {
        if (typeof ms !== 'number') throw new TypeError('The timeout must be a number')
        if (!Number.isInteger(ms) || ms < 0 || ms > 2 ** 32 - 1) {
          throw new RangeError('The timeout must be an integer between 0 and 4294967295')
        }
        let controller = new AbortController()
        schedule(
          () => controller.abort(new DOMException('signal timed out', 'TimeoutError')),
          ms,
          [],
          false,
        )
        return controller.signal
      })
    }
    replace(globalThis, 'Date', FakeDate)
    if (typeof globalThis.performance?.now === 'function') {
      replace(globalThis.performance, 'now', () => currentTime)
    }
  } catch (error) {
    try {
      restore()
    } catch (restorationError) {
      throw new AggregateError(
        [error, restorationError],
        'Failed to install and restore fake timers',
      )
    }
    throw error
  }

  function takeNext(targetTime: number) {
    if (restored) return null
    let next: FakeTimer | undefined
    for (let timer of pending.values()) {
      if (timer.time <= targetTime && (!next || timer.time < next.time)) next = timer
    }
    if (!next) return null
    currentTime = next.time
    pending.delete(next.id)
    // Requeue intervals before running the callback so that calling
    // clearInterval(id) from inside the callback can cancel the next firing.
    if (next.repeat) {
      next.time += next.delay
      pending.set(next.id, next)
    }
    return next
  }

  return {
    advance(ms: number) {
      let targetTime = currentTime + ms
      while (true) {
        let next = takeNext(targetTime)
        if (!next) break
        next.fn(...next.args)
      }
      if (!restored) currentTime = targetTime
    },
    async advanceAsync(ms: number) {
      let targetTime = currentTime + ms
      while (true) {
        let next = takeNext(targetTime)
        if (!next) break
        next.fn(...next.args)
        // Drain microtasks so Promise continuations (and any timers they
        // schedule) can settle before we look for the next firing.
        await Promise.resolve()
      }
      if (!restored) currentTime = targetTime
    },
    restore,
  }
}
