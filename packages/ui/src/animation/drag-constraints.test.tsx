import * as assert from '@remix-run/assert'
import type { Handle } from '@remix-run/component'
import { describe, it } from '@remix-run/test'
import { drag } from './drag-mixin.ts'
import type { DragOptions } from './drag-mixin.ts'
import { element, frame, mount, position, waitFor } from '../test/animation.ts'

function pointer(node: HTMLElement, type: string, x: number, y: number, time: number) {
  if (type === 'pointerdown') {
    Object.defineProperty(node, 'setPointerCapture', { configurable: true, value() {} })
  }
  let event = new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    pointerId: 1,
    isPrimary: true,
    button: 0,
    clientX: x,
    clientY: y,
  })
  Object.defineProperty(event, 'timeStamp', { value: time })
  node.dispatchEvent(event)
}

function flick(node: HTMLElement, x: number, y: number) {
  pointer(node, 'pointerdown', 0, 0, 1000)
  pointer(node, 'pointermove', x / 2, y / 2, 1020)
  pointer(node, 'pointermove', x, y, 1040)
  pointer(node, 'pointerup', x, y, 1040)
}

async function sample(node: HTMLElement, check: (point: { x: number; y: number }) => void) {
  let until = performance.now() + 700
  while (performance.now() < until) {
    await frame()
    check(position(node))
  }
}

const bounds = { left: -100, right: 100, top: -100, bottom: 100 }

function Tile(handle: Handle<{ options: DragOptions }>) {
  return () => (
    <article mix={drag(handle.props.options)} style={{ width: '50px', height: '50px' }} />
  )
}

describe('Drag release constraints', () => {
  it('keeps momentum inside hard right and bottom edges without overshooting', async (t) => {
    let result = await mount(t, <Tile options={{ constraints: bounds, elasticity: 0 }} />)
    let node = element(result.container, 'article')
    flick(node, 40, 40)
    assert.deepEqual(position(node), { x: 40, y: 40 })
    let advanced = false
    await sample(node, ({ x, y }) => {
      assert.ok(x >= 40 && x <= 100, `x=${x} must remain inside the hard edge`)
      assert.ok(y >= 40 && y <= 100, `y=${y} must remain inside the hard edge`)
      if (x > 40 && y > 40) advanced = true
    })
    assert.ok(advanced, 'release momentum must still move the tile')
    assert.deepEqual(position(node), { x: 100, y: 100 })
  })

  it('keeps momentum inside hard left and top edges without overshooting', async (t) => {
    let result = await mount(t, <Tile options={{ constraints: bounds, elasticity: 0 }} />)
    let node = element(result.container, 'article')
    flick(node, -40, -40)
    await sample(node, ({ x, y }) => {
      assert.ok(x <= -40 && x >= -100, `x=${x} must remain inside the hard edge`)
      assert.ok(y <= -40 && y >= -100, `y=${y} must remain inside the hard edge`)
    })
    assert.deepEqual(position(node), { x: -100, y: -100 })
  })

  it('honours per-edge zero elasticity while other edges still bounce', async (t) => {
    let result = await mount(
      t,
      <Tile options={{ constraints: bounds, elasticity: { right: 0 } }} />,
    )
    let node = element(result.container, 'article')
    flick(node, 40, 40)
    let bounced = false
    await sample(node, ({ x, y }) => {
      assert.ok(x <= 100, `x=${x} must remain inside the hard right edge`)
      if (y > 100) bounced = true
    })
    assert.ok(bounced, 'the default elastic bottom edge should still bounce')
  })

  it('clamps spring-driven destinations at hard edges too', async (t) => {
    let result = await mount(
      t,
      <Tile options={{ constraints: bounds, elasticity: 0, modifyTarget: () => 500 }} />,
    )
    let node = element(result.container, 'article')
    flick(node, 40, 40)
    await sample(node, ({ x, y }) => {
      assert.ok(x <= 100 && y <= 100, `${x}, ${y} must remain inside the hard edges`)
    })
    assert.deepEqual(position(node), { x: 100, y: 100 })
  })

  it('allows spring overshoot at elastic edges', async (t) => {
    let result = await mount(t, <Tile options={{ constraints: bounds, elasticity: 0.1 }} />)
    let node = element(result.container, 'article')
    flick(node, 40, 40)
    let bounced = false
    await sample(node, ({ x }) => {
      if (x > 100) bounced = true
    })
    assert.ok(bounced, 'nonzero elasticity should retain boundary bounce')
  })
})

