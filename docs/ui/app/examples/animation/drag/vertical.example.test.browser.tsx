import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example from './vertical.example.tsx'
import { element, mount } from '../../test-helpers.ts'

describe('Vertical drag example', () => {
  it('leaves horizontal touch movement available for scrolling', async (t) => {
    let result = await mount(t, <Example />)
    let tile = element(result.container, 'article')
    assert.equal(getComputedStyle(tile).touchAction, 'pan-x')
    await result.act(() => {
      tile.dispatchEvent(
        new PointerEvent('pointerdown', {
          bubbles: true,
          pointerId: 1,
          pointerType: 'touch',
          isPrimary: true,
          button: 0,
          clientX: 100,
          clientY: 100,
        }),
      )
      tile.dispatchEvent(
        new PointerEvent('pointermove', {
          bubbles: true,
          pointerId: 1,
          pointerType: 'touch',
          isPrimary: true,
          clientX: 130,
          clientY: 102,
        }),
      )
    })
    assert.equal(tile.hasAttribute('data-dragging'), false)
    assert.equal(getComputedStyle(tile).translate, 'none')
  })
})
