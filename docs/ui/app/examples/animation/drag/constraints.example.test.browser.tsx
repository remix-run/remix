import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example from './constraints.example.tsx'
import { element, mount, waitFor } from '../../test-helpers.ts'
import { pointer, position } from './drag-test-helpers.ts'

describe('Container drag example', () => {
  it('resists movement beyond the container and springs back to its edge after release', async (t) => {
    let result = await mount(t, <Example />)
    let tile = element(result.container, 'article')
    pointer(tile, 'pointerdown', 0, 0)
    pointer(tile, 'pointermove', 200, 0)
    assert.ok(position(tile).x > 103 && position(tile).x < 200)
    pointer(tile, 'pointerup', 200, 0)
    await waitFor(() => assert.equal(position(tile).x, 103))
    assert.equal(position(tile).y, 0)
  })
})
