import * as assert from '@remix-run/assert'
import { createTestContext } from '../lib/context.ts'
import { createFakeTimers } from '../lib/fake-timers.ts'
import { describe, it } from '../lib/framework.ts'
import { mock } from '../lib/mock.ts'

function captureGlobals() {
  let properties = [
    [globalThis, 'setTimeout'],
    [globalThis, 'clearTimeout'],
    [globalThis, 'setInterval'],
    [globalThis, 'clearInterval'],
    [globalThis, 'setImmediate'],
    [globalThis, 'clearImmediate'],
    [globalThis, 'Date'],
    [globalThis, 'performance'],
    [performance, 'now'],
    [AbortSignal, 'timeout'],
  ] as const
  let originals = properties.map(([target, key]) => ({
    target,
    key,
    descriptor: Object.getOwnPropertyDescriptor(target, key),
  }))
  return {
    assertRestored() {
      for (let { target, key, descriptor } of originals) {
        assert.deepEqual(Object.getOwnPropertyDescriptor(target, key), descriptor, key)
      }
    },
    restore() {
      for (let { target, key, descriptor } of originals) {
        if (descriptor) Object.defineProperty(target, key, descriptor)
        else Reflect.deleteProperty(target, key)
      }
    },
  }
}

describe('fake timer lifecycle safety', () => {
  it('restores exact property descriptors, including inherited performance.now', () => {
    let globals = captureGlobals()
    try {
      let timers = createFakeTimers()
      timers.restore()
      globals.assertRestored()
    } finally {
      globals.restore()
    }
  })

  it('restores clocks before user cleanup and rejects late activation', async () => {
    let globals = captureGlobals()
    let { testContext, cleanup } = createTestContext()
    let cleanedUp = false
    testContext.after(async () => {
      globals.assertRestored()
      assert.throws(() => testContext.useFakeTimers(), /finished/)
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
      cleanedUp = true
    })
    testContext.useFakeTimers()
    try {
      await cleanup()
      assert.equal(cleanedUp, true)
      assert.throws(() => testContext.useFakeTimers(), /finished/)
    } finally {
      await cleanup()
      globals.restore()
    }
  })

  it('restores synchronously on abort even when propagation is stopped', async () => {
    let globals = captureGlobals()
    let controller = new AbortController()
    controller.signal.addEventListener('abort', (event) => event.stopImmediatePropagation())
    let { testContext, cleanup } = createTestContext({ signal: controller.signal })
    testContext.useFakeTimers()
    try {
      controller.abort()
      globals.assertRestored()
      assert.throws(() => testContext.useFakeTimers(), /finished/)
    } finally {
      await cleanup()
      globals.restore()
    }

    let aborted = createTestContext({ signal: controller.signal })
    try {
      assert.throws(() => aborted.testContext.useFakeTimers(), /finished/)
    } finally {
      await aborted.cleanup()
      globals.restore()
    }
  })

  it('rejects a competing clock without changing the active clock', (t) => {
    let globals = captureGlobals()
    let timers = t.useFakeTimers({ now: 1000 })
    let competing: ReturnType<typeof createFakeTimers> | undefined
    try {
      assert.throws(() => (competing = createFakeTimers({ now: 2000 })), /already/)
      assert.equal(Date.now(), 1000)
      timers.advance(10)
      assert.equal(Date.now(), 1010)
    } finally {
      competing?.restore()
      timers.restore()
      globals.restore()
    }
  })

  it('restores a clock if its context aborts during activation', async () => {
    let globals = captureGlobals()
    let controller = new AbortController()
    let { testContext, cleanup } = createTestContext({ signal: controller.signal })
    let now = new Date(1000)
    now.valueOf = () => {
      controller.abort()
      return 1000
    }
    try {
      assert.throws(() => testContext.useFakeTimers({ now }), /finished/)
      globals.assertRestored()
    } finally {
      await cleanup()
      globals.restore()
    }
  })

  it('does not let a stale numeric timer ID cancel work in a later clock', () => {
    let first = createFakeTimers()
    let staleId = Number(setTimeout(() => {}, 100))
    first.restore()
    let second = createFakeTimers()
    try {
      let fired = false
      setTimeout(() => (fired = true), 100)
      clearTimeout(staleId)
      second.advance(100)
      assert.equal(fired, true)
    } finally {
      second.restore()
    }
  })

  it('rolls back a failed installation and permits another clock', () => {
    let globals = captureGlobals()
    let performanceDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'performance')
    assert.ok(performanceDescriptor)
    let lockedPerformance = Object.create(performance)
    Object.defineProperty(lockedPerformance, 'now', {
      value: performance.now.bind(performance),
      writable: false,
      configurable: false,
    })
    Object.defineProperty(globalThis, 'performance', {
      value: lockedPerformance,
      configurable: true,
    })
    try {
      assert.throws(() => createFakeTimers(), TypeError)
      Object.defineProperty(globalThis, 'performance', performanceDescriptor)
      globals.assertRestored()
    } finally {
      globals.restore()
    }
    let timers = createFakeTimers()
    timers.restore()
    globals.assertRestored()
  })

  it('continues restoration after a failure and can retry the failed property', () => {
    let globals = captureGlobals()
    let originalDate = Date
    let originalSetTimeout = setTimeout
    let blocked = false
    let realNow = () => 42
    let error = new Error('restoration blocked')
    let performanceTarget = new Proxy(
      { now: realNow },
      {
        defineProperty(target, key, descriptor) {
          if (blocked) throw error
          return Reflect.defineProperty(target, key, descriptor)
        },
      },
    )
    Object.defineProperty(globalThis, 'performance', {
      value: performanceTarget,
      configurable: true,
    })
    let timers = createFakeTimers()
    try {
      blocked = true
      assert.throws(
        () => timers.restore(),
        (value: unknown) => value === error,
      )
      assert.equal(Date, originalDate)
      assert.equal(setTimeout, originalSetTimeout)
      blocked = false
      timers.restore()
      assert.equal(performanceTarget.now, realNow)
    } finally {
      blocked = false
      timers.restore()
      globals.restore()
    }
  })

  it('does not reinstall fake globals when spies from test modules are restored', (t) => {
    let globals = captureGlobals()
    t.useFakeTimers()
    let timeoutSpy = mock.method(globalThis, 'setTimeout')
    let dateSpy = mock.method(globalThis, 'Date')
    t.after(() => {
      try {
        timeoutSpy.mock.restore()
        dateSpy.mock.restore()
        globals.assertRestored()
      } finally {
        globals.restore()
      }
    })
  })

  it('reports abort restoration failures during cleanup and still runs user cleanup', async () => {
    let globals = captureGlobals()
    let blocked = false
    let error = new Error('restore failed on abort')
    let target = new Proxy(
      { now: () => 42 },
      {
        defineProperty(object, key, descriptor) {
          if (blocked) {
            blocked = false
            throw error
          }
          return Reflect.defineProperty(object, key, descriptor)
        },
      },
    )
    Object.defineProperty(globalThis, 'performance', { value: target, configurable: true })
    let controller = new AbortController()
    let { testContext, cleanup } = createTestContext({ signal: controller.signal })
    let cleanedUp = false
    testContext.after(() => {
      cleanedUp = true
    })
    testContext.useFakeTimers()
    try {
      blocked = true
      controller.abort()
      await assert.rejects(cleanup(), (value: unknown) => value === error)
      assert.equal(cleanedUp, true)
      assert.equal(target.now(), 42)
    } finally {
      blocked = false
      await cleanup()
      globals.restore()
    }
  })
})
