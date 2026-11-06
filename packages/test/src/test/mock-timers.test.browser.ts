import * as assert from '@remix-run/assert'
import { describe, it } from '../index.ts'
import './mock-timers.test.ts'

describe('browser mock.timers', () => {
  it('defaults to available globals and rejects Node-only APIs before installation', (t) => {
    let NativeDate = Date
    let timeout = setTimeout
    assert.throws(() => t.mock.timers.enable({ apis: ['Date', 'setImmediate'] }), {
      code: 'ERR_INVALID_ARG_VALUE',
    })
    assert.throws(() => t.mock.timers.enable({ apis: ['Date', 'scheduler.wait'] }), {
      code: 'ERR_INVALID_ARG_VALUE',
    })
    assert.equal(Date, NativeDate)
    assert.equal(setTimeout, timeout)
    t.mock.timers.enable()
    assert.equal(Date.now(), 0)
    let fired = false
    setTimeout(() => {
      fired = true
    }, 1)
    t.mock.timers.tick()
    assert.equal(fired, true)
  })
})
