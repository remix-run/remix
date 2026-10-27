import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example, { ToastRegion } from './action.example.tsx'
import { button, element, finishAnimations, frame, mount, waitFor } from '../test-helpers.ts'

describe('Toast action example', () => {
  it('publishes a follow-up confirmation after Undo and restores focus', async (t) => {
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
    assert.match(toastItem.textContent ?? '', /Action performed/)
    assert.equal(document.activeElement, trigger)
    let action = button(toastItem, 'Undo')
    action.focus()
    await result.act(() => action.click())
    assert.equal(document.activeElement, trigger)
    await waitFor(() => assert.equal(toastItem.isConnected, false))
    let confirmation = element(result.container, '[data-toast]')
    assert.match(confirmation.textContent ?? '', /Action undone/)
    assert.equal(confirmation.textContent?.includes('Undo'), false)
    await result.act(() => button(confirmation, 'Dismiss notification').click())
    await waitFor(() => assert.equal(result.container.querySelector('[data-toast]'), null))
  })

  it('keeps the confirmation entrance anchored while the hovered toast exits', async (t) => {
    let result = await mount(
      t,
      <>
        <Example />
        <ToastRegion />
      </>,
    )
    await result.act(() => button(result.container, 'Show toast with action').click())
    let region = element(result.container, '[role="region"]')
    await finishAnimations(region)
    await result.act(() =>
      region.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' })),
    )
    await result.act(() => button(region, 'Undo').click())
    let confirmation = element(region, '[data-toast]:not([inert])')
    let previousTop = confirmation.getBoundingClientRect().top
    let deadline = performance.now() + 3000
    while (region.querySelector('[inert]')) {
      assert.ok(performance.now() < deadline, 'The outgoing toast finishes its exit')
      let gap = parseFloat(getComputedStyle(confirmation).marginBlockStart)
      assert.equal(region.offsetHeight, confirmation.offsetHeight + gap)
      let top = confirmation.getBoundingClientRect().top
      assert.ok(top <= previousTop + 1, 'The entrance moves upwards without reversing direction')
      previousTop = top
      await frame()
    }
    await result.act(() => button(confirmation, 'Dismiss notification').click())
    await waitFor(() => assert.equal(region.querySelector('[data-toast]'), null))
  })
})
