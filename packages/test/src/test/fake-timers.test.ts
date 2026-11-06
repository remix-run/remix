import * as assert from '@remix-run/assert'
import { describe, it } from '../lib/framework.ts'
import { createFakeTimers } from '../lib/fake-timers.ts'
import { createTestContext } from '../lib/context.ts'

// Always restore globals even if a test bails — we patch globalThis directly.
function withFakeTimers<T>(fn: (timers: ReturnType<typeof createFakeTimers>) => T): T {
  let timers = createFakeTimers()
  try {
    return fn(timers)
  } finally {
    timers.restore()
  }
}

describe('createFakeTimers', () => {
  it('restores globals after repeated useFakeTimers calls in one test', async () => {
    let originalDate = globalThis.Date
    let { testContext, cleanup } = createTestContext()
    try {
      let first = testContext.useFakeTimers({ now: 1000 })
      let fired = false
      setTimeout(() => (fired = true), 100)
      let second = testContext.useFakeTimers({ now: 2000 })
      first.restore()
      assert.equal(Date.now(), 2000)
      second.advance(100)
      assert.equal(Date.now(), 2100)
      assert.equal(fired, false)

      await cleanup()
      assert.equal(globalThis.Date, originalDate)
    } finally {
      await cleanup()
      globalThis.Date = originalDate
    }
  })

  it('replaces globalThis timer functions', () => {
    let originalSetTimeout = globalThis.setTimeout
    let originalClearTimeout = globalThis.clearTimeout
    let originalSetInterval = globalThis.setInterval
    let originalClearInterval = globalThis.clearInterval
    let originalSetImmediate = globalThis.setImmediate
    let originalClearImmediate = globalThis.clearImmediate
    let originalAbortSignalTimeout = AbortSignal.timeout
    let originalDate = globalThis.Date
    let originalPerformanceNow = globalThis.performance.now

    let timers = createFakeTimers()
    try {
      assert.notEqual(globalThis.setTimeout, originalSetTimeout)
      assert.notEqual(globalThis.clearTimeout, originalClearTimeout)
      assert.notEqual(globalThis.setInterval, originalSetInterval)
      assert.notEqual(globalThis.clearInterval, originalClearInterval)
      assert.notEqual(globalThis.setImmediate, originalSetImmediate)
      assert.notEqual(globalThis.clearImmediate, originalClearImmediate)
      assert.notEqual(AbortSignal.timeout, originalAbortSignalTimeout)
      assert.notEqual(globalThis.Date, originalDate)
      assert.notEqual(globalThis.performance.now, originalPerformanceNow)
    } finally {
      timers.restore()
    }

    assert.equal(globalThis.setTimeout, originalSetTimeout)
    assert.equal(globalThis.clearTimeout, originalClearTimeout)
    assert.equal(globalThis.setInterval, originalSetInterval)
    assert.equal(globalThis.clearInterval, originalClearInterval)
    assert.equal(globalThis.setImmediate, originalSetImmediate)
    assert.equal(globalThis.clearImmediate, originalClearImmediate)
    assert.equal(AbortSignal.timeout, originalAbortSignalTimeout)
    assert.equal(globalThis.Date, originalDate)
    assert.equal(globalThis.performance.now, originalPerformanceNow)
  })
})

