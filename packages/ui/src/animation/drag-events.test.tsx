import * as assert from '@remix-run/assert'
import { on } from '@remix-run/component'
import type { Handle } from '@remix-run/component'
import { describe, it } from '@remix-run/test'
import {
  drag,
  DragStartEvent,
  DragEvent,
  DragEndEvent,
  onDragStart,
  onDrag,
  onDragEnd,
} from './drag-mixin.ts'
import { animateLayout } from './animate-layout-mixin.ts'
import { button, element, frame, mount, position, waitFor } from '../test/animation.ts'

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
    pointerType: 'pen',
    shiftKey: true,
  })
  Object.defineProperty(event, 'timeStamp', { value: time })
  node.dispatchEvent(event)
  return event
}

describe('Drag events', () => {
  it('preserves pointer velocity and momentum after holding before a flick', async (t) => {
    let moved: DragEvent | undefined
    let released: DragEndEvent | undefined
    let targets = { x: 0, y: 0 }
    let result = await mount(
      t,
      <article
        mix={[
          drag({
            modifyTarget(target, axis) {
              targets[axis] = target
              return target
            },
          }),
          onDrag((event) => {
            moved = event
          }),
          onDragEnd((event) => {
            released = event
          }),
        ]}
      />,
    )
    let node = element(result.container, 'article')
    pointer(node, 'pointerdown', 0, 0, 1000)
    pointer(node, 'pointermove', 50, 25, 1700)
    pointer(node, 'pointermove', 100, 50, 1750)
    pointer(node, 'pointerup', 100, 50, 1775)
    assert.ok(moved && released)
    assert.deepEqual(moved.velocity, { x: 1000, y: 500 })
    assert.deepEqual(released.velocity, { x: 1000, y: 500 })
    assert.deepEqual(released.offset, { x: 100, y: 50 })
    assert.deepEqual(targets, { x: 100 + 1000 / 2, y: 50 + 500 / 2 })
  })

  it('uses local visual velocity for momentum after a held flick under a scaled parent', async (t) => {
    let released: DragEndEvent | undefined
    let target = 0
    let result = await mount(
      t,
      <div style={{ transform: 'scale(2)', transformOrigin: '0 0' }}>
        <article
          mix={[
            drag({
              axis: 'x',
              modifyTarget(value) {
                target = value
                return value
              },
            }),
            onDragEnd((event) => {
              released = event
            }),
          ]}
        />
      </div>,
    )
    let node = element(result.container, 'article')
    pointer(node, 'pointerdown', 0, 0, 1000)
    pointer(node, 'pointermove', 50, 0, 1700)
    pointer(node, 'pointermove', 100, 0, 1750)
    pointer(node, 'pointerup', 100, 0, 1775)
    assert.ok(released)
    assert.deepEqual(released.velocity, { x: 1000, y: 0 })
    assert.equal(target, 50 + 500 / 2)
  })

  it('reports independent measurement snapshots for start, movement and end', async (t) => {
    let starts: DragStartEvent[] = []
    let moves: DragEvent[] = []
    let ends: DragEndEvent[] = []
    let result = await mount(
      t,
      <article
        mix={[
          drag({ momentum: false }),
          onDragStart((event) => {
            starts.push(event)
          }),
          onDrag((event) => {
            moves.push(event)
          }),
          onDragEnd((event) => {
            ends.push(event)
          }),
        ]}
      />,
    )
    let node = element(result.container, 'article')
    pointer(node, 'pointerdown', 100, 100, 1000)
    pointer(node, 'pointermove', 98, 101, 1010)
    assert.equal(starts.length, 0)
    let source = pointer(node, 'pointermove', 180, 120, 1050)
    assert.ok(starts[0] instanceof DragStartEvent)
    assert.ok(moves[0] instanceof DragEvent)
    assert.equal(starts[0].sourceEvent, source)
    assert.equal(starts[0].cancelable, false)
    assert.equal(moves[0].cancelable, false)
    pointer(node, 'pointermove', 150, 70, 1100)
    pointer(node, 'pointerup', 90, 140, 1150)
    assert.deepEqual(starts[0].offset, { x: 80, y: 20 })
    assert.deepEqual(moves[0].point, { x: 180, y: 120 })
    assert.deepEqual(moves[1].offset, { x: 50, y: -30 })
    assert.deepEqual(ends[0].offset, { x: -10, y: 40 })
  })

  it('supports ancestor capture, bubbling and native document listeners with standard propagation', async (t) => {
    let order: string[] = []
    let listenerSignal: AbortSignal | undefined
    let observed: DragEndEvent | undefined
    let result = await mount(
      t,
      <div
        mix={[
          onDragStart((event, signal) => {
            order.push('capture')
            listenerSignal = signal
            assert.equal(event.currentTarget, parent)
            assert.equal(event.axis, 'y')
          }, true),
          onDragStart(() => {
            order.push('bubble')
          }),
          onDrag((event) => {
            event.stopPropagation()
          }),
        ]}
      >
        <article
          mix={[
            drag({ directionLock: true, snapToOrigin: true }),
            onDragStart(() => {
              order.push('target')
            }),
          ]}
        />
      </div>,
    )
    let parent = element(result.container, 'div')
    let node = element(result.container, 'article')
    let controller = new AbortController()
    t.after(() => controller.abort())
    document.addEventListener(
      'rmx:drag',
      () => {
        order.push('document-move')
      },
      { signal: controller.signal },
    )
    document.addEventListener(
      'rmx:drag-end',
      (event) => {
        observed = event
        event.preventDefault()
      },
      { signal: controller.signal },
    )
    pointer(node, 'pointerdown', 0, 0, 1000)
    pointer(node, 'pointermove', 10, 40, 1050)
    pointer(node, 'pointerup', 10, 40, 1075)
    assert.deepEqual(order, ['capture', 'target', 'bubble'])
    assert.ok(listenerSignal instanceof AbortSignal)
    assert.equal(listenerSignal.aborted, false)
    assert.ok(observed instanceof DragEndEvent)
    assert.equal(observed.target, node)
    assert.equal(observed.defaultPrevented, true)
    await frame()
    assert.equal(position(node).y, 40)
  })

  it('does not dispatch a move after a start listener synchronously cancels the gesture', async (t) => {
    let order: string[] = []
    let result = await mount(
      t,
      <article
        mix={[
          drag({ momentum: false }),
          onDragStart((event) => {
            order.push('start')
            event.currentTarget.dispatchEvent(
              new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
            )
          }),
          onDrag(() => {
            order.push('move')
          }),
          onDragEnd((event) => {
            assert.equal(event.cancelled, true)
            order.push('end')
          }),
        ]}
      />,
    )
    let node = element(result.container, 'article')
    pointer(node, 'pointerdown', 0, 0, 1000)
    pointer(node, 'pointermove', 40, 0, 1050)
    pointer(node, 'pointerup', 40, 0, 1075)
    assert.deepEqual(order, ['start', 'end'])
  })

  it('does not dispatch lifecycle events for an unrecognised gesture', async (t) => {
    let events: Event[] = []
    let result = await mount(
      t,
      <article
        mix={[
          drag(),
          onDragStart((event) => {
            events.push(event)
          }),
          onDrag((event) => {
            events.push(event)
          }),
          onDragEnd((event) => {
            events.push(event)
          }),
        ]}
      />,
    )
    let node = element(result.container, 'article')
    pointer(node, 'pointerdown', 10, 20, 1000)
    pointer(node, 'pointermove', 12, 21, 1050)
    pointer(node, 'pointerup', 12, 21, 1075)
    assert.deepEqual(events, [])
  })

  it('carries pointer measurements independently of transforms, constraints and locked axes', async (t) => {
    let moved: DragEvent | undefined
    let released: DragEndEvent | undefined
    let bubbled: DragEndEvent | undefined
    let result = await mount(
      t,
      <div
        style={{ transform: 'scale(2)', transformOrigin: '0 0' }}
        mix={on('rmx:drag-end', (event) => {
          bubbled = event
        })}
      >
        <article
          style={{ translate: '30px 0' }}
          mix={[
            drag({ axis: 'x', constraints: { right: 0 }, elasticity: 0.1 }),
            onDrag((event) => {
              moved = event
            }),
            onDragEnd((event) => {
              released = event
              event.preventDefault()
            }),
          ]}
        />
      </div>,
    )
    let node = element(result.container, 'article')
    pointer(node, 'pointerdown', 100, 100, 1000)
    pointer(node, 'pointermove', 140, 110, 1050)
    let source = pointer(node, 'pointerup', 145, 112, 1075)
    assert.ok(moved)
    assert.deepEqual(moved.offset, { x: 40, y: 10 })
    assert.deepEqual(moved.velocity, { x: 800, y: 200 })
    assert.ok(released instanceof DragEndEvent)
    assert.ok(released instanceof Event)
    assert.equal(released, bubbled)
    assert.equal(released.target, node)
    assert.equal(released.type, 'rmx:drag-end')
    assert.equal(released.bubbles, true)
    assert.equal(released.cancelable, true)
    assert.equal(released.defaultPrevented, true)
    assert.equal(released.cancelled, false)
    assert.equal(released.sourceEvent, source)
    assert.equal(source.defaultPrevented, false)
    assert.equal(source.pointerType, 'pen')
    assert.equal(source.shiftKey, true)
    assert.deepEqual(released.point, { x: 145, y: 112 })
    assert.deepEqual(released.delta, { x: 5, y: 2 })
    assert.deepEqual(released.offset, { x: 45, y: 12 })
    assert.deepEqual(released.velocity, { x: 600, y: 160 })
    assert.equal(released.axis, 'x')
    assert.equal('maxOffset' in released, false)
  })

  it('measures displacement from each pointer-down rather than the retained element position', async (t) => {
    let offsets: number[] = []
    let result = await mount(
      t,
      <article
        mix={[
          drag({ momentum: false }),
          onDragEnd((event) => {
            offsets.push(event.offset.x)
          }),
        ]}
      />,
    )
    let node = element(result.container, 'article')
    pointer(node, 'pointerdown', 0, 0, 1000)
    pointer(node, 'pointermove', 100, 0, 1050)
    pointer(node, 'pointerup', 100, 0, 1075)
    await waitFor(() => assert.equal(position(node).x, 100))
    pointer(node, 'pointerdown', 100, 0, 1100)
    pointer(node, 'pointermove', 120, 0, 1150)
    pointer(node, 'pointerup', 120, 0, 1175)
    assert.deepEqual(offsets, [100, 20])
    await waitFor(() => assert.equal(position(node).x, 120))
  })

  it('keeps pointer displacement independent of layout rebasing', async (t) => {
    let released: DragEndEvent | undefined
    function Fixture(handle: Handle) {
      let moved = false
      return () => (
        <div>
          <button
            mix={on('click', () => {
              moved = true
              handle.update()
            })}
          >
            Move
          </button>
          <article
            style={{ position: 'absolute', left: moved ? '100px' : '0', top: '0' }}
            mix={[
              animateLayout({ size: false, duration: 0 }),
              drag({ momentum: false }),
              onDragEnd((event) => {
                released = event
              }),
            ]}
          />
        </div>
      )
    }
    let result = await mount(t, <Fixture />)
    let node = element(result.container, 'article')
    pointer(node, 'pointerdown', 0, 0, 1000)
    pointer(node, 'pointermove', 20, 0, 1050)
    button(result.container, 'Move').click()
    await frame()
    pointer(node, 'pointermove', 30, 0, 1100)
    pointer(node, 'pointerup', 30, 0, 1125)
    assert.ok(released)
    assert.deepEqual(released.offset, { x: 30, y: 0 })
    assert.equal(node.getBoundingClientRect().left, 30)
  })

  it('lets a bubbling listener cancel settling without preventing the source pointer event', async (t) => {
    let result = await mount(
      t,
      <div mix={on('rmx:drag-end', (event) => event.preventDefault())}>
        <article mix={drag({ snapToOrigin: true })} />
      </div>,
    )
    let node = element(result.container, 'article')
    pointer(node, 'pointerdown', 0, 0, 1000)
    pointer(node, 'pointermove', 40, 0, 1050)
    let source = pointer(node, 'pointerup', 40, 0, 1075)
    await frame()
    assert.equal(position(node).x, 40)
    assert.equal(source.defaultPrevented, false)
  })

  it('settles even if only the source event is prevented or release prevention happens asynchronously', async (t) => {
    let count = 0
    let result = await mount(
      t,
      <article
        mix={[
          drag({ snapToOrigin: true }),
          onDragEnd((event) => {
            if (count++ === 0) event.sourceEvent?.preventDefault()
            else queueMicrotask(() => event.preventDefault())
          }),
        ]}
      />,
    )
    let node = element(result.container, 'article')
    pointer(node, 'pointerdown', 0, 0, 1000)
    pointer(node, 'pointermove', 40, 0, 1050)
    let source = pointer(node, 'pointerup', 40, 0, 1075)
    assert.equal(source.defaultPrevented, true)
    await waitFor(() => assert.equal(position(node).x, 0))
    pointer(node, 'pointerdown', 0, 0, 2000)
    pointer(node, 'pointermove', 40, 0, 2050)
    pointer(node, 'pointerup', 40, 0, 2075)
    await waitFor(() => assert.equal(position(node).x, 0))
  })

  it('retains the actual Escape event and cannot prevent cancellation settling', async (t) => {
    let released: DragEndEvent | undefined
    let result = await mount(
      t,
      <article
        mix={[
          drag({ snapToOrigin: true }),
          onDragEnd((event) => {
            released = event
            event.preventDefault()
          }),
        ]}
      />,
    )
    let node = element(result.container, 'article')
    pointer(node, 'pointerdown', 0, 0, performance.now())
    pointer(node, 'pointermove', 40, 0, performance.now())
    let escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    node.dispatchEvent(escape)
    assert.ok(released)
    assert.equal(released.cancelled, true)
    assert.equal(released.cancelable, false)
    assert.equal(released.defaultPrevented, false)
    assert.equal(released.sourceEvent, escape)
    assert.deepEqual(released.point, { x: 40, y: 0 })
    await waitFor(() => assert.equal(position(node).x, 0))
  })

  it('retains pointercancel as the source while preserving the last pointer measurements', async (t) => {
    let released: DragEndEvent | undefined
    let result = await mount(
      t,
      <article
        mix={[
          drag({ momentum: false }),
          onDragEnd((event) => {
            released = event
          }),
        ]}
      />,
    )
    let node = element(result.container, 'article')
    pointer(node, 'pointerdown', 10, 20, 1000)
    pointer(node, 'pointermove', 40, 25, 1050)
    let source = pointer(node, 'pointercancel', 0, 0, 1075)
    assert.ok(released)
    assert.equal(released.sourceEvent, source)
    assert.equal(released.cancelled, true)
    assert.deepEqual(released.point, { x: 40, y: 25 })
    assert.deepEqual(released.offset, { x: 30, y: 5 })
  })

  it('forwards blur and clears stale velocity after a stationary release', async (t) => {
    let releases: DragEndEvent[] = []
    let result = await mount(
      t,
      <article
        mix={[
          drag({ momentum: false }),
          onDragEnd((event) => {
            releases.push(event)
          }),
        ]}
      />,
    )
    let node = element(result.container, 'article')
    pointer(node, 'pointerdown', 0, 0, 1000)
    pointer(node, 'pointermove', 40, 0, 1050)
    pointer(node, 'pointerup', 40, 0, 1200)
    assert.deepEqual(releases[0].velocity, { x: 0, y: 0 })
    pointer(node, 'pointerdown', 40, 0, performance.now())
    pointer(node, 'pointermove', 60, 0, performance.now())
    let source = new FocusEvent('blur')
    window.dispatchEvent(source)
    assert.equal(releases[1].sourceEvent, source)
    assert.equal(releases[1].cancelled, true)
  })

  it('has no source event when removal ends a gesture and does not notify again', async (t) => {
    let releases: DragEndEvent[] = []
    function Fixture(handle: Handle) {
      let visible = true
      return () => (
        <div>
          <button
            mix={on('click', () => {
              visible = false
              handle.update()
            })}
          >
            Remove
          </button>
          {visible && (
            <article
              mix={[
                drag({}),
                onDragEnd((event) => {
                  releases.push(event)
                }),
              ]}
            />
          )}
        </div>
      )
    }
    let result = await mount(t, <Fixture />)
    let node = element(result.container, 'article')
    pointer(node, 'pointerdown', 0, 0, 1000)
    pointer(node, 'pointermove', 40, 0, 1050)
    button(result.container, 'Remove').click()
    await frame()
    assert.equal(releases.length, 1)
    assert.equal(releases[0].cancelled, true)
    assert.equal(releases[0].sourceEvent, undefined)
    pointer(node, 'pointerup', 40, 0, 1075)
    assert.equal(releases.length, 1)
  })
})
