import * as assert from '@remix-run/assert'
import { describe, it, mock } from '../index.ts'
import { createTestContext } from '../lib/context.ts'

// The same clock contract runs in Node, Bun, Chromium, and Firefox.
describe('mock.timers', () => {
  it('defaults omitted timeouts to zero and nonpositive intervals to one millisecond', (t) => {
    t.mock.timers.enable({ apis: ['Date', 'setTimeout', 'setInterval'] })
    let calls: string[] = []
    setTimeout(() => calls.push('timeout'))
    let zero = setInterval(() => {
      calls.push('zero')
      clearInterval(zero)
    }, 0)
    let negative = setInterval(() => calls.push('negative'), -1)
    let omitted = setInterval(() => calls.push('omitted'))
    t.mock.timers.tick(0)
    assert.deepEqual(calls, ['timeout'])
    t.mock.timers.tick(2)
    clearInterval(negative)
    clearInterval(omitted)
    assert.deepEqual(calls, ['timeout', 'zero', 'negative', 'omitted', 'negative', 'omitted'])
    assert.equal(Date.now(), 2)
  })

  it('does not reschedule an interval cancelled by its callback', (t) => {
    t.mock.timers.enable({ apis: ['setInterval'] })
    let calls = 0
    let interval = setInterval(() => {
      calls++
      clearInterval(interval)
    }, 10)
    t.mock.timers.tick(30)
    assert.equal(calls, 1)
  })

  it('mocks Date while leaving real timers and performance alone', (t) => {
    let NativeDate = Date
    let existing = new Date(123)
    let timeout = setTimeout
    let performanceNow = performance.now
    let epoch = Date.parse('2026-01-01T00:00:00Z')
    assert.equal(t.mock.timers.enable({ apis: ['Date'], now: new Date(epoch) }), undefined)
    assert.equal(Date.now(), epoch)
    assert.equal(new Date().getTime(), epoch)
    assert.equal(Date(), new NativeDate(epoch).toString())
    assert.equal(new Date(123).getTime(), 123)
    assert.equal(new Date('2020-01-01').getTime(), NativeDate.parse('2020-01-01'))
    assert.equal(
      new Date(2020, 1, 3, 4, 5, 6, 7).getTime(),
      new NativeDate(2020, 1, 3, 4, 5, 6, 7).getTime(),
    )
    assert.equal(Date.parse, NativeDate.parse)
    assert.equal(Date.UTC, NativeDate.UTC)
    assert.equal(Date.prototype, NativeDate.prototype)
    assert.ok(existing instanceof Date)
    assert.ok(new Date() instanceof NativeDate)
    assert.equal(setTimeout, timeout)
    assert.equal(performance.now, performanceNow)
    t.mock.timers.reset()
    assert.equal(Date, NativeDate)
  })

  it('runs callbacks in deadline order at the destination and schedules nested timers from there', (t) => {
    t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 100 })
    let calls: Array<[string, number]> = []
    setTimeout(() => calls.push(['second', Date.now()]), 10)
    setTimeout(() => {
      calls.push(['first', Date.now()])
      setTimeout(() => calls.push(['nested', Date.now()]), 1)
    }, 5)
    t.mock.timers.tick(10)
    assert.deepEqual(calls, [
      ['first', 110],
      ['second', 110],
    ])
    t.mock.timers.tick()
    assert.deepEqual(calls, [
      ['first', 110],
      ['second', 110],
      ['nested', 111],
    ])
  })

  it('keeps absolute deadlines across forward and backward setTime calls', (t) => {
    t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 100 })
    let calls: number[] = []
    setTimeout(() => calls.push(Date.now()), 10)
    t.mock.timers.setTime(200)
    assert.equal(calls.length, 0)
    t.mock.timers.setTime(50)
    t.mock.timers.tick(59)
    assert.equal(calls.length, 0)
    t.mock.timers.tick()
    assert.deepEqual(calls, [110])
    setTimeout(() => calls.push(Date.now()), 10)
    t.mock.timers.setTime(300)
    assert.deepEqual(calls, [110])
    t.mock.timers.tick(0)
    assert.deepEqual(calls, [110, 300])
  })

  it('bounds runAll with intervals and leaves nested future timers pending', (t) => {
    t.mock.timers.enable({ apis: ['Date', 'setTimeout', 'setInterval'] })
    let calls: Array<string | number> = []
    let interval = setInterval(() => calls.push(Date.now()), 10)
    setTimeout(() => {
      calls.push('outer')
      setTimeout(() => calls.push('inner'), 1)
    }, 25)
    t.mock.timers.runAll()
    assert.deepEqual(calls, [25, 25, 'outer'])
    assert.equal(Date.now(), 25)
    clearInterval(interval)
    t.mock.timers.tick()
    assert.deepEqual(calls, [25, 25, 'outer', 'inner'])
  })

  it('uses the Node 24.3 heap horizon rather than draining the queue', (t) => {
    t.mock.timers.enable({ apis: ['Date', 'setTimeout'] })
    let calls: number[] = []
    setTimeout(() => calls.push(10), 10)
    setTimeout(() => calls.push(30), 30)
    setTimeout(() => calls.push(20), 20)
    t.mock.timers.runAll()
    assert.equal(Date.now(), 20)
    assert.deepEqual(calls, [10, 20])
    t.mock.timers.runAll()
    assert.equal(Date.now(), 30)
    assert.deepEqual(calls, [10, 20, 30])
    t.mock.timers.runAll()
    assert.equal(Date.now(), 30)
  })

  it('requires tick(0) for an overdue runAll horizon', (t) => {
    t.mock.timers.enable({ apis: ['Date', 'setTimeout'] })
    let calls = 0
    setTimeout(() => calls++, 1)
    t.mock.timers.setTime(10)
    assert.throws(() => t.mock.timers.runAll(), { code: 'ERR_INVALID_ARG_VALUE' })
    assert.equal(calls, 0)
    t.mock.timers.tick(0)
    assert.equal(calls, 1)
  })

  it('supports callback arguments, cancellation, and timer-only mode', (t) => {
    let NativeDate = Date
    t.mock.timers.enable({ apis: ['setTimeout'] })
    let calls: unknown[] = []
    setTimeout((...args: unknown[]) => calls.push(args), 10, 'value', 42)
    let cancelled = setTimeout(() => calls.push('cancelled'), 5)
    clearTimeout(cancelled)
    t.mock.timers.tick(10)
    assert.deepEqual(calls, [['value', 42]])
    assert.equal(Date, NativeDate)
  })

  it('validates lifecycle and time arguments before changing globals', (t) => {
    let NativeDate = Date
    let timeout = setTimeout
    let timers = t.mock.timers
    timers.reset()
    assert.throws(() => timers.tick(), { code: 'ERR_INVALID_STATE' })
    assert.throws(() => timers.runAll(), { code: 'ERR_INVALID_STATE' })
    assert.throws(() => timers.setTime(0), { code: 'ERR_INVALID_STATE' })
    assert.throws(() => Reflect.apply(timers.setTime, timers, [new Date()]), {
      code: 'ERR_INVALID_ARG_TYPE',
    })
    assert.throws(() => timers.enable({ now: -1 }), { code: 'ERR_INVALID_ARG_VALUE' })
    assert.throws(() => timers.enable({ now: NaN }), { code: 'ERR_INVALID_ARG_VALUE' })
    assert.throws(() => Reflect.apply(timers.enable, timers, [{ apis: ['Date', 'unknown'] }]), {
      code: 'ERR_INVALID_ARG_VALUE',
    })
    assert.throws(() => Reflect.apply(timers.enable, timers, [{ apis: [1] }]), {
      code: 'ERR_INVALID_ARG_TYPE',
    })
    assert.equal(Date, NativeDate)
    assert.equal(setTimeout, timeout)
    timers.enable({ apis: ['Date'] })
    assert.equal(Date.now(), 0)
    assert.throws(() => timers.enable(), { code: 'ERR_INVALID_STATE' })
    assert.throws(() => timers.tick(-1), { code: 'ERR_INVALID_ARG_VALUE' })
    assert.throws(() => timers.setTime(-1), { code: 'ERR_INVALID_ARG_VALUE' })
    timers.tick()
    assert.equal(Date.now(), 1)
    timers[Symbol.dispose]()
    timers.reset()
    assert.equal(Date, NativeDate)
  })

  it('accepts fractional epochs and pre-epoch Date values like Node', (t) => {
    t.mock.timers.enable({ apis: ['Date'], now: new Date(-1) })
    assert.equal(Date.now(), -1)
    t.mock.timers.setTime(0.5)
    assert.equal(Date.now(), 0.5)
    assert.equal(new Date().getTime(), 0)
  })

  it('restores repeated API names and drops pending work on reset', (t) => {
    let NativeDate = Date
    let timeout = setTimeout
    let calls = 0
    t.mock.timers.enable({ apis: ['Date', 'Date', 'setTimeout', 'setTimeout'] })
    setTimeout(() => calls++, 1)
    t.mock.timers.reset()
    assert.equal(Date, NativeDate)
    assert.equal(setTimeout, timeout)
    t.mock.timers.enable({ apis: ['setTimeout'] })
    t.mock.timers.tick(100)
    assert.equal(calls, 0)
  })

  it('owns standalone and per-context clocks independently', async (t) => {
    let other = createTestContext()
    mock.timers.enable({ apis: ['Date'], now: 123 })
    try {
      await other.cleanup()
      assert.equal(Date.now(), 123)
      assert.throws(() => t.mock.timers.enable(), /Another mock timer controller/)
      assert.throws(() => t.useFakeTimers(), /Another mock timer controller/)
      t.mock.timers.reset()
      assert.equal(Date.now(), 123)
    } finally {
      mock.timers.reset()
    }
    t.mock.timers.enable({ apis: ['Date'] })
    assert.throws(() => mock.timers.enable(), /Another mock timer controller/)
  })

  it('rejects mixing legacy and canonical clocks in either direction', (t) => {
    let legacy = t.useFakeTimers()
    assert.throws(() => t.mock.timers.enable(), /Another mock timer controller/)
    legacy.restore()
    t.mock.timers.enable({ apis: ['Date'], now: 123 })
    legacy.restore()
    assert.equal(Date.now(), 123)
    assert.throws(() => t.useFakeTimers(), /Another mock timer controller/)
    t.mock.timers.reset()
    let again = t.useFakeTimers()
    t.mock.timers.reset()
    let fired = false
    setTimeout(() => {
      fired = true
    }, 1)
    again.advance(1)
    assert.equal(fired, true)
  })

  it('restores on early cleanup and prevents late context use', async () => {
    let NativeDate = Date
    let context = createTestContext()
    context.testContext.mock.timers.enable({ apis: ['Date'] })
    await context.cleanup()
    assert.equal(Date, NativeDate)
    assert.throws(() => context.testContext.mock.timers.enable(), /already finished/)
    assert.throws(() => context.testContext.useFakeTimers(), /already finished/)
    await context.cleanup()
  })

  it('restores synchronously on abort', async () => {
    let timeout = setTimeout
    let NativeDate = Date
    let controller = new AbortController()
    let context = createTestContext({ signal: controller.signal })
    context.testContext.mock.timers.enable({ apis: ['Date', 'setTimeout'] })
    controller.abort()
    assert.equal(Date, NativeDate)
    assert.equal(setTimeout, timeout)
    assert.throws(() => context.testContext.mock.timers.enable(), /already finished/)
    await context.cleanup()
  })

  it('restores the clock even when an earlier cleanup throws', async () => {
    let NativeDate = Date
    let context = createTestContext()
    context.testContext.after(() => {
      throw new Error('cleanup failed')
    })
    context.testContext.mock.timers.enable({ apis: ['Date'] })
    await assert.rejects(() => context.cleanup(), /cleanup failed/)
    assert.equal(Date, NativeDate)
  })

  it('restores timers before running asynchronous user cleanup', async () => {
    let timeout = setTimeout
    let context = createTestContext()
    context.testContext.after(async () => {
      assert.equal(setTimeout, timeout)
      await new Promise((resolve) => setTimeout(resolve, 1))
    })
    context.testContext.mock.timers.enable({ apis: ['setTimeout'] })
    await context.cleanup()
  })

  it('restores spies installed before and after a mock clock', async () => {
    let timeout = setTimeout
    let before = createTestContext()
    before.testContext.mock.method(globalThis, 'setTimeout')
    before.testContext.mock.timers.enable({ apis: ['setTimeout'] })
    await before.cleanup()
    assert.equal(setTimeout, timeout)

    let after = createTestContext()
    after.testContext.mock.timers.enable({ apis: ['setTimeout'] })
    after.testContext.mock.method(globalThis, 'setTimeout')
    await after.cleanup()
    assert.equal(setTimeout, timeout)
  })

  it('releases legacy ownership and restores globals if installation fails', (t) => {
    let timeout = setTimeout
    let descriptor = Object.getOwnPropertyDescriptor(globalThis, 'setInterval')
    assert.ok(descriptor)
    Object.defineProperty(globalThis, 'setInterval', { ...descriptor, writable: false })
    try {
      assert.throws(() => t.useFakeTimers(), TypeError)
      assert.equal(setTimeout, timeout)
    } finally {
      Object.defineProperty(globalThis, 'setInterval', descriptor)
    }
    t.mock.timers.enable({ apis: ['Date'] })
    assert.equal(Date.now(), 0)
  })
})
