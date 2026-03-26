export interface FakeTimers {
  advance(ms: number): void
  restore(): void
}

export function createFakeTimers(): FakeTimers {
  let originalSetTimeout = globalThis.setTimeout
  let originalClearTimeout = globalThis.clearTimeout
  let originalSetInterval = globalThis.setInterval
  let originalClearInterval = globalThis.clearInterval

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

  globalThis.setTimeout = ((fn: () => void, delay = 0) => schedule(fn, delay)) as typeof setTimeout
  globalThis.clearTimeout = cancel as typeof clearTimeout
  globalThis.setInterval = ((fn: () => void, delay = 0) =>
    schedule(fn, delay, Math.max(0, delay))) as typeof setInterval
  globalThis.clearInterval = cancel as typeof clearInterval

  return {
    advance(ms: number) {
      let targetTime = currentTime + ms
      while (true) {
        let next = pending
          .filter((t) => t.time <= targetTime)
          .sort((a, b) => a.time - b.time)[0]
        if (!next) break
        currentTime = next.time
        pending = pending.filter((t) => t.id !== next.id)
        next.fn()
        if (next.repeatMs !== undefined) {
          pending.push({ ...next, time: next.time + next.repeatMs })
        }
      }
      currentTime = targetTime
    },
    restore() {
      globalThis.setTimeout = originalSetTimeout
      globalThis.clearTimeout = originalClearTimeout
      globalThis.setInterval = originalSetInterval
      globalThis.clearInterval = originalClearInterval
      pending = []
      currentTime = 0
    },
  }
}
