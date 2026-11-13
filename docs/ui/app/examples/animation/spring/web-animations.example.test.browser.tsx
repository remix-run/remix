import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example from './web-animations.example.tsx'
import { button, element, expectAnimation, mount } from '../../test-helpers.ts'

describe('Web Animations spring example', () => {
  it('animates the switch thumb in both directions', async (t) => {
    let result = await mount(t, <Example />)
    let toggle = button(result.container, 'Notifications')
    let thumb = element(toggle, 'span > span')
    let track = element(toggle, ':scope > span')
    assert.equal(track.getBoundingClientRect().width, 56)
    assert.equal(track.getBoundingClientRect().height, 32)
    await result.act(() => toggle.click())
    await expectAnimation(thumb)
    assert.equal(toggle.getAttribute('aria-checked'), 'true')
    assert.equal(new DOMMatrixReadOnly(getComputedStyle(thumb).transform).m41, 24)
    await result.act(() => toggle.click())
    await expectAnimation(thumb)
    assert.equal(toggle.getAttribute('aria-checked'), 'false')
    assert.equal(new DOMMatrixReadOnly(getComputedStyle(thumb).transform).m41, 0)
  })
})
