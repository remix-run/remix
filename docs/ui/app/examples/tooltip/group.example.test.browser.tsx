import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example from './group.example.tsx'
import { button, mount, waitFor } from '../test-helpers.ts'

function hover(target: HTMLElement, type: 'pointerenter' | 'pointerleave') {
  target.dispatchEvent(new PointerEvent(type, { pointerType: 'mouse' }))
}

// Tooltip popups render through a Portal and have no role, so tests find them in the body by
// their focusable-but-untabbable popup attributes.
describe('Tooltip group example', () => {
  it('opens neighboring tooltips instantly once one is showing', async (t) => {
    let result = await mount(t, <Example />)
    let bold = button(result.container, 'Bold')
    let italic = button(result.container, 'Italic')
    let [boldPopup, italicPopup] = Array.from(
      document.body.querySelectorAll<HTMLElement>('[tabindex="-1"][data-state]'),
    )

    await result.act(() => hover(bold, 'pointerenter'))
    await waitFor(() => assert.equal(boldPopup.matches('[data-open]'), true))
    assert.equal(boldPopup.hasAttribute('data-instant'), false)

    await result.act(() => {
      hover(bold, 'pointerleave')
      hover(italic, 'pointerenter')
    })
    await waitFor(() => assert.equal(italicPopup.matches('[data-open]'), true))
    assert.equal(italicPopup.hasAttribute('data-instant'), true)
    assert.equal(boldPopup.matches('[data-open]'), false)
    assert.match(italicPopup.textContent ?? '', /Italic/)
  })
})