describe('FakeTimers#advance — setTimeout', () => {
  it('does not fire callbacks scheduled in the future before the clock reaches them', () => {
    withFakeTimers((timers) => {
      let fired = 0
      setTimeout(() => fired++, 100)
      timers.advance(99)
      assert.equal(fired, 0)
    })
  })

  it('fires a setTimeout callback once the clock crosses its delay', () => {
    withFakeTimers((timers) => {
      let fired = 0
      setTimeout(() => fired++, 100)
      timers.advance(100)
      assert.equal(fired, 1)
    })
  })

  it('does not refire a setTimeout callback after a second advance', () => {
    withFakeTimers((timers) => {
      let fired = 0
      setTimeout(() => fired++, 100)
      timers.advance(100)
      timers.advance(1000)
      assert.equal(fired, 1)
    })
  })

  it('fires multiple setTimeouts in chronological order during a single advance', () => {
    withFakeTimers((timers) => {
      let order: string[] = []
      setTimeout(() => order.push('b'), 200)
      setTimeout(() => order.push('a'), 100)
      setTimeout(() => order.push('c'), 300)
      timers.advance(500)
      assert.deepEqual(order, ['a', 'b', 'c'])
    })
  })

  it('treats a missing or negative delay as 0', () => {
    withFakeTimers((timers) => {
      let fired = 0
      setTimeout(() => fired++)
      setTimeout(() => fired++, -50)
      timers.advance(0)
      assert.equal(fired, 2)
    })
  })

  it('passes extra arguments to the callback', () => {
    withFakeTimers((timers) => {
      let received: unknown[] = []
      setTimeout((...args: unknown[]) => received.push(...args), 100, 'a', 1)
      timers.advance(100)
      assert.deepEqual(received, ['a', 1])
    })
  })

  it('returns a Node Timeout-like handle with ref, unref, and hasRef', () => {
    withFakeTimers(() => {
      let handle = setTimeout(() => {}, 100)
      assert.equal(handle.hasRef(), true)
      assert.equal(handle.unref(), handle)
      assert.equal(handle.hasRef(), false)
      assert.equal(handle.ref(), handle)
      assert.equal(handle.hasRef(), true)
    })
  })

  it('reschedules a timeout from the current time when refreshed', () => {
    withFakeTimers((timers) => {
      let fired = 0
      let handle = setTimeout(() => fired++, 100)
      timers.advance(60)
      handle.refresh()
      timers.advance(60)
      assert.equal(fired, 0)
      timers.advance(40)
      assert.equal(fired, 1)
    })
  })

  it('reactivates an expired timeout when refreshed without clearing it', () => {
    withFakeTimers((timers) => {
      let fired = 0
      let handle = setTimeout(() => fired++, 100)
      timers.advance(100)
      assert.equal(fired, 1)
      handle.refresh()
      timers.advance(99)
      assert.equal(fired, 1)
      timers.advance(1)
      assert.equal(fired, 2)
    })
  })

  it('fires timeouts scheduled inside a callback during the same advance', () => {
    withFakeTimers((timers) => {
      let order: string[] = []
      setTimeout(() => {
        order.push('outer')
        setTimeout(() => order.push('inner'), 50)
      }, 100)
      timers.advance(200)
      assert.deepEqual(order, ['outer', 'inner'])
    })
  })
})

describe('FakeTimers#advance — clearTimeout', () => {
  it('does not revive an expired timeout after clearing its handle', () => {
    withFakeTimers((timers) => {
      let fired = 0
      let handle = setTimeout(() => fired++, 100)
      timers.advance(100)
      assert.equal(fired, 1)
      clearTimeout(handle)
      assert.equal(handle.refresh(), handle)
      timers.advance(100)
      assert.equal(fired, 1)
    })
  })

  it('cancels a pending setTimeout', () => {
    withFakeTimers((timers) => {
      let fired = 0
      let id = setTimeout(() => fired++, 100)
      clearTimeout(id)
      timers.advance(1000)
      assert.equal(fired, 0)
    })
  })
})

describe('FakeTimers — real timers created before faking', () => {
  it('passes real timer handles through to the real clear functions', (t) => {
    let realSetTimeout = globalThis.setTimeout
    let realSetInterval = globalThis.setInterval
    let clearTimeoutSpy = t.mock.method(globalThis, 'clearTimeout')
    let clearIntervalSpy = t.mock.method(globalThis, 'clearInterval')
    let realTimeout = realSetTimeout(() => {}, 60_000)
    let realInterval = realSetInterval(() => {}, 60_000)

    withFakeTimers(() => {
      clearTimeout(realTimeout)
      clearInterval(realInterval)
    })

    assert.ok(clearTimeoutSpy.mock.calls.some((call) => call.arguments[0] === realTimeout))
    assert.ok(clearIntervalSpy.mock.calls.some((call) => call.arguments[0] === realInterval))
  })

  it('does not pass fake timer handles or their numeric IDs to the real clear functions', (t) => {
    let clearTimeoutSpy = t.mock.method(globalThis, 'clearTimeout')

    withFakeTimers(() => {
      let first = setTimeout(() => {}, 100)
      let second = setTimeout(() => {}, 100)
      clearTimeout(first)
      clearTimeout(Number(second))
    })

    // The only real call is the one createFakeTimers() makes while probing the
    // platform's handle type, before the fakes are installed.
    assert.equal(clearTimeoutSpy.mock.calls.length, 1)
  })
})

