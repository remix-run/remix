import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('createHoverAim', () => {
  it('starts from an explicit pointer event', () => {
    let hoverAim = createHoverAim()
    let target = createTarget({ top: 40, left: 100, width: 80, height: 80 })

    let started = hoverAim.start(target, pointerEvent('pointerleave', 40, 80))

    expect(started).toBe(true)
    expect(hoverAim.accepts(pointerEvent('pointermove', 80, 80))).toBe(false)
  })

  it('suppresses pointer moves while the pointer stays in the corridor and keeps progressing', () => {
    let hoverAim = createHoverAim()
    let target = createTarget({ top: 40, left: 100, width: 80, height: 80 })
    hoverAim.start(target, pointerEvent('pointerleave', 40, 80))

    expect(hoverAim.accepts(pointerEvent('pointermove', 60, 80))).toBe(false)
    expect(hoverAim.accepts(pointerEvent('pointermove', 80, 80))).toBe(false)
  })

  it('stops suppressing when the pointer enters the target', () => {
    let hoverAim = createHoverAim()
    let target = createTarget({ top: 40, left: 100, width: 80, height: 80 })
    hoverAim.start(target, pointerEvent('pointerleave', 40, 80))

    expect(hoverAim.accepts(pointerEvent('pointermove', 110, 80))).toBe(true)
    expect(hoverAim.accepts(pointerEvent('pointermove', 120, 80))).toBe(true)
  })

  it('stops suppressing when the pointer exits the corridor', () => {
    let hoverAim = createHoverAim()
    let target = createTarget({ top: 40, left: 100, width: 80, height: 80 })
    hoverAim.start(target, pointerEvent('pointerleave', 40, 80))

    expect(hoverAim.accepts(pointerEvent('pointermove', 70, 20))).toBe(true)
  })

  it('stops suppressing when progress stalls inside the corridor', () => {
    let hoverAim = createHoverAim()
    let target = createTarget({ top: 40, left: 100, width: 80, height: 80 })
    hoverAim.start(target, pointerEvent('pointerleave', 40, 80))

    expect(hoverAim.accepts(pointerEvent('pointermove', 80, 80))).toBe(false)
    expect(hoverAim.accepts(pointerEvent('pointermove', 80, 90))).toBe(false)
    expect(hoverAim.accepts(pointerEvent('pointermove', 80, 100))).toBe(true)
  })

  it('stops suppressing after pointer movement stalls', () => {
    let hoverAim = createHoverAim()
    let target = createTarget({ top: 40, left: 100, width: 80, height: 80 })
    hoverAim.start(target, pointerEvent('pointerleave', 40, 80))

    expect(hoverAim.accepts(pointerEvent('pointermove', 80, 80))).toBe(false)

    vi.advanceTimersByTime(121)

    expect(hoverAim.accepts(pointerEvent('pointermove', 90, 80))).toBe(true)
  })

  it('calls onExpire when the stall timeout clears the session', () => {
    let hoverAim = createHoverAim()
    let target = createTarget({ top: 40, left: 100, width: 80, height: 80 })
    let expired = false
    hoverAim.start(target, pointerEvent('pointerleave', 40, 80), () => {
      expired = true
    })

    vi.advanceTimersByTime(121)

    expect(expired).toBe(true)
  })

  it('replaces the previous session when start is called again', () => {
    let hoverAim = createHoverAim()
    let firstTarget = createTarget({ top: 40, left: 100, width: 80, height: 80 })
    let secondTarget = createTarget({ top: 160, left: 20, width: 80, height: 80 })

    hoverAim.start(firstTarget, pointerEvent('pointerleave', 40, 80))
    hoverAim.start(secondTarget, pointerEvent('pointerleave', 60, 100))

    expect(hoverAim.accepts(pointerEvent('pointermove', 60, 140))).toBe(false)
  })

  it('self-cancels when the target disconnects', () => {
    let hoverAim = createHoverAim()
    let target = createTarget({ top: 40, left: 100, width: 80, height: 80 })
    hoverAim.start(target, pointerEvent('pointerleave', 40, 80))
    target.remove()

    expect(hoverAim.accepts(pointerEvent('pointermove', 80, 80))).toBe(true)
  })
})
