import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example from './selection.example.tsx'
import { button, element, expectAnimation, mount, waitFor } from '../../test-helpers.ts'

describe('Layout size example', () => {
  it('animates highlight position and width between views', async (t) => {
    let result = await mount(t, <Example />)
    let highlight = element(result.container, '[inert]')
    let initial = highlight.getBoundingClientRect()
    let activityButton = button(result.container, 'Activity log')
    await result.act(() => activityButton.click())
    let animation: Animation | undefined
    await waitFor(() => {
      animation = highlight.getAnimations()[0]
      assert.ok(animation)
    })
    assert.ok(animation)
    // Seek into the animation instead of hoping a real frame lands mid-flight.
    animation.pause()
    animation.currentTime = Number(animation.effect?.getComputedTiming().duration) * 0.1
    let width = highlight.getBoundingClientRect().width
    assert.ok(
      width > initial.width + 1 && width < activityButton.getBoundingClientRect().width - 1,
      `Expected an intermediate highlight width, got ${width}`,
    )
    await expectAnimation(highlight)
    let activity = highlight.getBoundingClientRect()
    assert.ok(activity.width > initial.width)
    assert.ok(activity.x > initial.x)
    assert.equal(button(result.container, 'Activity log').getAttribute('aria-pressed'), 'true')
    await result.act(() => button(result.container, 'Overview').click())
    await expectAnimation(highlight)
    assert.ok(Math.abs(highlight.getBoundingClientRect().width - initial.width) < 1)
    assert.ok(Math.abs(highlight.getBoundingClientRect().x - initial.x) < 1)
  })
})
