import { expect } from '@remix-run/assert'
import { afterEach, describe, it } from '@remix-run/test'

import { createHoverAim } from './hover-aim.ts'

type RectInit = {
  height: number
  left: number
  top: number
  width: number
}

function createRect({ top, left, width, height }: RectInit) {
  return new DOMRect(left, top, width, height)
}

function mockLayout(element: HTMLElement, rectInit: RectInit) {
  let rect = createRect(rectInit)
  element.getBoundingClientRect = () => rect
}

function createTarget(rectInit: RectInit) {
  let target = document.createElement('div')
  document.body.append(target)
  mockLayout(target, rectInit)
  return target
}

function createSourceAndTarget() {
  return {
    source: createTarget({ top: 40, left: 0, width: 80, height: 80 }),
    target: createTarget({ top: 40, left: 100, width: 80, height: 80 }),
  }
}

function pointerEvent(type: string, x: number, y: number) {
  let event = new MouseEvent(type, {
    bubbles: true,
    clientX: x,
    clientY: y,
  }) as PointerEvent

  Object.defineProperty(event, 'pointerType', {
    configurable: true,
    value: 'mouse',
  })

  return event
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('createHoverAim', () => {
  it('starts from an explicit pointer event', () => {
    let hoverAim = createHoverAim()
    let { source, target } = createSourceAndTarget()

    let started = hoverAim.start(source, target, pointerEvent('pointerleave', 40, 80))

    expect(started).toBe(true)
    expect(hoverAim.accepts(pointerEvent('pointermove', 80, 80))).toBe(false)
  })

  it('suppresses pointer moves while the pointer stays in the corridor and keeps progressing', () => {
    let hoverAim = createHoverAim()
    let { source, target } = createSourceAndTarget()
    hoverAim.start(source, target, pointerEvent('pointerleave', 40, 80))

    expect(hoverAim.accepts(pointerEvent('pointermove', 60, 80))).toBe(false)
    expect(hoverAim.accepts(pointerEvent('pointermove', 80, 80))).toBe(false)
  })

  it('stops suppressing when the pointer enters the target', () => {
    let hoverAim = createHoverAim()
    let { source, target } = createSourceAndTarget()
    hoverAim.start(source, target, pointerEvent('pointerleave', 40, 80))

    expect(hoverAim.accepts(pointerEvent('pointermove', 110, 80))).toBe(true)
    expect(hoverAim.accepts(pointerEvent('pointermove', 120, 80))).toBe(true)
  })

  it('stops suppressing when the pointer exits the corridor', () => {
    let hoverAim = createHoverAim()
    let { source, target } = createSourceAndTarget()
    hoverAim.start(source, target, pointerEvent('pointerleave', 40, 80))

    expect(hoverAim.accepts(pointerEvent('pointermove', 70, 20))).toBe(true)
  })

  it('stops suppressing when progress stalls inside the corridor', () => {
    let hoverAim = createHoverAim()
    let { source, target } = createSourceAndTarget()
    hoverAim.start(source, target, pointerEvent('pointerleave', 40, 80))

    expect(hoverAim.accepts(pointerEvent('pointermove', 80, 80))).toBe(false)
    expect(hoverAim.accepts(pointerEvent('pointermove', 80, 90))).toBe(false)
    expect(hoverAim.accepts(pointerEvent('pointermove', 80, 100))).toBe(true)
  })

  it('stops suppressing after pointer movement stalls', (t) => {
    let timers = t.useFakeTimers()
    let hoverAim = createHoverAim()
    let { source, target } = createSourceAndTarget()
    hoverAim.start(source, target, pointerEvent('pointerleave', 40, 80))

    expect(hoverAim.accepts(pointerEvent('pointermove', 80, 80))).toBe(false)

    timers.advance(121)

    expect(hoverAim.accepts(pointerEvent('pointermove', 90, 80))).toBe(true)
  })

  it('calls onExpire when the stall timeout clears the session', (t) => {
    let timers = t.useFakeTimers()
    let hoverAim = createHoverAim()
    let { source, target } = createSourceAndTarget()
    let expired = false
    hoverAim.start(source, target, pointerEvent('pointerleave', 40, 80), () => {
      expired = true
    })

    timers.advance(121)

    expect(expired).toBe(true)
  })

  it('replaces the previous session when start is called again', () => {
    let hoverAim = createHoverAim()
    let first = createSourceAndTarget()
    let secondSource = createTarget({ top: 160, left: 0, width: 80, height: 80 })
    let secondTarget = createTarget({ top: 160, left: 120, width: 80, height: 80 })

    hoverAim.start(first.source, first.target, pointerEvent('pointerleave', 40, 80))
    hoverAim.start(secondSource, secondTarget, pointerEvent('pointerleave', 60, 200))

    expect(hoverAim.accepts(pointerEvent('pointermove', 100, 200))).toBe(false)
  })

  it('self-cancels when the target disconnects', () => {
    let hoverAim = createHoverAim()
    let { source, target } = createSourceAndTarget()
    hoverAim.start(source, target, pointerEvent('pointerleave', 40, 80))
    target.remove()

    expect(hoverAim.accepts(pointerEvent('pointermove', 80, 80))).toBe(true)
  })

  it('does not start when the leave direction heads away from the target', () => {
    let hoverAim = createHoverAim()
    let { source, target } = createSourceAndTarget()

    let started = hoverAim.start(source, target, pointerEvent('pointerleave', 10, 80))

    expect(started).toBe(false)
  })

  it('treats direct entry into the target as a successful handoff', () => {
    let hoverAim = createHoverAim()
    let { source, target } = createSourceAndTarget()
    let event = pointerEvent('pointerleave', 110, 80)
    Object.defineProperty(event, 'relatedTarget', { value: target })

    let started = hoverAim.start(source, target, event)

    expect(started).toBe(true)
    expect(hoverAim.accepts(pointerEvent('pointermove', 120, 80))).toBe(true)
  })

  it('tracks document pointer moves after start', () => {
    let hoverAim = createHoverAim()
    let { source, target } = createSourceAndTarget()
    hoverAim.start(source, target, pointerEvent('pointerleave', 40, 80))

    document.dispatchEvent(pointerEvent('pointermove', 70, 20))

    expect(hoverAim.accepts(pointerEvent('pointermove', 80, 80))).toBe(true)
  })
})
