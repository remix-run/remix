import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example, { ToastRegion } from './priority.example.tsx'
import { button, element, mount, waitFor } from '../test-helpers.ts'

describe('Toast priority example', () => {
  it('uses polite and assertive announcements without moving focus', async (t) => {
    let result = await mount(
      t,
      <>
        <Example />
        <ToastRegion />
      </>,
    )
    let lowTrigger = button(result.container, 'Low priority')
    await result.act(() => {
      lowTrigger.focus()
      lowTrigger.click()
    })
    let region = element(result.container, '[role="region"]')
    assert.equal(region.getAttribute('aria-live'), 'polite')
    let lowToast = element(region, '[role="dialog"]')
    assert.match(lowToast.textContent ?? '', /Low priority toast 1/)
    assert.equal(result.container.querySelector('[role="alert"]'), null)
    assert.equal(document.activeElement, lowTrigger)

    let highTrigger = button(result.container, 'High priority')
    await result.act(() => {
      highTrigger.focus()
      highTrigger.click()
    })
    let highToast = element(region, '[role="alertdialog"]')
    assert.match(highToast.textContent ?? '', /High priority toast 2/)
    let announcement = element(result.container, '[role="alert"]')
    assert.match(announcement.textContent ?? '', /High priority toast 2/)
    assert.match(announcement.textContent ?? '', /assertive announcement/)
    assert.equal(document.activeElement, highTrigger)

    await result.act(() => button(highToast, 'Dismiss notification').click())
    await waitFor(() => assert.equal(highToast.isConnected, false))
    assert.equal(result.container.querySelector('[role="alert"]'), null)
    assert.equal(lowToast.isConnected, true)
  })
})