describe('Drag friction', () => {
  it('projects travel from the raw per-second friction rate', async (t) => {
    let projected: number | undefined
    let result = await mount(
      t,
      <article
        mix={drag({
          axis: 'x',
          friction: 1,
          modifyTarget(target) {
            projected = target
            return 40
          },
        })}
      />,
    )
    flick(element(result.container, 'article'), 40, 0)
    assert.equal(projected, 1040)
  })

  it('slows momentum faster and shortens travel when friction increases', async (t) => {
    let result = await mount(
      t,
      <>
        <article mix={drag({ axis: 'x', friction: 5 })} />
        <article mix={drag({ axis: 'x', friction: 10 })} />
      </>,
    )
    let lower = element(result.container, 'article:first-child')
    let higher = element(result.container, 'article:last-child')
    flick(lower, 40, 0)
    flick(higher, 40, 0)
    for (let index = 0; index < 6; index++) await frame()
    let lowerDistance = position(lower).x - 40
    let higherDistance = position(higher).x - 40
    assert.ok(higherDistance > 0, 'higher friction should still allow momentum')
    assert.ok(higherDistance < lowerDistance, 'higher friction should reduce travel')
    assert.ok(
      higherDistance / 100 > lowerDistance / 200,
      'higher friction should approach its resting position faster',
    )
    await waitFor(() => {
      assert.equal(position(lower).x, 240)
      assert.equal(position(higher).x, 140)
    })
  })

  it('uses the default friction to project the release destination', async (t) => {
    let projected: number | undefined
    let result = await mount(
      t,
      <article
        mix={drag({
          axis: 'x',
          modifyTarget(target) {
            projected = target
            return 40
          },
        })}
      />,
    )
    flick(element(result.container, 'article'), 40, 0)
    assert.equal(projected, 40 + 1000 / 2)
  })

  it('uses the default friction for nonpositive and nonfinite values', async (t) => {
    let nonpositiveTarget: number | undefined
    let nonfiniteTarget: number | undefined
    let result = await mount(
      t,
      <>
        <article
          mix={drag({
            axis: 'x',
            friction: 0,
            modifyTarget(target) {
              nonpositiveTarget = target
              return 40
            },
          })}
        />
        <article
          mix={drag({
            axis: 'x',
            friction: Infinity,
            modifyTarget(target) {
              nonfiniteTarget = target
              return 40
            },
          })}
        />
      </>,
    )
    flick(element(result.container, 'article:first-child'), 40, 0)
    flick(element(result.container, 'article:last-child'), 40, 0)
    assert.equal(nonpositiveTarget, 40 + 1000 / 2)
    assert.equal(nonfiniteTarget, 40 + 1000 / 2)
  })
})

describe('Drag damping ratio', () => {
  it('allows bounce below 1 and prevents oscillation at 1 when returning from rest', async (t) => {
    let result = await mount(
      t,
      <>
        <article
          mix={drag({
            axis: 'x',
            constraints: { left: 0, right: 0 },
            elasticity: 1,
            momentum: false,
            stiffness: 500,
            dampingRatio: 0.3,
          })}
        />
        <article
          mix={drag({
            axis: 'x',
            constraints: { left: 0, right: 0 },
            elasticity: 1,
            momentum: false,
            stiffness: 500,
            dampingRatio: 1,
          })}
        />
      </>,
    )
    let bouncy = element(result.container, 'article:first-child')
    let critical = element(result.container, 'article:last-child')
    flick(bouncy, 100, 0)
    flick(critical, 100, 0)
    let crossedTarget = false
    await sample(bouncy, ({ x }) => {
      if (x < 0) crossedTarget = true
      assert.ok(position(critical).x >= 0, 'the critical spring must not oscillate from rest')
    })
    assert.ok(crossedTarget, 'the low damping ratio must allow bounce')
    await waitFor(() => {
      assert.equal(position(bouncy).x, 0)
      assert.equal(position(critical).x, 0)
    })
  })
})
