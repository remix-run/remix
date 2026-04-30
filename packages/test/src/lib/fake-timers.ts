import { mock } from './mock.ts'

export interface FakeTimers {
  advance(ms: number): void
  /**
   * Like `advance`, but yields to microtasks between each timer firing so
   * Promise continuations (and any timers they schedule) can settle before
   * the next firing is processed. Use this when a callback awaits work that
   * itself depends on the fake clock.
   */
  advanceAsync(ms: number): Promise<void>
  restore(): void
}

export function createFakeTimers(): FakeTimers {
  let currentTime = 0
  let nextId = 1
  let pending: Array<{ id: number; fn: () => void; time: number; repeatMs?: number }> = []

  function schedule(fn: () => void, delay: number, repeatMs?: number): number {
    let id = nextId++
    pending.push({ id, fn, time: currentTime + Math.max(0, delay), repeatMs })
    return id
  }

  function cancel(id: number) {
    pending = pending.filter((t) => t.id !== id)
  }

  let setTimeoutMock = mock.method(globalThis, 'setTimeout', ((fn: () => void, delay = 0) =>
    schedule(fn, delay)) as unknown as typeof setTimeout)
  let clearTimeoutMock = mock.method(
    globalThis,
    'clearTimeout',
    cancel as unknown as typeof clearTimeout,
  )
  let setIntervalMock = mock.method(globalThis, 'setInterval', ((fn: () => void, delay = 0) =>
    schedule(fn, delay, Math.max(0, delay))) as unknown as typeof setInterval)
  let clearIntervalMock = mock.method(
    globalThis,
    'clearInterval',
    cancel as unknown as typeof clearInterval,
  )

  function takeNext(targetTime: number) {
    let next = pending.filter((t) => t.time <= targetTime).sort((a, b) => a.time - b.time)[0]
    if (!next) return null
    currentTime = next.time
    pending = pending.filter((t) => t.id !== next.id)
    // Requeue intervals before running the callback so that calling
    // clearInterval(id) from inside the callback can cancel the next firing.
    if (next.repeatMs !== undefined) {
      pending.push({ ...next, time: next.time + Math.max(1, next.repeatMs) })
    }
    return next
  }

  return {
    advance(ms: number) {
      let targetTime = currentTime + ms
      while (true) {
        let next = takeNext(targetTime)
        if (!next) break
        next.fn()
      }
      currentTime = targetTime
    },
    async advanceAsync(ms: number) {
      let targetTime = currentTime + ms
      while (true) {
        let next = takeNext(targetTime)
        if (!next) break
        next.fn()
        // Drain microtasks so Promise continuations (and any timers they
        // schedule) can settle before we look for the next firing.
        await Promise.resolve()
      }
      currentTime = targetTime
    },
    restore() {
      setTimeoutMock.mock.restore?.()
      clearTimeoutMock.mock.restore?.()
      setIntervalMock.mock.restore?.()
      clearIntervalMock.mock.restore?.()
      pending = []
      currentTime = 0
    },
  }
}
