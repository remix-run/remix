import * as assert from '@remix-run/assert'
import { on, ref } from '@remix-run/component'
import { describe, it } from '@remix-run/test'
import { drag } from './drag-mixin.ts'
import { element, frame, mount, pointer, position, waitFor } from '../test/animation.ts'

function near(actual: number, expected: number) {
  assert.ok(Math.abs(actual - expected) < 0.6, `${actual} should equal ${expected}`)
}

describe('drag()', () => {
  it('does not strand a returning card when clicked without dragging', async (t) => {
    let result = await mount(t, <article mix={drag({ snapToOrigin: true })} />)
    let tile = element(result.container, 'article')
    pointer(tile, 'pointerdown', 0, 0)
    pointer(tile, 'pointermove', 100, 0)
    pointer(tile, 'pointerup', 100, 0)
    await frame()
    pointer(tile, 'pointerdown', 90, 0)
    let held = position(tile).x
    await frame()
    await frame()
    near(position(tile).x, held)
    pointer(tile, 'pointerup', 90, 0)
    await waitFor(() => near(position(tile).x, 0))
  })

  it('gives a nested draggable exclusive ownership of the pointer', async (t) => {
    let result = await mount(
      t,
      <section mix={drag({ momentum: false })}>
        <article mix={drag({ momentum: false })} />
      </section>,
    )
    let inner = element(result.container, 'article')
    let outer = element(result.container, 'section')
    pointer(inner, 'pointerdown', 0, 0)
    pointer(inner, 'pointermove', 90, 0)
    pointer(inner, 'pointerup', 90, 0)
    near(position(inner).x, 90)
    near(position(outer).x, 0)
    pointer(outer, 'pointerdown', 0, 0)
    pointer(outer, 'pointermove', 30, 0)
    pointer(outer, 'pointerup', 30, 0)
    near(position(outer).x, 30)
  })

  it('permits a button host but leaves embedded controls alone', async (t) => {
    let result = await mount(
      t,
      <section mix={drag({ momentum: false })}>
        <button mix={drag({ momentum: false })}>Move</button>
        <button>Action</button>
      </section>,
    )
    let tile = element(result.container, 'button')
    pointer(tile, 'pointerdown', 0, 0)
    pointer(tile, 'pointermove', 40, 0)
    pointer(tile, 'pointerup', 40, 0)
    near(position(tile).x, 40)
    let control = element(result.container, 'button:last-child')
    pointer(control, 'pointerdown', 0, 0)
    pointer(control, 'pointermove', 40, 0)
    pointer(control, 'pointerup', 40, 0)
    near(position(element(result.container, 'section')).x, 0)
  })

  it('observes pointer movement even when local listeners stop propagation', async (t) => {
    let result = await mount(
      t,
      <article
        mix={[drag({ momentum: false }), on('pointermove', (event) => event.stopPropagation())]}
      />,
    )
    let tile = element(result.container, 'article')
    pointer(tile, 'pointerdown', 0, 0)
    pointer(tile, 'pointermove', 20, 0)
    pointer(tile, 'pointerup', 20, 0)
    near(position(tile).x, 20)
  })

  it('pans oversized content to either edge without reversing the bounds', async (t) => {
    let container: HTMLElement | undefined
    let result = await mount(
      t,
      <section
        style={{ width: '200px', height: '100px' }}
        mix={ref((node) => {
          container = node
        })}
      >
        <article
          style={{ width: '500px', height: '100px' }}
          mix={drag({
            axis: 'x',
            momentum: false,
            elasticity: 0,
            constraints: () => container,
          })}
        />
      </section>,
    )
    let tile = element(result.container, 'article')
    pointer(tile, 'pointerdown', 0, 0)
    pointer(tile, 'pointermove', -1000, 0)
    pointer(tile, 'pointerup', -1000, 0)
    near(position(tile).x, -300)
    pointer(tile, 'pointerdown', 0, 0)
    pointer(tile, 'pointermove', 1000, 0)
    pointer(tile, 'pointerup', 1000, 0)
    near(position(tile).x, 0)
  })

  it('preserves relative position when the containing element resizes at rest', async (t) => {
    let container: HTMLElement | undefined
    let result = await mount(
      t,
      <section
        style={{ width: '400px', height: '200px' }}
        mix={ref((node) => {
          container = node
        })}
      >
        <article
          style={{ width: '50px', height: '50px' }}
          mix={drag({
            momentum: false,
            elasticity: 0,
            constraints: () => container,
          })}
        />
      </section>,
    )
    let tile = element(result.container, 'article')
    let outer = element(result.container, 'section')
    pointer(tile, 'pointerdown', 0, 0)
    pointer(tile, 'pointermove', 1000, 0)
    pointer(tile, 'pointerup', 1000, 0)
    near(position(tile).x, 350)
    outer.style.width = '200px'
    await waitFor(() => near(position(tile).x, 150))
    outer.style.width = '500px'
    await waitFor(() => near(position(tile).x, 450))
  })

  it('reaches all element edges under rotation and scale', async (t) => {
    let container: HTMLElement | undefined
    let result = await mount(
      t,
      <section
        style={{
          width: '400px',
          height: '200px',
          transform: 'rotate(15deg) scale(1.2)',
          transformOrigin: '0 0',
        }}
        mix={ref((node) => {
          container = node
        })}
      >
        <article
          style={{ width: '50px', height: '50px' }}
          mix={drag({
            momentum: false,
            elasticity: 0,
            constraints: () => container,
          })}
        />
      </section>,
    )
    let tile = element(result.container, 'article')
    pointer(tile, 'pointerdown', 0, 0)
    pointer(tile, 'pointermove', 1000, 1000)
    pointer(tile, 'pointerup', 1000, 1000)
    near(position(tile).x, 350)
    near(position(tile).y, 150)
    pointer(tile, 'pointerdown', 0, 0)
    pointer(tile, 'pointermove', -1000, -1000)
    pointer(tile, 'pointerup', -1000, -1000)
    near(position(tile).x, 0)
    near(position(tile).y, 0)
  })

  it('does not jump to a momentum projection when reduced motion is preferred', async (t) => {
    let nativeMatchMedia = window.matchMedia.bind(window)
    t.mock.method(window, 'matchMedia', (query: string) => {
      let result = nativeMatchMedia(query)
      if (query === '(prefers-reduced-motion: reduce)')
        Object.defineProperty(result, 'matches', { value: true })
      return result
    })
    let result = await mount(t, <article mix={drag()} />)
    let tile = element(result.container, 'article')
    pointer(tile, 'pointerdown', 0, 0)
    pointer(tile, 'pointermove', 40, 0)
    pointer(tile, 'pointerup', 40, 0)
    near(position(tile).x, 40)
    await frame()
    near(position(tile).x, 40)
  })

  it('uses a decaying trajectory to the adjusted target instead of an origin spring', async (t) => {
    let result = await mount(
      t,
      <article
        mix={drag({
          momentum: false,
          friction: 10,
          stiffness: 0,
          dampingRatio: 0,
          modifyTarget: () => 100,
        })}
      />,
    )
    let tile = element(result.container, 'article')
    pointer(tile, 'pointerdown', 0, 0)
    pointer(tile, 'pointermove', 20, 0)
    pointer(tile, 'pointerup', 20, 0)
    await waitFor(() => near(position(tile).x, 100))
  })
})
