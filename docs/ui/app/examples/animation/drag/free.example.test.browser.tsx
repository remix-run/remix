import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import { pointer, position } from './drag-test-helpers.ts'
import Example from './free.example.tsx'
import { button, element, frame, mount, waitFor } from '../../test-helpers.ts'

describe('Both-axis drag example', () => {
  it('reserves both touch axes and prevents native browser dragging', async (t) => {
    let result = await mount(t, <Example />)
    let tile = element(result.container, 'article')
    assert.equal(getComputedStyle(tile).touchAction, 'none')
    let event = new DragEvent('dragstart', { bubbles: true, cancelable: true })
    tile.dispatchEvent(event)
    assert.equal(event.defaultPrevented, true)
  })
  it('only offers reset after the tile leaves the preview', async (t) => {
    let result = await mount(t, <Example />)
    let tile = element(result.container, 'article')
    assert.equal(result.container.querySelector('button'), null)
    pointer(tile, 'pointerdown', 0, 0)
    pointer(tile, 'pointermove', 1000, 0)
    await waitFor(() => assert.ok(result.container.querySelector('button')))
    let reset = button(result.container, 'Reset position')
    assert.ok(
      reset
        .getAnimations()
        .some(
          (animation) =>
            animation.effect instanceof KeyframeEffect &&
            animation.effect.getKeyframes().some((keyframe) => keyframe.opacity === '0'),
        ),
      'Reset fades into view',
    )
    await result.act(() => reset.click())
    let resetTile = element(result.container, 'article')
    assert.notEqual(resetTile, tile)
    assert.deepEqual(position(resetTile), { x: 0, y: 0 })
    await waitFor(() => assert.equal(result.container.querySelector('button'), null))
  })

  it('keeps the placed position after pointer cancellation', async (t) => {
    let result = await mount(t, <Example />)
    let tile = element(result.container, 'article')
    pointer(tile, 'pointerdown', 0, 0)
    pointer(tile, 'pointermove', 60, 20)
    pointer(tile, 'pointercancel', 60, 20)
    for (let index = 0; index < 12; index++) await frame()
    assert.deepEqual(position(tile), { x: 60, y: 20 })
  })

  it('retains momentum if capture is released before pointerup reaches the document', async (t) => {
    let result = await mount(t, <Example />)
    let tile = element(result.container, 'article')
    pointer(tile, 'pointerdown', 0, 0)
    pointer(tile, 'pointermove', 20, 0)
    tile.dispatchEvent(new PointerEvent('lostpointercapture', { pointerId: 1, buttons: 0 }))
    await waitFor(() => assert.ok(position(tile).x > 100))
  })
})
