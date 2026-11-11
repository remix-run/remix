import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import ExampleWithControls from './basic.controls.tsx'
import Example from './basic.example.tsx'
import { button, element, input, key, mount, waitFor } from '../test-helpers.ts'

// The docs frame pads every demo; mounting bare would leave no room above the trigger, so
// the tooltip would flip away from its default side.
describe('Tooltip example', () => {
  it('opens on keyboard focus and dismisses with Escape', async (t) => {
    let result = await mount(
      t,
      <div style="padding: 48px 0">
        <Example />
      </div>,
    )
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
    let result = await mount(
      t,
      <div style="padding: 48px 0">
        <Example />
      </div>,
    )
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
  it('opens on the side chosen in the placement radio group', async (t) => {
    let result = await mount(
      t,
      <div style="padding: 48px 0">
        <ExampleWithControls />
      </div>,
    )
    let trigger = button(result.container, 'Copy link')
    let top = input(result.container, 'input[value="top"]')
    let right = input(result.container, 'input[value="right"]')
    let popup = element(result.container, '[popover]')
    let arrow = element(popup, '[aria-hidden="true"]')
    assert.equal(top.checked, true)

    await result.act(() => right.click())
    assert.equal(right.checked, true)
    assert.equal(top.checked, false)
    await result.act(() => trigger.focus())
    await waitFor(() => assert.equal(popup.matches(':popover-open'), true))
    await waitFor(() => assert.equal(arrow.getAttribute('data-side'), 'right'))

    let triggerRect = trigger.getBoundingClientRect()
    let popupRect = popup.getBoundingClientRect()
    let arrowRect = arrow.getBoundingClientRect()
    assert.ok(popupRect.left >= triggerRect.right, 'popup is right of the trigger')
    let triggerMiddle = triggerRect.top + triggerRect.height / 2
    let arrowMiddle = arrowRect.top + arrowRect.height / 2
    assert.ok(Math.abs(triggerMiddle - arrowMiddle) < 1, 'arrow is centered on the trigger')
  })
})