describe('FakeTimers — Date', () => {
  it('starts the fake clock at the Unix epoch by default', () => {
    withFakeTimers(() => {
      assert.equal(Date.now(), 0)
      assert.equal(new Date().getTime(), 0)
    })
  })

  it('starts the fake clock at the now option', () => {
    let timers = createFakeTimers({ now: new Date('2030-01-01T00:00:00Z') })
    try {
      assert.equal(new Date().toISOString(), '2030-01-01T00:00:00.000Z')
    } finally {
      timers.restore()
    }

    let numeric = createFakeTimers({ now: 1_000 })
    try {
      assert.equal(Date.now(), 1_000)
    } finally {
      numeric.restore()
    }
  })

  it('moves Date forward with advance and advanceAsync', async () => {
    let timers = createFakeTimers({ now: 1_000 })
    try {
      let firedAt: number | undefined
      setTimeout(() => (firedAt = Date.now()), 100)
      timers.advance(250)
      assert.equal(firedAt, 1_100)
      assert.equal(Date.now(), 1_250)
      await timers.advanceAsync(50)
      assert.equal(new Date().getTime(), 1_300)
    } finally {
      timers.restore()
    }
  })

  it('returns the fake time as a string when Date is called without new', () => {
    withFakeTimers(() => {
      assert.equal(Date(), new Date(0).toString())
    })
  })

  it('keeps explicit dates, Date.parse, Date.UTC, and instanceof working', () => {
    let before = new Date(5)
    withFakeTimers(() => {
      let date = new Date('2030-01-01T00:00:00Z')
      assert.equal(date.getTime(), Date.UTC(2030, 0, 1))
      assert.equal(new Date(2030, 0, 1).getFullYear(), 2030)
      assert.equal(Date.parse('2030-01-01T00:00:00Z'), Date.UTC(2030, 0, 1))
      assert.ok(date instanceof Date)
      assert.ok(before instanceof Date)

      class Day extends Date {}
      let day = new Day()
      assert.ok(day instanceof Day)
      assert.equal(day.getTime(), 0)
    })
  })
})

describe('FakeTimers — performance.now', () => {
  it('starts at zero and moves forward with advance', () => {
    withFakeTimers((timers) => {
      assert.equal(performance.now(), 0)
      timers.advance(125)
      assert.equal(performance.now(), 125)
    })
  })
})

describe('FakeTimers#advance — setImmediate', () => {
  it('fires an immediate on the next advance, including advance(0)', () => {
    withFakeTimers((timers) => {
      let received: unknown[] = []
      setImmediate((...args: unknown[]) => received.push(...args), 'a', 1)
      assert.deepEqual(received, [])
      timers.advance(0)
      assert.deepEqual(received, ['a', 1])
    })
  })

  it('fires immediates and zero-delay timeouts in the order they were scheduled', () => {
    withFakeTimers((timers) => {
      let order: string[] = []
      setTimeout(() => order.push('timeout'), 0)
      setImmediate(() => order.push('immediate'))
      timers.advance(0)
      assert.deepEqual(order, ['timeout', 'immediate'])
    })
  })

  it('cancels a pending immediate with clearImmediate', () => {
    withFakeTimers((timers) => {
      let fired = false
      let immediate = setImmediate(() => (fired = true))
      clearImmediate(immediate)
      timers.advance(0)
      assert.equal(fired, false)
    })
  })

  it('passes real immediates through to the real clearImmediate', (t) => {
    let realSetImmediate = globalThis.setImmediate
    let clearImmediateSpy = t.mock.method(globalThis, 'clearImmediate')
    let fired = false
    let realImmediate = realSetImmediate(() => (fired = true))

    withFakeTimers(() => {
      clearImmediate(realImmediate)
    })

    assert.ok(clearImmediateSpy.mock.calls.some((call) => call.arguments[0] === realImmediate))
    assert.equal(fired, false)
  })
})

describe('FakeTimers — AbortSignal.timeout', () => {
  it('rejects invalid timeout durations synchronously', () => {
    withFakeTimers(() => {
      assert.throws(() => AbortSignal.timeout(-1), RangeError)
      assert.throws(() => AbortSignal.timeout(NaN), RangeError)
      assert.throws(() => AbortSignal.timeout(Infinity), RangeError)
      assert.throws(() => AbortSignal.timeout(1.5), RangeError)
      assert.throws(() => AbortSignal.timeout(2 ** 32), RangeError)
      assert.throws(() => Reflect.apply(AbortSignal.timeout, AbortSignal, ['100']), TypeError)
    })
  })

  it('accepts the minimum and maximum timeout durations', () => {
    withFakeTimers((timers) => {
      let immediate = AbortSignal.timeout(0)
      let maximum = AbortSignal.timeout(2 ** 32 - 1)
      assert.equal(immediate.aborted, false)
      timers.advance(0)
      assert.equal(immediate.aborted, true)
      assert.equal(maximum.aborted, false)
      timers.advance(2 ** 32 - 2)
      assert.equal(maximum.aborted, false)
      timers.advance(1)
      assert.equal(maximum.aborted, true)
    })
  })

  it('aborts the signal with a TimeoutError once the clock reaches the timeout', () => {
    withFakeTimers((timers) => {
      let signal = AbortSignal.timeout(100)
      timers.advance(99)
      assert.equal(signal.aborted, false)
      timers.advance(1)
      assert.equal(signal.aborted, true)
      assert.ok(signal.reason instanceof DOMException)
      assert.equal(signal.reason.name, 'TimeoutError')
    })
  })

  it('dispatches an abort event when the timeout fires', () => {
    withFakeTimers((timers) => {
      let signal = AbortSignal.timeout(100)
      let aborted = false
      signal.addEventListener('abort', () => (aborted = true))
      timers.advance(100)
      assert.equal(aborted, true)
    })
  })
})

