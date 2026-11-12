import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example, { ToastRegion } from './countdown.example.tsx'
import { button, element, mount, waitFor } from '../test-helpers.ts'

function countdownAnimation(host: HTMLElement): Animation {
  let animation = host
    .getAnimations()
    .find(
      (candidate) =>
        candidate.effect instanceof KeyframeEffect &&
        candidate.effect.getKeyframes().some((keyframe) => '--toast-countdown' in keyframe),
    )
  assert.ok(animation)
  return animation
}

describe('Toast countdown example', () => {
  it('pauses the countdown with focus and dismisses after the remaining lifetime', async (t) => {
    let result = await mount(
      t,
      <>
        <Example />
        <ToastRegion />
      </>,
    )
    let trigger = button(result.container, 'Bar')
    await result.act(() => trigger.click())
    let toastItem = element(result.container, '[data-toast]')
    assert.equal(toastItem.hidden, false)
    await waitFor(() => assert.equal(countdownAnimation(toastItem).playState, 'running'))
    await result.act(() => button(toastItem, 'Dismiss notification').focus())
    await waitFor(() => assert.equal(countdownAnimation(toastItem).playState, 'paused'))
    await result.act(() => trigger.focus())
    await waitFor(() => assert.equal(countdownAnimation(toastItem).playState, 'running'))
    await new Promise((resolve) => setTimeout(resolve, 5100))
    await waitFor(() => assert.equal(toastItem.isConnected, false))
  })

  it('renders a bar and SVG ring from the same countdown fraction', async (t) => {
    let result = await mount(
      t,
      <>
        <Example />
        <ToastRegion />
      </>,
    )
    await result.act(() => button(result.container, 'Bar').click())
    await result.act(() => button(result.container, 'Ring').click())
    await result.act(() => element(result.container, '[data-toast] button').focus())
    let indicators = result.container.querySelectorAll<HTMLElement>(
      '[data-toast] div[aria-hidden="true"]',
    )
    assert.equal(indicators.length, 2)
    for (let host of result.container.querySelectorAll<HTMLElement>('[data-toast]')) {
      let animation = countdownAnimation(host)
      assert.equal(animation.playState, 'paused')
      animation.currentTime = 1250
    }
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    let bar = [...indicators].find((indicator) => getComputedStyle(indicator).height === '2px')
    assert.ok(bar)
    assert.equal(new DOMMatrix(getComputedStyle(bar).transform).a, 0.75)
    let ring = result.container.querySelector('circle[pathLength]')
    assert.ok(ring)
    assert.equal(Number.parseFloat(getComputedStyle(ring).strokeDashoffset), -25)
  })
})
