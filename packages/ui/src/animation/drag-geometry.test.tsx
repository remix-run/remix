import * as assert from '@remix-run/assert'
import { css, on, ref } from '@remix-run/component'
import type { Handle } from '@remix-run/component'
import { describe, it } from '@remix-run/test'
import { drag } from './drag-mixin.ts'
import type { DragOptions } from './drag-mixin.ts'
import { animateLayout } from './animate-layout-mixin.ts'
import { pointer, button, element, frame, mount, waitFor } from '../test/animation.ts'

function near(actual: number, expected: number) {
  assert.ok(Math.abs(actual - expected) < 0.5, `${actual} should equal ${expected}`)
}

function Fixture(
  handle: Handle<{
    transform?: string
    constrained?: boolean
    constraints?: DragOptions['constraints']
  }>,
) {
  let moved = false
  let container: HTMLElement | undefined
  return () => (
    <div>
      <button
        mix={on('click', () => {
          moved = !moved
          handle.update()
        })}
      >
        Move anchor
      </button>
      <div style={{ transform: handle.props.transform, transformOrigin: '0 0' }}>
        <div
          mix={[
            css({ width: '300px', height: '200px', overflow: 'auto', position: 'relative' }),
            ref((node) => {
              container = node
            }),
          ]}
          aria-label="scroll area"
        >
          <div style={{ width: '600px', height: '450px', position: 'relative' }}>
            <div
              aria-label="tile"
              style={{ left: moved ? '90px' : '30px', top: '30px' }}
              mix={[
                css({ position: 'absolute', width: '50px', height: '50px', background: 'gray' }),
                drag({
                  momentum: false,
                  constraints:
                    handle.props.constraints ??
                    (handle.props.constrained ? () => container : undefined),
                }),
                animateLayout({ size: false, duration: 100 }),
              ]}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

describe('Drag coordinate space', () => {
  it('keeps pixel constraints anchored through scrolling on both axes and later gestures', async (t) => {
    let limits = { left: -100, right: 100, top: -100, bottom: 100 }
    let result = await mount(t, <Fixture constraints={limits} />)
    let tile = element(result.container, '[aria-label="tile"]')
    let scroll = element(result.container, '[aria-label="scroll area"]')
    pointer(tile, 'pointerdown', 0, 0)
    pointer(tile, 'pointermove', 20, 20)
    scroll.scrollLeft = 50
    scroll.scrollTop = 70
    await frame()
    await frame()
    pointer(tile, 'pointermove', 1000, 1000)
    pointer(tile, 'pointerup', 1000, 1000)
    await waitFor(() => {
      near(tile.getBoundingClientRect().left, scroll.getBoundingClientRect().left + 80)
      near(tile.getBoundingClientRect().top, scroll.getBoundingClientRect().top + 60)
    })
    assert.deepEqual(limits, { left: -100, right: 100, top: -100, bottom: 100 })
    pointer(tile, 'pointerdown', 0, 0)
    pointer(tile, 'pointermove', -1000, -1000)
    pointer(tile, 'pointerup', -1000, -1000)
    await waitFor(() => {
      near(tile.getBoundingClientRect().left, scroll.getBoundingClientRect().left - 120)
      near(tile.getBoundingClientRect().top, scroll.getBoundingClientRect().top - 140)
    })
  })

  it('does not mutate supplied pixel constraints when layout moves during a drag', async (t) => {
    let limits = { left: -100, right: 100, top: -100, bottom: 100 }
    let result = await mount(t, <Fixture constraints={limits} />)
    let tile = element(result.container, '[aria-label="tile"]')
    pointer(tile, 'pointerdown', 0, 0)
    pointer(tile, 'pointermove', 20, 20)
    button(result.container, 'Move anchor').click()
    await frame()
    for (let animation of tile.getAnimations()) animation.finish()
    await frame()
    assert.deepEqual(limits, { left: -100, right: 100, top: -100, bottom: 100 })
    pointer(tile, 'pointercancel', 20, 20)
  })

  it('keeps a held tile under the pointer through ancestor scrolling and further movement', async (t) => {
    let result = await mount(t, <Fixture />)
    let tile = element(result.container, '[aria-label="tile"]')
    let scroll = element(result.container, '[aria-label="scroll area"]')
    let home = tile.getBoundingClientRect()
    pointer(tile, 'pointerdown', home.left + 20, home.top + 20)
    pointer(tile, 'pointermove', home.left + 40, home.top + 30)
    scroll.scrollLeft = 60
    scroll.scrollTop = 35
    await frame()
    await frame()
    near(tile.getBoundingClientRect().left, home.left + 20)
    near(tile.getBoundingClientRect().top, home.top + 10)
    pointer(tile, 'pointermove', home.left + 50, home.top + 40)
    near(tile.getBoundingClientRect().left, home.left + 30)
    near(tile.getBoundingClientRect().top, home.top + 20)
    pointer(tile, 'pointerup', home.left + 50, home.top + 40)
    near(tile.getBoundingClientRect().left, home.left + 30)
  })

  it('converts pointer and layout deltas under a scaled parent without double compensation', async (t) => {
    let result = await mount(t, <Fixture transform="scale(1.5, 0.75)" />)
    let tile = element(result.container, '[aria-label="tile"]')
    let home = tile.getBoundingClientRect()
    let x = home.left + 20
    let y = home.top + 20
    pointer(tile, 'pointerdown', x, y)
    pointer(tile, 'pointermove', x + 30, y + 15)
    near(tile.getBoundingClientRect().left, home.left + 30)
    near(tile.getBoundingClientRect().top, home.top + 15)
    button(result.container, 'Move anchor').click()
    await frame()
    for (let animation of tile.getAnimations()) animation.finish()
    await frame()
    near(tile.getBoundingClientRect().left, home.left + 30)
    near(tile.getBoundingClientRect().top, home.top + 15)
    pointer(tile, 'pointermove', x + 45, y + 20)
    near(tile.getBoundingClientRect().left, home.left + 45)
    near(tile.getBoundingClientRect().top, home.top + 20)
    pointer(tile, 'pointercancel', x + 45, y + 20)
  })

  it('tracks a changing parent transform while the pointer is stationary', async (t) => {
    let result = await mount(t, <Fixture />)
    let tile = element(result.container, '[aria-label="tile"]')
    let scroll = element(result.container, '[aria-label="scroll area"]')
    let home = tile.getBoundingClientRect()
    let x = home.left + 20
    let y = home.top + 20
    pointer(tile, 'pointerdown', x, y)
    pointer(tile, 'pointermove', x + 20, y + 10)
    let parent = scroll.parentElement
    assert.ok(parent instanceof HTMLElement)
    parent.style.transform = 'translate(40px, 25px) scale(1.2)'
    await frame()
    await frame()
    // Keep the same grabbed local point, rather than the changing top-left corner.
    near(tile.getBoundingClientRect().left + 24, x + 20)
    near(tile.getBoundingClientRect().top + 24, y + 10)
    pointer(tile, 'pointermove', x + 35, y + 15)
    near(tile.getBoundingClientRect().left + 24, x + 35)
    near(tile.getBoundingClientRect().top + 24, y + 15)
    pointer(tile, 'pointerup', x + 35, y + 15)
  })

  it('composes nested scroll offsets under a transformed ancestor', async (t) => {
    let result = await mount(
      t,
      <div aria-label="outer scroll" style={{ height: '180px', overflow: 'auto' }}>
        <div style={{ height: '600px' }}>
          <Fixture transform="scale(1.25)" />
        </div>
      </div>,
    )
    let tile = element(result.container, '[aria-label="tile"]')
    let outer = element(result.container, '[aria-label="outer scroll"]')
    let inner = element(result.container, '[aria-label="scroll area"]')
    let home = tile.getBoundingClientRect()
    pointer(tile, 'pointerdown', home.left + 20, home.top + 20)
    pointer(tile, 'pointermove', home.left + 35, home.top + 30)
    outer.scrollTop = 40
    inner.scrollLeft = 50
    await frame()
    await frame()
    near(tile.getBoundingClientRect().left, home.left + 15)
    near(tile.getBoundingClientRect().top, home.top + 10)
    pointer(tile, 'pointerup', home.left + 35, home.top + 30)
  })

  it('maps client movement through a statically rotated parent', async (t) => {
    let result = await mount(t, <Fixture transform="rotate(20deg) scale(1.2)" />)
    let tile = element(result.container, '[aria-label="tile"]')
    let home = tile.getBoundingClientRect()
    pointer(tile, 'pointerdown', home.left + 20, home.top + 20)
    pointer(tile, 'pointermove', home.left + 60, home.top + 30)
    near(tile.getBoundingClientRect().left, home.left + 40)
    near(tile.getBoundingClientRect().top, home.top + 10)
    pointer(tile, 'pointerup', home.left + 60, home.top + 30)
  })

  it('uses local pixel constraints under a scaled containing element', async (t) => {
    let result = await mount(t, <Fixture transform="scale(1.5)" constrained />)
    let tile = element(result.container, '[aria-label="tile"]')
    let scroll = element(result.container, '[aria-label="scroll area"]')
    let home = tile.getBoundingClientRect()
    pointer(tile, 'pointerdown', home.left + 20, home.top + 20)
    pointer(tile, 'pointermove', home.left + 1000, home.top + 20)
    pointer(tile, 'pointerup', home.left + 1000, home.top + 20)
    await waitFor(() =>
      near(tile.getBoundingClientRect().right, scroll.getBoundingClientRect().right),
    )
  })
})

function NestedLayout(handle: Handle) {
  let moved = false
  return () => (
    <div>
      <button
        mix={on('click', () => {
          moved = !moved
          handle.update()
        })}
      >
        Move parent
      </button>
      <div
        aria-label="animated parent"
        style={{
          position: 'relative',
          left: moved ? '100px' : '0px',
          width: '200px',
          height: '100px',
        }}
        mix={animateLayout({ size: false, duration: 250 })}
      >
        <div
          aria-label="nested tile"
          mix={[
            css({ position: 'relative', width: '50px', height: '50px', background: 'gray' }),
            drag({ momentum: false }),
            animateLayout({ size: false, duration: 250 }),
          ]}
        />
      </div>
    </div>
  )
}

describe('Nested layout projection boundary', () => {
  it('keeps a held child under the pointer while its parent plays a layout animation', async (t) => {
    let result = await mount(t, <NestedLayout />)
    let tile = element(result.container, '[aria-label="nested tile"]')
    let parent = element(result.container, '[aria-label="animated parent"]')
    let home = tile.getBoundingClientRect()
    pointer(tile, 'pointerdown', home.left + 20, home.top + 20)
    pointer(tile, 'pointermove', home.left + 35, home.top + 20)
    button(result.container, 'Move parent').click()
    await frame()
    for (let animation of parent.getAnimations({ subtree: true })) animation.finish()
    await frame()
    await frame()
    near(tile.getBoundingClientRect().left, home.left + 15)
    pointer(tile, 'pointermove', home.left + 45, home.top + 20)
    near(tile.getBoundingClientRect().left, home.left + 25)
    pointer(tile, 'pointercancel', home.left + 45, home.top + 20)
  })

  it('preserves an idle child position while its parent projects without duplicating movement', async (t) => {
    let result = await mount(t, <NestedLayout />)
    let tile = element(result.container, '[aria-label="nested tile"]')
    let parent = element(result.container, '[aria-label="animated parent"]')
    let home = tile.getBoundingClientRect()
    button(result.container, 'Move parent').click()
    await frame()
    for (let animation of parent.getAnimations({ subtree: true })) {
      animation.pause()
      animation.currentTime = 0
    }
    await frame()
    let projected = tile.getBoundingClientRect()
    near(projected.left, home.left)
    for (let animation of parent.getAnimations({ subtree: true })) animation.currentTime = 125
    await frame()
    near(tile.getBoundingClientRect().left, parent.getBoundingClientRect().left)
    for (let animation of parent.getAnimations({ subtree: true })) animation.finish()
    await frame()
    near(tile.getBoundingClientRect().left, home.left + 100)
  })
})
