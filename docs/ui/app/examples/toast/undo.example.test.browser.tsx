import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example, { ToastRegion } from './undo.example.tsx'
import { button, element, mount, waitFor } from '../test-helpers.ts'

describe('Toast Undo example', () => {
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
    let notification = element(result.container, '[data-toast]')
    assert.match(notification.textContent ?? '', /Note archived/)
    assert.equal(document.activeElement, trigger)
    let undo = button(notification, 'Undo')
    undo.focus()
    await result.act(() => undo.click())
    assert.equal(document.activeElement, trigger)
    await waitFor(() => assert.equal(result.container.querySelector('[data-toast]'), null))
  })
})
