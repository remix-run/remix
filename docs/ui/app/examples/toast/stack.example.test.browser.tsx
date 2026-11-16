import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example, { ToastRegion } from './stack.example.tsx'
import { button, element, finishAnimations, mount, waitFor } from '../test-helpers.ts'

function pulseAnimation(surface: HTMLElement) {
  return surface.getAnimations().find((animation) => {
    let effect = animation.effect
    return (
      effect instanceof KeyframeEffect &&
      effect.getKeyframes().some((keyframe) => Number(keyframe.scale) > 1)
    )
  })
}

describe('Toast replacement example', () => {
  it('replays a pulse on the same toast without losing focus or pulsing on focus changes', async (t) => {
    let result = await mount(
      t,
      <>
        <Example />
        <ToastRegion />
      </>,
    )
    let trigger = button(result.container, 'Show toast')
    await result.act(() => trigger.click())
    let region = element(result.container, '[role="region"]')
    let toastItem = element(region, '[data-toast]')
    let surface = element(toastItem, ':scope > div > div')
    await finishAnimations(region)
    assert.equal(pulseAnimation(surface), undefined)
    let dismiss = button(toastItem, 'Dismiss notification')
    await result.act(() => dismiss.focus())
    assert.equal(pulseAnimation(surface), undefined)

    await result.act(() => trigger.click())
    assert.equal(region.querySelectorAll('[data-toast]').length, 1)
    assert.equal(element(region, '[data-toast]'), toastItem)
    assert.equal(document.activeElement, dismiss)
    let firstPulse = pulseAnimation(surface)
    assert.ok(firstPulse, 'Publishing the same ID replays the pulse')
    firstPulse.pause()
    await result.act(() => region.focus())
    assert.equal(pulseAnimation(surface), firstPulse)

    await result.act(() => trigger.click())
    let secondPulse = pulseAnimation(surface)
    assert.ok(secondPulse, 'A subsequent publication replays the pulse again')
    assert.notEqual(secondPulse, firstPulse)
    assert.equal(firstPulse.playState, 'idle')
    assert.equal(element(region, '[data-toast]'), toastItem)

    await result.act(() => dismiss.click())
    await waitFor(() => assert.equal(toastItem.isConnected, false))
    assert.equal(secondPulse.playState, 'idle')
    await result.act(() => trigger.click())
    let replacement = element(region, '[data-toast]')
    assert.equal(pulseAnimation(element(replacement, ':scope > div > div')), undefined)
    await result.act(() => button(replacement, 'Dismiss notification').click())
    await waitFor(() => assert.equal(replacement.isConnected, false))
  })

  it('updates the same toast without a pulse when reduced motion is requested', async (t) => {
    t.mock.method(window, 'matchMedia', () => ({ matches: true }))
    let result = await mount(
      t,
      <>
        <Example />
        <ToastRegion />
      </>,
    )
    let trigger = button(result.container, 'Show toast')
    await result.act(() => trigger.click())
    let toastItem = element(result.container, '[data-toast]')
    await result.act(() => trigger.click())
    assert.equal(result.container.querySelectorAll('[data-toast]').length, 1)
    assert.equal(element(result.container, '[data-toast]'), toastItem)
    assert.equal(pulseAnimation(element(toastItem, ':scope > div > div')), undefined)
    await result.act(() => button(toastItem, 'Dismiss notification').click())
    await waitFor(() => assert.equal(toastItem.isConnected, false))
  })
})
