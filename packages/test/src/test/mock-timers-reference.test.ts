import * as assert from '@remix-run/assert'
import timers from 'node:timers'
import promises from 'node:timers/promises'
import { describe, it } from '../index.ts'
import type { MockTimers } from '../index.ts'
import { IS_BUN } from '../lib/runtime.ts'

interface ReferenceClock extends Pick<MockTimers, 'tick' | 'setTime' | 'runAll' | 'reset'> {
  enable(options: {
    apis: Array<'Date' | 'setTimeout' | 'setInterval' | 'setImmediate'>
    now?: number | Date
  }): void
}

// Native Node is an oracle only; the runner and the shared clock do not depend on it.
describe('native Node timer reference', () => {
  it(
    'matches Date, destination ticks, absolute deadlines, and the runAll horizon',
    {
      skip: IS_BUN,
    },
    async (t) => {
      let { mock: native } = await import('node:test')
      assert.deepEqual(recordClock(t.mock.timers), recordClock(native.timers))
    },
  )

  it(
    'matches module callbacks, promise timers, cancellation, and buffered intervals',
    {
      skip: IS_BUN,
    },
    async (t) => {
      let { mock: native } = await import('node:test')
      assert.deepEqual(
        await recordModuleTimers(t.mock.timers),
        await recordModuleTimers(native.timers),
      )
    },
  )
})

function recordClock(clock: ReferenceClock): unknown[] {
  let NativeDate = Date
  let nativeTimeout = setTimeout
  let existing = new Date(123)
  let events: unknown[] = []
  clock.enable({ apis: ['Date', 'setTimeout', 'setInterval'], now: new Date(100) })
  try {
    events.push(
      Date.now(),
      new Date().getTime(),
      Date(),
      new Date(200).getTime(),
      new Date(2026, 5, 1).getTime(),
      existing instanceof Date,
      new Date() instanceof NativeDate,
      Date.parse('2026-01-01T00:00:00Z'),
      Date.UTC(2026, 0, 1),
    )
    setTimeout((value) => events.push([value, Date.now()]), 2, 'first')
    setTimeout(() => {
      events.push(['outer', Date.now()])
      setTimeout(() => events.push(['inner', Date.now()]), 1)
    }, 5)
    let interval = setInterval(() => events.push(['interval', Date.now()]), 4)
    clock.tick(10)
    clearInterval(interval)
    clock.tick()
    setTimeout(() => events.push(['absolute', Date.now()]), 10)
    clock.setTime(200)
    clock.setTime(50)
    clock.tick(70)
    clock.tick()
    setTimeout(() => events.push(['overdue', Date.now()]), 1)
    clock.setTime(300)
    assert.throws(() => clock.runAll(), { code: 'ERR_INVALID_ARG_VALUE' })
    clock.tick(0)

    setTimeout(() => events.push(['ten', Date.now()]), 10)
    setTimeout(() => events.push(['thirty', Date.now()]), 30)
    setTimeout(() => events.push(['twenty', Date.now()]), 20)
    clock.runAll()
    events.push(Date.now())
    clock.runAll()
    events.push(Date.now())
  } finally {
    clock.reset()
  }
  assert.equal(Date, NativeDate)
  assert.equal(setTimeout, nativeTimeout)
  return events
}

async function recordModuleTimers(clock: ReferenceClock): Promise<unknown[]> {
  let events: unknown[] = []
  clock.enable({ apis: ['Date', 'setTimeout', 'setInterval', 'setImmediate'] })
  try {
    let handle = timers.setTimeout(() => events.push('cancelled'), 1)
    events.push(
      handle.hasRef(),
      handle.ref() === handle,
      handle.unref() === handle,
      handle.refresh() === handle,
      handle.hasRef(),
    )
    clearTimeout(handle)
    let cancelledImmediate = setImmediate(() => events.push('cancelled immediate'))
    timers.clearImmediate(cancelledImmediate)
    setTimeout(() => events.push(['global', Date.now()]), 10)
    timers.setTimeout(() => events.push(['module', Date.now()]), 10)
    timers.setImmediate(() => events.push(['immediate', Date.now()]))
    let timeout = promises.setTimeout(10, 'promise')
    let immediate = promises.setImmediate('promise immediate')
    let interval = promises.setInterval(10, 'interval')
    let next = interval.next()
    clock.tick(30)
    events.push(
      await timeout,
      await immediate,
      await next,
      await interval.next(),
      await interval.next(),
    )
    assert.ok(interval.return)
    await interval.return()
    let controller = new AbortController()
    let aborted = promises.setTimeout(10, 'never', { signal: controller.signal })
    controller.abort('cancelled')
    await assert.rejects(() => aborted, {
      name: 'AbortError',
      code: 'ABORT_ERR',
      cause: 'cancelled',
    })
    let bufferedAbort = new AbortController()
    let buffered = promises.setInterval(10, 'buffered', { signal: bufferedAbort.signal })
    let first = buffered.next()
    clock.tick(20)
    bufferedAbort.abort('stop buffered interval')
    events.push(await first, await buffered.next())
    await assert.rejects(() => buffered.next(), {
      name: 'AbortError',
      code: 'ABORT_ERR',
      cause: 'stop buffered interval',
    })
    clock.tick(10)
  } finally {
    clock.reset()
  }
  return events
}
