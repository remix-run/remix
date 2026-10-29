import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import { pointer, position } from './drag-test-helpers.ts'
import Example from './resistance.example.tsx'
import { button, element, finishAnimations, frame, mount, waitFor } from '../../test-helpers.ts'

describe('Drag resistance and release', () => {
  it('slides in from below the demo area without fading', async (t) => {
    let result = await mount(t, <Example />)
    let card = element(result.container, 'article')
    let stage = card.parentElement
    assert.ok(stage instanceof HTMLElement)
    let animations = card.getAnimations()
    assert.ok(animations.length > 0)
    for (let animation of animations) {
      animation.pause()
      animation.currentTime = 0
    }
    await frame()
    assert.ok(
      card.getBoundingClientRect().top >= stage.getBoundingClientRect().bottom,
      `card top ${card.getBoundingClientRect().top}, stage bottom ${stage.getBoundingClientRect().bottom}, translate ${getComputedStyle(card).translate}`,
    )
    assert.equal(getComputedStyle(card).opacity, '1')
    for (let animation of animations) animation.finish()
    await frame()
    assert.ok(card.getBoundingClientRect().bottom <= stage.getBoundingClientRect().bottom)
  })

  it('leaves vertical touch movement available for scrolling', async (t) => {
    let result = await mount(t, <Example />)
    let card = element(result.container, 'article')
    await finishAnimations(card)
    assert.equal(getComputedStyle(card).touchAction, 'pan-y')
    await result.act(() => {
      card.dispatchEvent(
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
      card.dispatchEvent(
        new PointerEvent('pointermove', {
          bubbles: true,
          pointerId: 1,
          pointerType: 'touch',
          isPrimary: true,
          clientX: 102,
          clientY: 130,
        }),
      )
    })
    assert.equal(card.hasAttribute('data-dragging'), false)
    assert.equal(getComputedStyle(card).translate, 'none')
  })
  it('dismisses to the right and inserts a fresh card after the exit', async (t) => {
    let result = await mount(t, <Example />)
    let card = element(result.container, 'article')
    pointer(card, 'pointerdown', 100, 100)
    pointer(card, 'pointermove', 200, 100)
    await result.act(() => pointer(card, 'pointerup', 200, 100))
    await waitFor(() => assert.equal(card.isConnected, false))
    assert.equal(result.container.querySelector('article'), null)
    await waitFor(() => {
      let next = element(result.container, 'article')
      assert.notEqual(next, card)
      assert.deepEqual(position(next), { x: 0, y: 0 })
    })
  })

  it('allows a renewed forward swipe to dismiss before reaching the previous peak', async (t) => {
    let result = await mount(t, <Example />)
    let card = element(result.container, 'article')
    await finishAnimations(card)
    pointer(card, 'pointerdown', 100, 100)
    pointer(card, 'pointermove', 260, 100)
    pointer(card, 'pointermove', 140, 100)
    pointer(card, 'pointermove', 200, 100)
    await result.act(() => pointer(card, 'pointerup', 200, 100))
    assert.equal(card.inert, true)
    await waitFor(() => assert.equal(card.isConnected, false))
  })

  it('provides a dismiss button independently of dragging', async (t) => {
    let result = await mount(t, <Example />)
    let card = element(result.container, 'article')
    await result.act(() => button(result.container, 'Dismiss card').click())
    await waitFor(() => assert.equal(card.isConnected, false))
  })
})
