import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example from './panning.example.tsx'
import { element, mount, waitFor } from '../../test-helpers.ts'
import { pointer } from './drag-test-helpers.ts'

describe('Panning', () => {
  it('keeps the viewport covered at either corner of the larger diagram', async (t) => {
    let result = await mount(t, <Example />)
    let canvas = element(result.container, '[aria-label="Pan workflow diagram"]')
    let viewport = canvas.parentElement
    assert.ok(viewport)
    pointer(canvas, 'pointerdown', 0, 0)
    pointer(canvas, 'pointermove', -2000, -2000)
    pointer(canvas, 'pointerup', -2000, -2000)
    await waitFor(() => {
      let outer = viewport.getBoundingClientRect()
      let inner = canvas.getBoundingClientRect()
      assert.ok(Math.abs(inner.right - (outer.right - 1)) < 0.5)
      assert.ok(Math.abs(inner.bottom - (outer.bottom - 1)) < 0.5)
    })
    pointer(canvas, 'pointerdown', 0, 0)
    pointer(canvas, 'pointermove', 2000, 2000)
    pointer(canvas, 'pointerup', 2000, 2000)
    await waitFor(() => {
      let outer = viewport.getBoundingClientRect()
      let inner = canvas.getBoundingClientRect()
      assert.ok(Math.abs(inner.left - (outer.left + 1)) < 0.5)
      assert.ok(Math.abs(inner.top - (outer.top + 1)) < 0.5)
    })
  })
})
