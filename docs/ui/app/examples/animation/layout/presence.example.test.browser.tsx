import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example from './presence.example.tsx'
import {
  button,
  element,
  expectAnimation,
  finishAnimations,
  mount,
  waitFor,
} from '../../test-helpers.ts'

describe('Layout with entrance and exit example', () => {
  it('moves remaining notifications while a dismissed notification exits and animates re-entry', async (t) => {
    let result = await mount(t, <Example />)
    await finishAnimations(result.container)
    let departing = element(result.container, '[data-notification="saved"]')
    let remaining = element(result.container, '[data-notification="export"]')
    let list = element(result.container, 'ol')
    let previousTop = remaining.getBoundingClientRect().top - list.getBoundingClientRect().top

    let dismiss = button(result.container, 'Dismiss Changes saved')
    await result.act(() => dismiss.click())
    assert.equal(departing.isConnected, true)
    assert.equal(getComputedStyle(departing).position, 'absolute')
    let layout = remaining.getAnimations().find((animation) => {
      let effect = animation.effect
      return (
        effect instanceof KeyframeEffect &&
        effect.target === remaining &&
        effect.getKeyframes().some((frame) => frame.transform !== undefined)
      )
    })
    assert.ok(layout, 'The remaining notification animates its position')
    layout.pause()
    layout.currentTime = 0
    let startTop = remaining.getBoundingClientRect().top - list.getBoundingClientRect().top
    assert.ok(
      Math.abs(startTop - previousTop) < 1,
      'Layout animation starts at the previous position',
    )
    layout.play()
    await Promise.all([expectAnimation(remaining), expectAnimation(departing, 'opacity')])
    await waitFor(() => assert.equal(departing.isConnected, false))
    assert.ok(
      Math.abs(remaining.getBoundingClientRect().top - list.getBoundingClientRect().top) < 1,
    )

    await result.act(() => button(result.container, 'Add notification').click())
    let returning = element(result.container, '[data-notification="saved"]')
    await expectAnimation(returning, 'opacity')
    assert.equal(getComputedStyle(returning).opacity, '1')
    assert.equal(button(result.container, 'Add notification').disabled, false)
  })

  it('allows an addition immediately and fades the empty state in and out without moving the list', async (t) => {
    let result = await mount(t, <Example />)
    await finishAnimations(result.container)
    let list = element(result.container, 'ol')
    let height = list.getBoundingClientRect().height
    assert.equal(button(result.container, 'Add notification').disabled, false)
    let add = button(result.container, 'Add notification')
    await result.act(() => add.click())
    await expectAnimation(element(result.container, '[data-notification="upload"]'), 'opacity')
    assert.equal(button(result.container, 'Add notification').disabled, true)
    await result.act(() => button(result.container, 'Add notification').click())
    assert.equal(result.container.querySelectorAll('[data-notification]').length, 3)

    await result.act(() => button(result.container, 'Dismiss Upload complete').click())
    await result.act(() => button(result.container, 'Dismiss Changes saved').click())
    await result.act(() => button(result.container, 'Dismiss Export ready').click())
    let status = element(result.container, '[role="status"]')
    let empty = status.parentElement
    assert.ok(empty)
    assert.equal(status.textContent, "You're all caught up!")
    assert.ok(empty.querySelector('svg'))
    assert.equal(list.getBoundingClientRect().height, height)
    await expectAnimation(empty, 'opacity')

    await result.act(() => button(result.container, 'Add notification').click())
    assert.equal(empty.isConnected, true)
    assert.equal(list.getBoundingClientRect().height, height)
    await Promise.all([
      expectAnimation(empty, 'opacity'),
      expectAnimation(element(result.container, '[data-notification="saved"]'), 'opacity'),
    ])
    await waitFor(() => assert.equal(empty.isConnected, false))
    assert.equal(list.getBoundingClientRect().height, height)
  })
})