describe('FakeTimers#advance — setInterval', () => {
  it('fires repeatedly as the clock advances', () => {
    withFakeTimers((timers) => {
      let fired = 0
      setInterval(() => fired++, 100)
      timers.advance(350)
      assert.equal(fired, 3)
    })
  })

  it('continues firing across separate advances', () => {
    withFakeTimers((timers) => {
      let fired = 0
      setInterval(() => fired++, 100)
      timers.advance(150)
      assert.equal(fired, 1)
      timers.advance(250)
      assert.equal(fired, 4)
    })
  })

  it('does not loop forever when an interval has no delay', () => {
    withFakeTimers((timers) => {
      let fired = 0
      setInterval(() => fired++)
      timers.advance(0)
      assert.equal(fired, 1)
      timers.advance(1)
      assert.equal(fired, 2)
    })
  })
})

describe('FakeTimers#advance — clearInterval', () => {
  it('stops a recurring setInterval', () => {
    withFakeTimers((timers) => {
      let fired = 0
      let id = setInterval(() => fired++, 100)
      timers.advance(150)
      assert.equal(fired, 1)
      clearInterval(id)
      timers.advance(1000)
      assert.equal(fired, 1)
    })
  })

  it('lets a callback cancel its own interval', () => {
    withFakeTimers((timers) => {
      let fired = 0
      let id = setInterval(() => {
        fired++
        if (fired === 2) clearInterval(id)
      }, 100)
      timers.advance(1000)
      assert.equal(fired, 2)
    })
  })
})

describe('FakeTimers#advanceAsync', () => {
  it('fires timers in order like advance', async () => {
    let timers = createFakeTimers()
    try {
      let order: string[] = []
      setTimeout(() => order.push('b'), 200)
      setTimeout(() => order.push('a'), 100)
      setTimeout(() => order.push('c'), 300)
      await timers.advanceAsync(500)
      assert.deepEqual(order, ['a', 'b', 'c'])
    } finally {
      timers.restore()
    }
  })

  it('lets promise continuations settle between firings', async () => {
    let timers = createFakeTimers()
    try {
      let order: string[] = []
      setTimeout(() => {
        order.push('first')
        Promise.resolve().then(() => order.push('then'))
      }, 100)
      setTimeout(() => order.push('second'), 200)
      await timers.advanceAsync(500)
      // The microtask scheduled inside the first callback runs before the
      // second timer fires.
      assert.deepEqual(order, ['first', 'then', 'second'])
    } finally {
      timers.restore()
    }
  })

  it('runs timers scheduled by an awaited promise within the same advance', async () => {
    let timers = createFakeTimers()
    try {
      let fired = 0
      setTimeout(async () => {
        await Promise.resolve()
        setTimeout(() => fired++, 50)
      }, 100)
      await timers.advanceAsync(200)
      assert.equal(fired, 1)
    } finally {
      timers.restore()
    }
  })
})

describe('FakeTimers#restore', () => {
  it('drops pending timers so they never fire', () => {
    let timers = createFakeTimers()
    let fired = 0
    setTimeout(() => fired++, 100)
    timers.restore()

    // Re-install fakes to drive the (now-cleared) clock — restored timers
    // should not be transferred onto the new instance.
    let next = createFakeTimers()
    try {
      next.advance(1000)
      assert.equal(fired, 0)
    } finally {
      next.restore()
    }
  })

  it('resets the internal clock so a fresh instance starts at zero', () => {
    let firstFired = 0
    let first = createFakeTimers()
    setTimeout(() => firstFired++, 100)
    first.advance(100)
    assert.equal(firstFired, 1)
    first.restore()

    let secondFired = 0
    let second = createFakeTimers()
    try {
      setTimeout(() => secondFired++, 50)
      // If state leaked, advance(0) would fire the callback because the prior
      // clock was at 100 and 100 >= 50. It must remain unfired.
      second.advance(0)
      assert.equal(secondFired, 0)
      second.advance(50)
      assert.equal(secondFired, 1)
    } finally {
      second.restore()
    }
  })
})
