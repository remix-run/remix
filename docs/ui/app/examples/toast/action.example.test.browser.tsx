import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example, { ToastRegion } from './action.example.tsx'
import { button, element, mount, waitFor } from '../test-helpers.ts'

describe('Toast action example', () => {
  it('renders a persistent native action and restores focus when it closes the toast', async (t) => {
    let result = await mount(
      t,
      <>
        <Example />
        <ToastRegion />
      </>,
    )
    let trigger = button(result.container, 'Show toast with action')
    trigger.focus()
    await result.act(() => trigger.click())
    let toastItem = element(result.container, '[data-toast]')
    assert.match(toastItem.textContent ?? '', /Toast title/)
    assert.equal(document.activeElement, trigger)
    let action = button(toastItem, 'Action')
    action.focus()
    await result.act(() => action.click())
    assert.equal(document.activeElement, trigger)
    await waitFor(() => assert.equal(result.container.querySelector('[data-toast]'), null))
  })
})
