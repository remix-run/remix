import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example from './snap-grid.example.tsx'
import { element, frame, mount, waitFor } from '../../test-helpers.ts'
import { pointer, position } from './drag-test-helpers.ts'

describe('Snapping grid', () => {
  it('keeps the outer slots reachable after scrolling during a drag and on later gestures', async (t) => {
    let result = await mount(
      t,
      <div aria-label="scroll area" style={{ height: '200px', overflow: 'auto' }}>
        <div style={{ height: '1000px' }}>
          <Example />
        </div>
      </div>,
    )
    let tile = element(result.container, '[aria-label="Drag between grid slots"]')
    let scroll = element(result.container, '[aria-label="scroll area"]')
    pointer(tile, 'pointerdown', 0, 0)
    pointer(tile, 'pointermove', 40, 40)
    scroll.scrollTop = 50
    await frame()
    await frame()
    pointer(tile, 'pointermove', 500, 500)
    let deadline = performance.now() + 120
    while (performance.now() < deadline) await frame()
    pointer(tile, 'pointerup', 500, 500)
    await waitFor(() => assert.deepEqual(position(tile), { x: 128, y: 128 }))

    pointer(tile, 'pointerdown', 0, 0)
    pointer(tile, 'pointermove', -500, -500)
    deadline = performance.now() + 120
    while (performance.now() < deadline) await frame()
    pointer(tile, 'pointerup', -500, -500)
    await waitFor(() => assert.deepEqual(position(tile), { x: -128, y: -128 }))
  })

  it('snaps a slow release to the nearest slot on both axes', async (t) => {
    let result = await mount(t, <Example />)
    let tile = element(result.container, '[aria-label="Drag between grid slots"]')
    pointer(tile, 'pointerdown', 0, 0)
    pointer(tile, 'pointermove', -90, 50)
    // A held release tests nearest-position snapping without a fling.
    let deadline = performance.now() + 120
    while (performance.now() < deadline) await frame()
    pointer(tile, 'pointerup', -90, 50)
    await waitFor(() => assert.deepEqual(position(tile), { x: -64, y: 64 }))
  })

  it('lets a new drag interrupt snapping at the current position', async (t) => {
    let result = await mount(t, <Example />)
    let tile = element(result.container, '[aria-label="Drag between grid slots"]')
    pointer(tile, 'pointerdown', 0, 0)
    pointer(tile, 'pointermove', -100, 0)
    let deadline = performance.now() + 120
    while (performance.now() < deadline) await frame()
    pointer(tile, 'pointerup', -100, 0)
    await frame()
    let held = position(tile).x
    pointer(tile, 'pointerdown', 0, 0)
    pointer(tile, 'pointermove', 20, 0)
    assert.ok(Math.abs(position(tile).x - (held + 20)) < 0.1)
    pointer(tile, 'pointercancel', 20, 0)
    await frame()
    await frame()
    assert.ok(Math.abs(position(tile).x - (held + 20)) < 0.1)
  })

  it('carries a short flick to the farther slot instead of snapping back', async (t) => {
    let result = await mount(t, <Example />)
    let tile = element(result.container, '[aria-label="Drag between grid slots"]')
    function point(type: string, x: number, time: number) {
      let event = new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        pointerId: 1,
        isPrimary: true,
        button: 0,
        clientX: x,
      })
      Object.defineProperty(event, 'timeStamp', { value: time })
      tile.dispatchEvent(event)
    }
    pointer(tile, 'pointerdown', 0, 0)
    point('pointermove', -5, performance.now() + 100)
    point('pointermove', -10, performance.now() + 200)
    point('pointermove', -25, performance.now() + 300)
    point('pointerup', -25, performance.now() + 310)
    await waitFor(() => assert.equal(position(tile).x, -64))
  })
})
