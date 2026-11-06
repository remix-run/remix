import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example, { ToastRegion } from './dynamic-timeout.example.tsx'
import { button, element, mount, waitFor } from '../test-helpers.ts'

describe('Toast dynamic timeout example', () => {
  it('keeps actions available after ordinary toasts expire', async (t) => {
    let result = await mount(
      t,
      <>
        <Example />
        <ToastRegion />
      </>,
    )
    await result.act(() => button(result.container, 'Show toast').click())
    let timed = element(result.container, '[data-toast]')
    await result.act(() => button(result.container, 'Show toast with action').click())
    let persistent = element(result.container, '[data-toast]')
    assert.match(persistent.textContent ?? '', /Toast with action/)
    await new Promise((resolve) => setTimeout(resolve, 5100))
    await waitFor(() => assert.equal(timed.isConnected, false))
    assert.equal(persistent.isConnected, true)
    await result.act(() => button(persistent, 'Undo').click())
    await waitFor(() => assert.equal(persistent.isConnected, false))
    let confirmation = element(result.container, '[data-toast]')
    assert.match(confirmation.textContent ?? '', /Action undone/)
    await result.act(() => button(confirmation, 'Dismiss notification').click())
    await waitFor(() => assert.equal(result.container.querySelector('[data-toast]'), null))
  })
})
