import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example, { ToastRegion } from './timed.example.tsx'
import { button, element, mount, waitFor } from '../test-helpers.ts'

describe('Timed toast example', () => {
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
    let notification = element(result.container, '[data-toast]')
    let countdown = element(notification, 'div[aria-hidden="true"]')
    assert.equal(countdown.hidden, false)
    await waitFor(() => assert.equal(countdown.getAnimations().length, 1))
    await result.act(() => button(notification, 'Dismiss notification').focus())
    await waitFor(() => assert.equal(countdown.getAnimations()[0]?.playState, 'paused'))
    await result.act(() => trigger.focus())
    await waitFor(() => assert.equal(countdown.getAnimations()[0]?.playState, 'running'))
    await new Promise((resolve) => setTimeout(resolve, 5100))
    await waitFor(() => assert.equal(notification.isConnected, false))
  })

  it('renders a bar, SVG ring and dial from the same countdown fraction', async (t) => {
    let result = await mount(
      t,
      <>
        <Example />
        <ToastRegion />
      </>,
    )
    await result.act(() => button(result.container, 'Bar').click())
    await result.act(() => button(result.container, 'Ring').click())
    await result.act(() => button(result.container, 'Dial').click())
    await result.act(() => element(result.container, '[data-toast] button').focus())
    let indicators = result.container.querySelectorAll<HTMLElement>(
      '[data-toast] div[aria-hidden="true"]',
    )
    assert.equal(indicators.length, 3)
    for (let indicator of indicators) {
      let animation = indicator.getAnimations()[0]
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
    let dial = [...indicators].find(
      (indicator) => !indicator.querySelector('svg') && indicator !== bar,
    )
    assert.ok(dial?.firstElementChild)
    assert.match(getComputedStyle(dial.firstElementChild).backgroundImage, /90deg/)
  })
})
