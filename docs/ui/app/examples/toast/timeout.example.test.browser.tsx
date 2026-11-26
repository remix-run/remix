import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example, { ToastRegion } from './timeout.example.tsx'
import { button, mount } from '../test-helpers.ts'

describe('Toast timeout example', () => {
  it('dismisses the shorter timeout while keeping the longer one open', async (t) => {
    let timers = t.useFakeTimers()
    let result = await mount(
      t,
      <>
        <Example />
        <ToastRegion />
      </>,
    )
    await result.act(() => button(result.container, '3 seconds').click())
    let short = result.container.querySelector('[data-toast]')
    assert.ok(short)
    await result.act(() => button(result.container, '10 seconds').click())
    assert.equal(result.container.querySelectorAll('[data-toast]').length, 2)
    await result.act(() => timers.advance(3000))
    await t.waitFor(() => assert.equal(short.isConnected, false), { timeout: 3000 })
    assert.equal(result.container.querySelectorAll('[data-toast]').length, 1)
  })
})
