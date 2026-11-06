import * as assert from '@remix-run/assert'
import timers, { setTimeout as capturedTimeout } from 'node:timers'
import promises, { setTimeout as capturedPromiseTimeout } from 'node:timers/promises'
import { getEventListeners } from 'node:events'
import { describe, it } from '../index.ts'
import type { TestContext } from '../index.ts'
import { createTestContext } from '../lib/context.ts'

describe('Node-compatible timer modules', () => {
  it('shares one clock with timer modules, promises, immediates, and scheduler.wait', async (t) => {
    t.mock.timers.enable()
    let calls: Array<[string, number]> = []
    setTimeout(() => calls.push(['global', Date.now()]), 10)
    timers.setTimeout(() => calls.push(['module', Date.now()]), 10)
    let interval = timers.setInterval(() => calls.push(['interval', Date.now()]), 10)
    let promise = promises.setTimeout(10, 'promise')
    let immediate = promises.setImmediate('immediate')
    let wait = promises.scheduler.wait(10)
    timers.setImmediate(() => calls.push(['immediate', Date.now()]))
    let cancelled = timers.setTimeout(() => calls.push(['cancelled', Date.now()]), 5)
    clearTimeout(cancelled)
    t.mock.timers.tick(10)
    timers.clearInterval(interval)
    assert.deepEqual(calls, [
      ['immediate', 10],
      ['global', 10],
      ['module', 10],
      ['interval', 10],
    ])
    assert.equal(await promise, 'promise')
    assert.equal(await immediate, 'immediate')
    assert.equal(await wait, undefined)
  })

  it('preserves bindings captured before enable and restores module methods', async (t) => {
    let timeout = timers.setTimeout
    let promisedTimeout = promises.setTimeout
    let interval = timers.setInterval
    let immediate = timers.setImmediate
    t.mock.timers.enable()
    assert.notEqual(timers.setTimeout, capturedTimeout)
    assert.notEqual(promises.setTimeout, capturedPromiseTimeout)
    await new Promise<void>((resolve) => capturedTimeout(resolve, 1))
    assert.equal(await capturedPromiseTimeout(1, 'real'), 'real')
    assert.equal(Date.now(), 0)
    t.mock.timers.reset()
    assert.equal(timers.setTimeout, timeout)
    assert.equal(promises.setTimeout, promisedTimeout)
    assert.equal(timers.setInterval, interval)
    assert.equal(timers.setImmediate, immediate)
  })

  it('supports promise intervals and abortable promise timers', async (t) => {
    t.mock.timers.enable({ apis: ['setInterval', 'setTimeout'] })
    let iterator = promises.setInterval(10, 'interval')
    let next = iterator.next()
    t.mock.timers.tick(10)
    assert.deepEqual(await next, { value: 'interval', done: false })
    assert.ok(iterator.return)
    await iterator.return()
    let controller = new AbortController()
    let promise = promises.setTimeout(10, 'never', { signal: controller.signal })
    controller.abort()
    await assert.rejects(() => promise, { name: 'AbortError' })
    t.mock.timers.tick(10)
  })

  it('provides mock handle methods and accepts handles across global and module clears', (t) => {
    t.mock.timers.enable()
    let calls = 0
    let timeout = setTimeout(() => calls++, 1)
    assert.equal(timeout.hasRef(), true)
    assert.equal(timeout.ref(), timeout)
    assert.equal(timeout.unref(), timeout)
    assert.equal(timeout.hasRef(), true)
    assert.equal(timeout.refresh(), timeout)
    timers.clearTimeout(timeout)
    let interval = timers.setInterval(() => calls++, 1)
    clearInterval(interval)
    let immediate = setImmediate(() => calls++)
    timers.clearImmediate(immediate)
    t.mock.timers.tick(10)
    assert.equal(calls, 0)
  })

  it(
    'rejects aborted promises with the reason and releases their listeners',
    { timeout: 5000 },
    async (t) => {
      let listenerCount = trackAbortListeners(t)
      t.mock.timers.enable()
      let controller = new AbortController()
      let { signal } = controller
      // Aborting a promise timer must work even if another listener stops propagation.
      signal.addEventListener('abort', (event) => event.stopImmediatePropagation(), { once: true })
      let timeout = promises.setTimeout(10, 'timeout', { signal })
      let immediate = promises.setImmediate('immediate', { signal })
      let waiting = promises.scheduler.wait(10, { signal })
      let reason = new Error('cancel timers')
      controller.abort(reason)
      let expected = { name: 'AbortError', code: 'ABORT_ERR', cause: reason }
      await assert.rejects(() => timeout, expected)
      await assert.rejects(() => immediate, expected)
      await assert.rejects(() => waiting, expected)
      assert.equal(listenerCount(), 0)
      await assert.rejects(() => promises.setTimeout(10, undefined, { signal }), expected)
      await assert.rejects(() => promises.setImmediate(undefined, { signal }), expected)
      await assert.rejects(() => promises.scheduler.wait(10, { signal }), expected)
      t.mock.timers.tick(10)
    },
  )

  it('releases promise listeners on settlement and reset', { timeout: 5000 }, async (t) => {
    let listenerCount = trackAbortListeners(t)
    let { signal } = new AbortController()
    t.mock.timers.enable()
    let done = promises.setTimeout(10, 'done', { signal })
    assert.equal(listenerCount(), 1)
    t.mock.timers.tick(10)
    assert.equal(await done, 'done')
    assert.equal(listenerCount(), 0)
    let settled = false
    void promises.setTimeout(10, undefined, { signal }).then(() => {
      settled = true
    })
    assert.equal(listenerCount(), 1)
    t.mock.timers.reset()
    assert.equal(listenerCount(), 0)
    t.mock.timers.enable()
    t.mock.timers.tick(100)
    await Promise.resolve()
    assert.equal(settled, false)
  })

  it(
    'buffers promise interval ticks and cleans up after return, abort, and reset',
    { timeout: 5000 },
    async (t) => {
      let listenerCount = trackAbortListeners(t)
      t.mock.timers.enable({ apis: ['setInterval'] })
      let controller = new AbortController()
      let { signal } = controller
      let iterator = promises.setInterval(10, 'tick', { signal })
      let next = iterator.next()
      t.mock.timers.tick(30)
      assert.deepEqual(await next, { value: 'tick', done: false })
      assert.deepEqual(await iterator.next(), { value: 'tick', done: false })
      assert.deepEqual(await iterator.next(), { value: 'tick', done: false })
      assert.ok(iterator.return)
      await iterator.return()
      assert.equal(listenerCount(), 0)

      let aborted = promises.setInterval(10, 'never', { signal })
      let pending = aborted.next()
      let reason = new Error('stop interval')
      controller.abort(reason)
      await assert.rejects(() => pending, { name: 'AbortError', code: 'ABORT_ERR', cause: reason })
      assert.equal(listenerCount(), 0)
      await assert.rejects(() => promises.setInterval(10, 'never', { signal }).next(), {
        name: 'AbortError',
        code: 'ABORT_ERR',
        cause: reason,
      })

      let resetSignal = new AbortController().signal
      let reset = promises.setInterval(10, 'never', { signal: resetSignal }).next()
      t.mock.timers.reset()
      assert.deepEqual(await reset, { value: undefined, done: true })
      assert.equal(listenerCount(), 0)
    },
  )

  it('restores module descriptors on completion and abort', async () => {
    let originalTimers = Object.getOwnPropertyDescriptors(timers)
    let originalPromises = Object.getOwnPropertyDescriptors(promises)
    let originalScheduler = Object.getOwnPropertyDescriptors(promises.scheduler)
    let context = createTestContext()
    context.testContext.mock.timers.enable()
    await context.cleanup()
    assert.deepEqual(Object.getOwnPropertyDescriptors(timers), originalTimers)
    assert.deepEqual(Object.getOwnPropertyDescriptors(promises), originalPromises)
    assert.deepEqual(Object.getOwnPropertyDescriptors(promises.scheduler), originalScheduler)

    let controller = new AbortController()
    let aborted = createTestContext({ signal: controller.signal })
    aborted.testContext.mock.timers.enable()
    controller.abort()
    assert.deepEqual(Object.getOwnPropertyDescriptors(timers), originalTimers)
    assert.deepEqual(Object.getOwnPropertyDescriptors(promises), originalPromises)
    assert.deepEqual(Object.getOwnPropertyDescriptors(promises.scheduler), originalScheduler)
    await aborted.cleanup()
  })

  it('rolls back a partial installation and releases ownership', (t) => {
    let originalDate = Date
    let originalTimeout = setTimeout
    let originalTimers = Object.getOwnPropertyDescriptors(timers)
    let originalPromises = Object.getOwnPropertyDescriptors(promises)
    let defineProperty = Object.defineProperty
    let failed = false
    let spy = t.mock.method(
      Object,
      'defineProperty',
      (target: object, name: PropertyKey, descriptor: PropertyDescriptor) => {
        if (!failed && target === promises && name === 'setTimeout') {
          failed = true
          throw new TypeError('Cannot replace module export')
        }
        return defineProperty(target, name, descriptor)
      },
    )
    assert.throws(() => t.mock.timers.enable({ apis: ['Date', 'setTimeout'] }), /Cannot replace/)
    spy.mock.restore?.()
    assert.equal(Date, originalDate)
    assert.equal(setTimeout, originalTimeout)
    assert.deepEqual(Object.getOwnPropertyDescriptors(timers), originalTimers)
    assert.deepEqual(Object.getOwnPropertyDescriptors(promises), originalPromises)
    t.mock.timers.enable()
    assert.equal(Date.now(), 0)
  })
})

describe('scheduler.wait', () => {
  it('can be mocked without replacing global timeout functions', async (t) => {
    let timeout = setTimeout
    t.mock.timers.enable({ apis: ['Date', 'scheduler.wait'] })
    let waiting = promises.scheduler.wait(10)
    t.mock.timers.tick(10)
    await waiting
    assert.equal(Date.now(), 10)
    assert.equal(setTimeout, timeout)
  })
})

// Observe listeners on dependent signals as well as the caller's signal.
function trackAbortListeners(t: TestContext): () => number {
  let signals: AbortSignal[] = []
  let any = AbortSignal.any
  t.mock.method(AbortSignal, 'any', (sources: AbortSignal[]) => {
    let signal = any(sources)
    signals.push(signal)
    return signal
  })
  return () =>
    signals.reduce((total, signal) => total + getEventListeners(signal, 'abort').length, 0)
}
