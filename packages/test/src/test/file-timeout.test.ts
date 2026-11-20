import * as assert from '@remix-run/assert'
import { describe, it } from '../lib/framework.ts'
import { resolveFileTimeout, withFileTimeout } from '../lib/file-timeout.ts'

describe('file execution deadlines', () => {
  it('aborts a pending file with its path and browser project', { timeout: 2_000 }, async (t) => {
    let clock = t.useFakeTimers()
    let pending = Promise.withResolvers<void>()
    let signal: AbortSignal | undefined
    let run = withFileTimeout('cart.test.e2e.ts', 'e2e:firefox', 600_000, (deadline) => {
      signal = deadline
      return pending.promise
    })
    clock.advance(599_999)
    assert.equal(signal?.aborted, false)
    clock.advance(1)
    await assert.rejects(run, /cart\.test\.e2e\.ts \[e2e:firefox\].*600000ms/)
    assert.equal(signal?.aborted, true)
    pending.resolve()
  })

  it('clears the deadline after execution completes', async (t) => {
    let clock = t.useFakeTimers()
    let signal: AbortSignal | undefined
    assert.equal(
      await withFileTimeout('fast.test.ts', 'server', 100, async (deadline) => {
        signal = deadline
        return 'done'
      }),
      'done',
    )
    clock.advance(100)
    assert.equal(signal?.aborted, false)
  })

  it('allows a file deadline to be disabled', async (t) => {
    let clock = t.useFakeTimers()
    let pending = Promise.withResolvers<string>()
    let signal: AbortSignal | undefined
    let run = withFileTimeout('slow.test.ts', 'server', 0, (deadline) => {
      signal = deadline
      return pending.promise
    })
    clock.advance(600_001)
    assert.equal(signal?.aborted, false)
    pending.resolve('done')
    assert.equal(await run, 'done')
  })

  it('rejects values that cannot be used as timer deadlines', () => {
    assert.throws(() => resolveFileTimeout(-1), /fileTimeout/)
    assert.throws(() => resolveFileTimeout(1.5), /fileTimeout/)
    assert.throws(() => resolveFileTimeout(Infinity), /fileTimeout/)
    assert.throws(() => resolveFileTimeout(2_147_483_648), /fileTimeout/)
  })
})
