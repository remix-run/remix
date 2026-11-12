import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { createTestContext } from '../lib/context.ts'
import type { TestContext } from '../lib/context.ts'

const realSetTimeout = globalThis.setTimeout.bind(globalThis)

describe('t.waitFor', () => {
  it('runs immediately without arguments and returns synchronous and asynchronous values', async (t) => {
    let args: unknown[] | undefined
    let result = t.waitFor((...received: unknown[]) => {
      args = received
      return 42
    })
    assert.deepEqual(args, [])
    assert.equal(await result, 42)

    let asyncResult: Promise<string> = t.waitFor(async () => 'ready')
    assert.equal(await asyncResult, 'ready')

    let promise = Promise.resolve(42)
    let thenable: PromiseLike<number> = { then: promise.then.bind(promise) }
    let thenableResult: Promise<number> = t.waitFor(() => thenable)
    assert.equal(await thenableResult, 42)

    assert.equal(await t.waitFor(() => false), false)
    assert.equal(await t.waitFor(() => undefined), undefined)
    assert.equal(await t.waitFor(() => 0), 0)
    assert.equal(await t.waitFor(() => null), null)
  })

  it('waits the default interval after an asynchronous failure settles', async (t) => {
    let firstAttempt = Promise.withResolvers<never>()
    let attempts = 0
    let failedAt = 0
    let result = t.waitFor(() => {
      attempts++
      if (attempts === 1) return firstAttempt.promise
      assert.ok(performance.now() - failedAt >= 45)
      return 'ready'
    })

    await new Promise((resolve) => realSetTimeout(resolve, 60))
    assert.equal(attempts, 1)
    failedAt = performance.now()
    firstAttempt.reject(new Error('not yet'))
    assert.equal(await result, 'ready')
    assert.equal(attempts, 2)
  })

  it('validates arguments synchronously before invoking the callback', (t) => {
    let calls = 0
    let condition = () => calls++
    assert.throws(() => Reflect.apply(t.waitFor, t, [null]), TypeError)
    assert.throws(() => Reflect.apply(t.waitFor, t, [condition, null]), TypeError)
    assert.throws(() => Reflect.apply(t.waitFor, t, [condition, []]), TypeError)
    assert.throws(() => Reflect.apply(t.waitFor, t, [condition, 'options']), TypeError)
    assert.throws(() => Reflect.apply(t.waitFor, t, [condition, { interval: '1' }]), TypeError)
    assert.throws(() => Reflect.apply(t.waitFor, t, [condition, { timeout: null }]), TypeError)
    assert.throws(() => t.waitFor(condition, { interval: -1 }), RangeError)
    assert.throws(() => t.waitFor(condition, { interval: NaN }), RangeError)
    assert.throws(() => t.waitFor(condition, { interval: Infinity }), RangeError)
    assert.throws(() => t.waitFor(condition, { interval: 2 ** 31 }), RangeError)
    assert.throws(() => t.waitFor(condition, { timeout: -1 }), RangeError)
    assert.throws(() => t.waitFor(condition, { timeout: NaN }), RangeError)
    assert.throws(() => t.waitFor(condition, { timeout: Infinity }), RangeError)
    assert.throws(() => t.waitFor(condition, { timeout: 2 ** 31 }), RangeError)
    assert.equal(calls, 0)
  })

  it('accepts zero, fractional, and maximum native timer delays', async (t) => {
    assert.equal(await t.waitFor(() => 1, { timeout: 0, interval: 0 }), 1)
    assert.equal(await t.waitFor(() => 2, { timeout: 0.5, interval: 0.5 }), 2)
    assert.equal(await t.waitFor(() => 3, { timeout: 2 ** 31 - 1, interval: 2 ** 31 - 1 }), 3)
  })

  it('times out with the last failure even when the current attempt never settles', async (t) => {
    let attempts = 0
    let lastFailure = { reason: 'not ready' }
    await assert.rejects(
      t.waitFor(
        () => {
          attempts++
          if (attempts === 1) throw new Error('first failure')
          if (attempts === 2) throw lastFailure
          return new Promise(() => {})
        },
        { interval: 0, timeout: 30 },
      ),
      (error: unknown) => {
        assert.ok(error instanceof Error)
        assert.equal(error.message, 'waitFor() timed out')
        assert.equal(error.cause, lastFailure)
        return true
      },
    )
    assert.equal(attempts, 3)
  })

  it('preserves an explicitly thrown undefined as the timeout cause', async (t) => {
    await assert.rejects(
      t.waitFor(
        () => {
          throw undefined
        },
        { timeout: 0 },
      ),
      (error: unknown) => {
        assert.ok(error instanceof Error)
        assert.equal(error.message, 'waitFor() timed out')
        assert.equal(Object.hasOwn(error, 'cause'), true)
        assert.equal(error.cause, undefined)
        return true
      },
    )
  })

  it('ignores a rejection arriving after its deadline without an unhandled rejection', async (t) => {
    let attempt = Promise.withResolvers<never>()
    let attempts = 0
    let unhandled = trackUnhandledRejections(t)

    let result = t.waitFor(
      () => {
        attempts++
        return attempt.promise
      },
      { interval: 0, timeout: 0 },
    )
    await assert.rejects(result, (error: unknown) => {
      assert.ok(error instanceof Error)
      assert.equal(error.message, 'waitFor() timed out')
      assert.equal(Object.hasOwn(error, 'cause'), false)
      return true
    })
    attempt.reject(new Error('late failure'))
    await new Promise((resolve) => realSetTimeout(resolve, 15))
    assert.equal(attempts, 1)
    assert.deepEqual(unhandled, [])
  })

  it('handles abandoned waits and their late rejections when the test completes', async (outer) => {
    let { testContext: t, cleanup } = createTestContext()
    let attempt = Promise.withResolvers<never>()
    let unhandled = trackUnhandledRejections(outer)
    void t.waitFor(() => attempt.promise, { interval: 0 })
    await cleanup()
    attempt.reject(new Error('late failure'))
    await new Promise((resolve) => realSetTimeout(resolve, 15))
    assert.deepEqual(unhandled, [])
  })

  it('does not start an attempt after the test has aborted', async () => {
    let controller = new AbortController()
    let { testContext: t, cleanup } = createTestContext({ signal: controller.signal })
    controller.abort('stopped')
    let calls = 0
    await assert.rejects(
      t.waitFor(() => calls++),
      (error: unknown) => error === 'stopped',
    )
    assert.equal(calls, 0)
    await cleanup()
  })

  it('cancels pending polling before user cleanup without aborting the public signal', async () => {
    let { testContext: t, cleanup } = createTestContext()
    let attempts = 0
    let result = t.waitFor(
      () => {
        attempts++
        throw new Error('not yet')
      },
      { interval: 0 },
    )
    let rejected = assert.rejects(result, { name: 'AbortError' })
    let cleanupFailure = new Error('cleanup failed')
    t.after(() => {
      throw cleanupFailure
    })
    await assert.rejects(cleanup(), (error: unknown) => error === cleanupFailure)
    await rejected
    await new Promise((resolve) => realSetTimeout(resolve, 15))
    assert.equal(attempts, 1)
    assert.equal(t.signal.aborted, false)
    await assert.rejects(
      t.waitFor(() => attempts++),
      { name: 'AbortError' },
    )
    assert.equal(attempts, 1)
  })

  it(
    'polls and enforces its deadline with frozen timers and Date',
    { timeout: 1000 },
    async (t) => {
      t.useFakeTimers()
      t.mock.method(Date, 'now', () => 0)
      let attempts = 0
      let value = await t.waitFor(
        () => {
          if (++attempts < 2) throw new Error('not yet')
          return 'ready'
        },
        { interval: 1 },
      )
      assert.equal(value, 'ready')
      assert.equal(attempts, 2)
      await assert.rejects(
        t.waitFor(() => new Promise(() => {}), { timeout: 0 }),
        /waitFor\(\) timed out/,
      )
      assert.equal(Date.now(), 0)
    },
  )
})

function trackUnhandledRejections(t: TestContext): unknown[] {
  let unhandled: unknown[] = []
  let onUnhandled = (reason: unknown) => unhandled.push(reason)
  if (typeof process !== 'undefined') {
    process.on('unhandledRejection', onUnhandled)
    t.after(() => {
      process.off('unhandledRejection', onUnhandled)
    })
  } else {
    let onEvent = (event: PromiseRejectionEvent) => onUnhandled(event.reason)
    globalThis.addEventListener('unhandledrejection', onEvent)
    t.after(() => globalThis.removeEventListener('unhandledrejection', onEvent))
  }
  return unhandled
}
