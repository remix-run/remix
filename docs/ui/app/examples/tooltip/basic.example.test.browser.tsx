import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example from './basic.example.tsx'
import { button, element, key, mount, waitFor } from '../test-helpers.ts'

describe('Tooltip example', () => {
  it('opens on keyboard focus and dismisses with Escape', async (t) => {
    let result = await mount(t, <Example />)
    let trigger = button(result.container, 'Copy link')
    let popup = element(result.container, '[popover]')
    assert.equal(popup.matches(':popover-open'), false)

    await result.act(() => trigger.focus())
    await waitFor(() => assert.equal(popup.matches(':popover-open'), true))
    // The tooltip is visual-only, so the trigger's label must carry the same text.
    assert.equal(popup.textContent?.trim(), trigger.getAttribute('aria-label'))

    await result.act(() => key(trigger, 'Escape'))
    await waitFor(() => assert.equal(popup.matches(':popover-open'), false))
    assert.equal(document.activeElement, trigger)
  })

  it('opens on hover after the delay and points the arrow at the trigger', async (t) => {
    let result = await mount(t, <Example />)
    let trigger = button(result.container, 'Copy link')
    let popup = element(result.container, '[popover]')
    let arrow = element(popup, '[aria-hidden="true"]')

    await result.act(() =>
      trigger.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' })),
    )
    assert.equal(popup.matches(':popover-open'), false)
    await waitFor(() => assert.equal(popup.matches(':popover-open'), true))

    let triggerRect = trigger.getBoundingClientRect()
    let arrowRect = arrow.getBoundingClientRect()
    let triggerCenter = triggerRect.left + triggerRect.width / 2
    let arrowCenter = arrowRect.left + arrowRect.width / 2
    assert.ok(Math.abs(triggerCenter - arrowCenter) < 1, 'arrow is centered on the trigger')
    assert.equal(arrow.getAttribute('data-side'), 'top')
  })
})
