import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example from './direction-lock.example.tsx'
import { element, mount, waitFor } from '../../test-helpers.ts'
import { pointer, position } from './drag-test-helpers.ts'

describe('Direction lock example', () => {
  it('locks the initial direction and resets the axis on release', async (t) => {
    let result = await mount(t, <Example />)
    let tile = element(result.container, 'article')
    pointer(tile, 'pointerdown', 0, 0)
    pointer(tile, 'pointermove', 40, 5)
    pointer(tile, 'pointermove', 50, 100)
    assert.equal(tile.getAttribute('data-drag-axis'), 'x')
    assert.deepEqual(position(tile), { x: 10, y: 0 })
    pointer(tile, 'pointerup', 50, 100)
    assert.equal(tile.hasAttribute('data-drag-axis'), false)
    await waitFor(() => assert.deepEqual(position(tile), { x: 0, y: 0 }))
    pointer(tile, 'pointerdown', 0, 0)
    pointer(tile, 'pointermove', 5, 40)
    assert.equal(tile.getAttribute('data-drag-axis'), 'y')
    assert.deepEqual(position(tile), { x: 0, y: 8 })
    pointer(tile, 'pointercancel', 5, 40)
  })
})
