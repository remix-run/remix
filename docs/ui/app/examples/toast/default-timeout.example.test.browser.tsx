import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example, { ToastRegion } from './default-timeout.example.tsx'
import { button, element, mount, waitFor } from '../test-helpers.ts'

describe('Toast default timeout example', () => {
  it('dismisses a toast after the shared five-second timeout', async (t) => {
    let result = await mount(
      t,
      <>
        <Example />
        <ToastRegion />
      </>,
    )
    await result.act(() => button(result.container, 'Show toast').click())
    let toastItem = element(result.container, '[data-toast]')
    assert.match(toastItem.textContent ?? '', /Toast title/)
    await new Promise((resolve) => setTimeout(resolve, 1000))
    assert.equal(toastItem.isConnected, true)
    await new Promise((resolve) => setTimeout(resolve, 4100))
    await waitFor(() => assert.equal(toastItem.isConnected, false))
  })
})
