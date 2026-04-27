import * as assert from '@remix-run/assert'
import { describe, it } from '../lib/framework.ts'
import { createFakeTimers } from '../lib/fake-timers.ts'

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
  it('replaces globalThis timer functions', () => {
    let originalSetTimeout = globalThis.setTimeout
    let originalClearTimeout = globalThis.clearTimeout
    let originalSetInterval = globalThis.setInterval
    let originalClearInterval = globalThis.clearInterval

    let timers = createFakeTimers()
    try {
      assert.notEqual(globalThis.setTimeout, originalSetTimeout)
      assert.notEqual(globalThis.clearTimeout, originalClearTimeout)
      assert.notEqual(globalThis.setInterval, originalSetInterval)
      assert.notEqual(globalThis.clearInterval, originalClearInterval)
    } finally {
      timers.restore()
    }

    assert.equal(globalThis.setTimeout, originalSetTimeout)
    assert.equal(globalThis.clearTimeout, originalClearTimeout)
    assert.equal(globalThis.setInterval, originalSetInterval)
    assert.equal(globalThis.clearInterval, originalClearInterval)
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
