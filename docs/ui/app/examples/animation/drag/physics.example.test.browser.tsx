import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example from './physics.example.tsx'
import { element, frame, input, mount, waitFor } from '../../test-helpers.ts'
import { pointer, position } from './drag-test-helpers.ts'

describe('Drag physics example', () => {
  it('adjusts stretching without changing the resting position', async (t) => {
    let result = await mount(t, <Example />)
    let tile = element(result.container, 'article')
    let origin = tile.parentElement
    assert.ok(origin)
    assert.equal(tile.getBoundingClientRect().left, origin.getBoundingClientRect().left)
    assert.equal(tile.getBoundingClientRect().top, origin.getBoundingClientRect().top)
    pointer(tile, 'pointerdown', 0, 0)
    pointer(tile, 'pointermove', 100, 0)
    assert.equal(position(tile).x, 20)
    pointer(tile, 'pointerup', 100, 0)
    await waitFor(() => assert.equal(position(tile).x, 0))
    let range = element(result.container, 'input[type="range"]')
    assert.ok(range instanceof HTMLInputElement)
    await result.act(() => {
      range.value = '0.5'
      range.dispatchEvent(new Event('input', { bubbles: true }))
    })
    pointer(tile, 'pointerdown', 0, 0)
    pointer(tile, 'pointermove', 100, 0)
    assert.equal(position(tile).x, 50)
    pointer(tile, 'pointerup', 100, 0)
    await waitFor(() => assert.equal(position(tile).x, 0))
  })

  it('applies the selected elasticity to the next drag', async (t) => {
    let result = await mount(t, <Example />)
    let range = result.container.querySelector('input')
    assert.ok(range)
    await result.act(() => {
      range.value = '0'
      range.dispatchEvent(new Event('input', { bubbles: true }))
    })
    let tile = element(result.container, 'article')
    pointer(tile, 'pointerdown', 0, 0)
    pointer(tile, 'pointermove', 100, 0)
    assert.equal(position(tile).x, 0)
    pointer(tile, 'pointerup', 100, 0)
  })

  it('changes the return from bouncing to critical damping with the damping ratio slider', async (t) => {
    let result = await mount(t, <Example />)
    let tile = element(result.container, 'article')
    let ratio = input(result.container, 'label:last-child input')
    pointer(tile, 'pointerdown', 0, 0)
    pointer(tile, 'pointermove', 100, 0)
    pointer(tile, 'pointerup', 100, 0)
    await waitFor(() => assert.ok(position(tile).x < -0.5))
    await waitFor(() => assert.equal(position(tile).x, 0))
    await result.act(() => {
      ratio.value = '1'
      ratio.dispatchEvent(new Event('input', { bubbles: true }))
    })
    pointer(tile, 'pointerdown', 0, 0)
    pointer(tile, 'pointermove', 100, 0)
    pointer(tile, 'pointerup', 100, 0)
    let deadline = performance.now() + 700
    while (performance.now() < deadline) {
      await frame()
      assert.ok(position(tile).x >= 0, 'critical damping must not oscillate from rest')
    }
    await waitFor(() => assert.equal(position(tile).x, 0))
  })
})
