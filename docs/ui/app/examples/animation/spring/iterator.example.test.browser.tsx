import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example from './iterator.example.tsx'
import { button, element, mount, waitFor } from '../../test-helpers.ts'

describe('Spring iterator example', () => {
  it('slides between highlights with intermediate positions and bounded navigation', async (t) => {
    let result = await mount(t, <Example />)
    let previous = button(result.container, 'Previous slide')
    let next = button(result.container, 'Next slide')
    let track = element(result.container, '[inert]').parentElement
    assert.ok(track)
    assert.equal(previous.disabled, true)
    assert.ok(Math.abs(track.children[0].getBoundingClientRect().width - track.clientWidth) < 1)
    let x = () => new DOMMatrixReadOnly(getComputedStyle(track).transform).m41
    await result.act(() => next.click())
    await waitFor(() => assert.ok(x() < 0 && x() > -track.clientWidth))
    await waitFor(() => assert.ok(Math.abs(x() + track.clientWidth) < 1))
    assert.equal(previous.disabled, false)
    assert.equal(track.children[1].getAttribute('aria-hidden'), 'false')
    await result.act(() => next.click())
    await waitFor(() => assert.ok(Math.abs(x() + track.clientWidth * 2) < 1))
    assert.equal(next.disabled, true)
    await result.act(() => previous.click())
    await waitFor(() => assert.ok(Math.abs(x() + track.clientWidth) < 1))
    assert.equal(next.disabled, false)
  })
})
