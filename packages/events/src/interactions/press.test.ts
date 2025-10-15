import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { events } from '../lib/events.ts'
import {
  pressDown,
  pressUp,
  longPress,
  press,
  outerPress,
  outerPressDown,
  outerPressUp,
  type PressEventDetail,
} from './press.ts'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('pressDown', () => {
  it('fires with keyboard', () => {
    let element = document.createElement('div')
    let called = false
    let receivedDetail: PressEventDetail | null = null

    let cleanup = events(element, [
      pressDown((event) => {
        called = true
        receivedDetail = event.detail
      }),
    ])

    // Test Space key
    element.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }))
    expect(called).toBe(true)
    expect(receivedDetail).not.toBeNull()
    expect(receivedDetail!.inputType).toBe('keyboard')
    expect(receivedDetail!.target).toBe(element)

    // Reset
    called = false
    receivedDetail = null

    // Test Enter key
    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    expect(called).toBe(true)
    expect(receivedDetail).not.toBeNull()
    expect(receivedDetail!.inputType).toBe('keyboard')

    // Reset
    called = false

    // Test other keys don't trigger
    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }))
    expect(called).toBe(false)

    cleanup()
  })

  it('fires with pointer events', () => {
    let element = document.createElement('div')
    let called = false
    let detail: any = null

    // Position element for hit box testing
    Object.defineProperty(element, 'getBoundingClientRect', {
      value: () => ({ left: 100, top: 100, right: 200, bottom: 200 }),
    })

    document.body.appendChild(element)

    let cleanup = events(element, [
      pressDown((event) => {
        called = true
        detail = (event as any).detail
      }),
    ])

    // Test pointer down within element bounds
    document.dispatchEvent(
      new PointerEvent('pointerdown', {
        clientX: 150,
        clientY: 150,
      }),
    )

    expect(called).toBe(true)
    expect(detail.inputType).toBe('pointer')
    expect(detail.target).toBe(element)

    // Reset
    called = false

    // Test pointer down within default hit box (10px)
    document.dispatchEvent(
      new PointerEvent('pointerdown', {
        clientX: 95, // 5px outside left edge, within 10px hit box
        clientY: 150,
      }),
    )

    expect(called).toBe(true)

    // Reset
    called = false

    // Test pointer down outside hit box
    document.dispatchEvent(
      new PointerEvent('pointerdown', {
        clientX: 80, // 20px outside left edge, outside 10px hit box
        clientY: 150,
      }),
    )

    expect(called).toBe(false)

    document.body.removeChild(element)
    cleanup()
  })

  it('fires with custom hit box', () => {
    let element = document.createElement('div')
    let called = false

    Object.defineProperty(element, 'getBoundingClientRect', {
      value: () => ({ left: 100, top: 100, right: 200, bottom: 200 }),
    })

    document.body.appendChild(element)

    let cleanup = events(element, [
      pressDown(
        () => {
          called = true
        },
        { hit: 20 },
      ),
    ])

    // Test pointer down within custom hit box (20px)
    document.dispatchEvent(
      new PointerEvent('pointerdown', {
        clientX: 85, // 15px outside left edge, within 20px hit box
        clientY: 150,
      }),
    )

    expect(called).toBe(true)

    // Reset
    called = false

    // Test pointer down outside custom hit box
    document.dispatchEvent(
      new PointerEvent('pointerdown', {
        clientX: 75, // 25px outside left edge, outside 20px hit box
        clientY: 150,
      }),
    )

    expect(called).toBe(false)

    document.body.removeChild(element)
    cleanup()
  })
})

describe('pressUp', () => {
  it('fires with keyboard', () => {
    let element = document.createElement('div')
    let called = false
    let detail: any = null

    let cleanup = events(element, [
      pressUp((event) => {
        called = true
        detail = (event as any).detail
      }),
    ])

    // Test Space key
    element.dispatchEvent(new KeyboardEvent('keyup', { key: ' ' }))
    expect(called).toBe(true)
    expect(detail.inputType).toBe('keyboard')
    expect(detail.target).toBe(element)

    // Reset
    called = false
    detail = undefined

    // Test Enter key
    element.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter' }))
    expect(called).toBe(true)
    expect(detail.inputType).toBe('keyboard')

    cleanup()
  })

  it('fires with pointer events and release box', () => {
    let element = document.createElement('div')
    let called = false

    Object.defineProperty(element, 'getBoundingClientRect', {
      value: () => ({ left: 100, top: 100, right: 200, bottom: 200 }),
    })

    document.body.appendChild(element)

    let cleanup = events(element, [
      pressUp(
        () => {
          called = true
        },
        { hit: 10, release: 5 },
      ),
    ])

    // Test pointer up within release box (hit + release = 15px)
    document.dispatchEvent(
      new PointerEvent('pointerup', {
        clientX: 88, // 12px outside left edge, within 15px release box
        clientY: 150,
      }),
    )

    expect(called).toBe(true)

    // Reset
    called = false

    // Test pointer up outside release box
    document.dispatchEvent(
      new PointerEvent('pointerup', {
        clientX: 80, // 20px outside left edge, outside 15px release box
        clientY: 150,
      }),
    )

    expect(called).toBe(false)

    document.body.removeChild(element)
    cleanup()
  })

  it('handles multiple press events on same element', () => {
    let element = document.createElement('div')
    let startCalled = false
    let endCalled = false

    let cleanup = events(element, [
      pressDown(() => {
        startCalled = true
      }),
      pressUp(() => {
        endCalled = true
      }),
    ])

    // Test keyboard sequence
    element.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }))
    expect(startCalled).toBe(true)
    expect(endCalled).toBe(false)

    element.dispatchEvent(new KeyboardEvent('keyup', { key: ' ' }))
    expect(endCalled).toBe(true)

    cleanup()
  })
})

describe('longPress', () => {
  it('fires with default delay', async () => {
    let element = document.createElement('div')
    let longPressCalled = false
    let receivedDetail: PressEventDetail | null = null

    let cleanup = events(element, [
      longPress((event) => {
        longPressCalled = true
        receivedDetail = event.detail
      }),
    ])

    // Start press
    element.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }))
    expect(longPressCalled).toBe(false)

    // Wait for default delay (500ms) + buffer
    vi.advanceTimersByTime(600)

    expect(longPressCalled).toBe(true)
    expect(receivedDetail).not.toBeNull()
    expect(receivedDetail!.inputType).toBe('keyboard')

    cleanup()
  })

  it('cancels on pressUp', async () => {
    let element = document.createElement('div')
    let longPressCalled = false

    let cleanup = events(element, [
      longPress(() => {
        longPressCalled = true
      }),
    ])

    // Start press
    element.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }))
    expect(longPressCalled).toBe(false)

    // End press before delay completes
    vi.advanceTimersByTime(200)
    element.dispatchEvent(new KeyboardEvent('keyup', { key: ' ' }))

    // Wait past the delay time
    vi.advanceTimersByTime(400)
    expect(longPressCalled).toBe(false)

    cleanup()
  })

  it('fires with custom delay', async () => {
    let element = document.createElement('div')
    let longPressCalled = false

    let cleanup = events(element, [
      longPress(
        () => {
          longPressCalled = true
        },
        { delay: 200 },
      ),
    ])

    // Start press
    element.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }))
    expect(longPressCalled).toBe(false)

    // Wait for custom delay + buffer
    vi.advanceTimersByTime(300)

    expect(longPressCalled).toBe(true)

    cleanup()
  })

  it('works with repeated keydown events', async () => {
    let element = document.createElement('div')
    let longPressCalled = false
    let longPressCallCount = 0

    let cleanup = events(element, [
      longPress(() => {
        longPressCalled = true
        longPressCallCount++
      }),
    ])

    // Initial keydown (not a repeat) - should start the timer
    element.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', repeat: false }))
    expect(longPressCalled).toBe(false)

    // Simulate key repeat events that should be ignored and not restart the timer
    vi.advanceTimersByTime(100)
    element.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', repeat: true }))
    element.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', repeat: true }))
    element.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', repeat: true }))

    // Wait for long press to trigger - should only trigger once
    vi.advanceTimersByTime(500)
    expect(longPressCalled).toBe(true)
    expect(longPressCallCount).toBe(1)

    cleanup()
  })

  it('cancels when sliding outside release box', async () => {
    let element = document.createElement('div')
    let longPressCalled = false

    Object.defineProperty(element, 'getBoundingClientRect', {
      value: () => ({ left: 100, top: 100, right: 200, bottom: 200 }),
    })

    document.body.appendChild(element)

    let cleanup = events(element, [
      longPress(
        () => {
          longPressCalled = true
        },
        { hit: 10, release: 5 },
      ),
    ])

    // Start press within hit box
    document.dispatchEvent(
      new PointerEvent('pointerdown', {
        pointerId: 1,
        clientX: 150,
        clientY: 150,
      }),
    )

    expect(longPressCalled).toBe(false)

    // Move outside release box before delay completes
    vi.advanceTimersByTime(200)
    document.dispatchEvent(
      new PointerEvent('pointermove', {
        pointerId: 1,
        clientX: 80, // 20px outside left edge, outside 15px release box (hit + release)
        clientY: 150,
      }),
    )

    // Wait past the delay time
    vi.advanceTimersByTime(400)
    expect(longPressCalled).toBe(false)

    document.body.removeChild(element)
    cleanup()
  })
})

describe('press', () => {
  it('fires without long press', async () => {
    let element = document.createElement('div')
    let pressCalled = false
    let longPressCalled = false
    let receivedDetail: PressEventDetail | null = null

    let cleanup = events(element, [
      press((event) => {
        pressCalled = true
        receivedDetail = event.detail
      }),
      longPress(() => {
        longPressCalled = true
      }),
    ])

    // Start and end press quickly (before long press delay)
    element.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }))
    vi.advanceTimersByTime(100)
    element.dispatchEvent(new KeyboardEvent('keyup', { key: ' ' }))

    expect(pressCalled).toBe(true)
    expect(receivedDetail).not.toBeNull()
    expect(receivedDetail!.inputType).toBe('keyboard')

    // Wait to ensure long press doesn't fire
    vi.advanceTimersByTime(500)
    expect(longPressCalled).toBe(false)

    cleanup()
  })

  it('cancels on long press', async () => {
    let element = document.createElement('div')
    let pressCalled = false
    let longPressCalled = false

    let cleanup = events(element, [
      press(() => {
        pressCalled = true
      }),
      longPress(() => {
        longPressCalled = true
      }),
    ])

    // Start press and wait for long press to trigger
    element.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }))
    vi.advanceTimersByTime(600)

    expect(longPressCalled).toBe(true)
    expect(pressCalled).toBe(false)

    // End press after long press triggered
    element.dispatchEvent(new KeyboardEvent('keyup', { key: ' ' }))
    expect(pressCalled).toBe(false) // should still be false

    cleanup()
  })

  it('works with pointer events and hit boxes', () => {
    let element = document.createElement('div')
    let pressCalled = false
    let receivedDetail: PressEventDetail | null = null

    Object.defineProperty(element, 'getBoundingClientRect', {
      value: () => ({ left: 100, top: 100, right: 200, bottom: 200 }),
    })

    document.body.appendChild(element)

    let cleanup = events(element, [
      press(
        (event) => {
          pressCalled = true
          receivedDetail = event.detail
        },
        { hit: 15, release: 5 },
      ),
    ])

    // Start press within hit box
    document.dispatchEvent(
      new PointerEvent('pointerdown', {
        clientX: 90, // 10px outside left edge, within 15px hit box
        clientY: 150,
      }),
    )

    // End press within release box (hit + release = 20px)
    document.dispatchEvent(
      new PointerEvent('pointerup', {
        clientX: 85, // 15px outside left edge, within 20px release box
        clientY: 150,
      }),
    )

    expect(pressCalled).toBe(true)
    expect(receivedDetail).not.toBeNull()
    expect(receivedDetail!.inputType).toBe('pointer')

    document.body.removeChild(element)
    cleanup()
  })

  it('does not fire when dragging out of element', () => {
    let element = document.createElement('div')
    let pressCalled = false

    Object.defineProperty(element, 'getBoundingClientRect', {
      value: () => ({ left: 100, top: 100, right: 200, bottom: 200 }),
    })

    document.body.appendChild(element)

    let cleanup = events(element, [
      press(() => {
        pressCalled = true
      }),
    ])

    // Start press within element
    document.dispatchEvent(
      new PointerEvent('pointerdown', {
        pointerId: 1,
        clientX: 150,
        clientY: 150,
      }),
    )

    expect(pressCalled).toBe(false)

    // Drag outside the release box
    document.dispatchEvent(
      new PointerEvent('pointermove', {
        pointerId: 1,
        clientX: 70, // Clearly outside the release box (element 100-200, hit+release = 20, so release box is 80-220)
        clientY: 150,
      }),
    )

    // Press should NOT fire when dragging out
    expect(pressCalled).toBe(false)

    // Release outside
    document.dispatchEvent(
      new PointerEvent('pointerup', {
        pointerId: 1,
        clientX: 70,
        clientY: 150,
      }),
    )

    // Press should still not have fired
    expect(pressCalled).toBe(false)

    document.body.removeChild(element)
    cleanup()
  })
})

describe('press integration', () => {
  it('works with all press events together', async () => {
    let element = document.createElement('div')
    let pressDownCalled = false
    let pressUpCalled = false
    let pressCalled = false
    let longPressCalled = false

    let cleanup = events(element, [
      pressDown(() => {
        pressDownCalled = true
      }),
      pressUp(() => {
        pressUpCalled = true
      }),
      press(() => {
        pressCalled = true
      }),
      longPress(() => {
        longPressCalled = true
      }),
    ])

    // Quick press sequence
    element.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }))
    expect(pressDownCalled).toBe(true)

    vi.advanceTimersByTime(100)
    element.dispatchEvent(new KeyboardEvent('keyup', { key: ' ' }))

    expect(pressUpCalled).toBe(true)
    expect(pressCalled).toBe(true)
    expect(longPressCalled).toBe(false)

    cleanup()
  })
})

describe('outerPress', () => {
  it('fires when pressing outside element', () => {
    let element = document.createElement('div')
    let outsideElement = document.createElement('div')

    // Mock getBoundingClientRect for the target element
    Object.defineProperty(element, 'getBoundingClientRect', {
      value: () => ({ left: 100, top: 100, right: 200, bottom: 200 }),
    })

    document.body.appendChild(element)
    document.body.appendChild(outsideElement)

    let called = false

    let cleanup = events(element, [
      outerPress(() => {
        called = true
      }),
    ])

    // Pointer down and up outside the element and its hit box
    document.dispatchEvent(
      new PointerEvent('pointerdown', {
        clientX: 50, // Outside element and default 10px hit box
        clientY: 50,
        bubbles: true,
      }),
    )
    document.dispatchEvent(
      new PointerEvent('pointerup', {
        clientX: 50,
        clientY: 50,
        bubbles: true,
      }),
    )

    expect(called).toBe(true)

    document.body.removeChild(element)
    document.body.removeChild(outsideElement)
    cleanup()
  })

  it('does not fire when pressing inside', () => {
    let element = document.createElement('div')

    // Mock getBoundingClientRect for the target element
    Object.defineProperty(element, 'getBoundingClientRect', {
      value: () => ({ left: 100, top: 100, right: 200, bottom: 200 }),
    })

    document.body.appendChild(element)

    let called = false

    let cleanup = events(element, [
      outerPress(() => {
        called = true
      }),
    ])

    // Pointer down and up inside the element
    document.dispatchEvent(
      new PointerEvent('pointerdown', {
        clientX: 150, // Inside element
        clientY: 150,
        bubbles: true,
      }),
    )
    document.dispatchEvent(
      new PointerEvent('pointerup', {
        clientX: 150,
        clientY: 150,
        bubbles: true,
      }),
    )

    expect(called).toBe(false)

    document.body.removeChild(element)
    cleanup()
  })

  it('does not fire when only pointerdown is outside', () => {
    let element = document.createElement('div')
    let outsideElement = document.createElement('div')

    // Mock getBoundingClientRect for the target element
    Object.defineProperty(element, 'getBoundingClientRect', {
      value: () => ({ left: 100, top: 100, right: 200, bottom: 200 }),
    })

    document.body.appendChild(element)
    document.body.appendChild(outsideElement)

    let called = false

    let cleanup = events(element, [
      outerPress(() => {
        called = true
      }),
    ])

    // Pointer down outside, but up inside
    document.dispatchEvent(
      new PointerEvent('pointerdown', {
        clientX: 50, // Outside element and hit box
        clientY: 50,
        bubbles: true,
      }),
    )
    document.dispatchEvent(
      new PointerEvent('pointerup', {
        clientX: 150, // Inside element
        clientY: 150,
        bubbles: true,
      }),
    )

    expect(called).toBe(false)

    document.body.removeChild(element)
    document.body.removeChild(outsideElement)
    cleanup()
  })

  it('resets properly after firing', () => {
    let element = document.createElement('div')
    let outsideElement = document.createElement('div')

    // Mock getBoundingClientRect for the target element
    Object.defineProperty(element, 'getBoundingClientRect', {
      value: () => ({ left: 100, top: 100, right: 200, bottom: 200 }),
    })

    document.body.appendChild(element)
    document.body.appendChild(outsideElement)

    let callCount = 0

    let cleanup = events(element, [
      outerPress(() => {
        callCount++
      }),
    ])

    // First outer press
    document.dispatchEvent(
      new PointerEvent('pointerdown', {
        clientX: 50, // Outside element and hit box
        clientY: 50,
        bubbles: true,
      }),
    )
    document.dispatchEvent(
      new PointerEvent('pointerup', {
        clientX: 50,
        clientY: 50,
        bubbles: true,
      }),
    )

    expect(callCount).toBe(1)

    // Press inside (should not trigger)
    document.dispatchEvent(
      new PointerEvent('pointerdown', {
        clientX: 150, // Inside element
        clientY: 150,
        bubbles: true,
      }),
    )
    document.dispatchEvent(
      new PointerEvent('pointerup', {
        clientX: 50, // Outside element
        clientY: 50,
        bubbles: true,
      }),
    )

    expect(callCount).toBe(1) // Should still be 1

    // Second outer press
    document.dispatchEvent(
      new PointerEvent('pointerdown', {
        clientX: 50, // Outside element and hit box
        clientY: 50,
        bubbles: true,
      }),
    )
    document.dispatchEvent(
      new PointerEvent('pointerup', {
        clientX: 50,
        clientY: 50,
        bubbles: true,
      }),
    )

    expect(callCount).toBe(2)

    document.body.removeChild(element)
    document.body.removeChild(outsideElement)
    cleanup()
  })

  it('respects hit box', () => {
    let element = document.createElement('div')
    let outsideElement = document.createElement('div')

    // Mock getBoundingClientRect for both elements
    Object.defineProperty(element, 'getBoundingClientRect', {
      value: () => ({ left: 100, top: 100, right: 200, bottom: 200 }),
    })

    document.body.appendChild(element)
    document.body.appendChild(outsideElement)

    let called = false

    let cleanup = events(element, [
      outerPress(
        () => {
          called = true
        },
        { hit: 20 },
      ),
    ])

    // Test pointer down within hit box (should not fire outerPress)
    document.dispatchEvent(
      new PointerEvent('pointerdown', {
        clientX: 85, // 15px outside left edge, within 20px hit box
        clientY: 150,
        bubbles: true,
      }),
    )
    document.dispatchEvent(
      new PointerEvent('pointerup', {
        clientX: 85,
        clientY: 150,
        bubbles: true,
      }),
    )

    expect(called).toBe(false)

    // Test pointer down outside hit box (should fire outerPress)
    document.dispatchEvent(
      new PointerEvent('pointerdown', {
        clientX: 75, // 25px outside left edge, outside 20px hit box
        clientY: 150,
        bubbles: true,
      }),
    )
    document.dispatchEvent(
      new PointerEvent('pointerup', {
        clientX: 75,
        clientY: 150,
        bubbles: true,
      }),
    )

    expect(called).toBe(true)

    document.body.removeChild(element)
    document.body.removeChild(outsideElement)
    cleanup()
  })
})

describe('outerPressDown', () => {
  it('fires immediately on pointer down outside', () => {
    let element = document.createElement('div')
    let outsideElement = document.createElement('div')

    // Mock getBoundingClientRect for the target element
    Object.defineProperty(element, 'getBoundingClientRect', {
      value: () => ({ left: 100, top: 100, right: 200, bottom: 200 }),
    })

    document.body.appendChild(element)
    document.body.appendChild(outsideElement)

    let called = false
    let receivedDetail: any = null

    let cleanup = events(element, [
      outerPressDown((event) => {
        called = true
        receivedDetail = event.detail
      }),
    ])

    // Pointer down outside the element and its hit box
    document.dispatchEvent(
      new PointerEvent('pointerdown', {
        clientX: 50, // Outside element and default 10px hit box
        clientY: 50,
        bubbles: true,
      }),
    )

    expect(called).toBe(true)
    expect(receivedDetail).not.toBeNull()
    expect(receivedDetail.originalEvent).toBeInstanceOf(PointerEvent)

    document.body.removeChild(element)
    document.body.removeChild(outsideElement)
    cleanup()
  })

  it('does not fire when pressing inside', () => {
    let element = document.createElement('div')

    // Mock getBoundingClientRect for the target element
    Object.defineProperty(element, 'getBoundingClientRect', {
      value: () => ({ left: 100, top: 100, right: 200, bottom: 200 }),
    })

    document.body.appendChild(element)

    let called = false

    let cleanup = events(element, [
      outerPressDown(() => {
        called = true
      }),
    ])

    // Pointer down inside the element
    document.dispatchEvent(
      new PointerEvent('pointerdown', {
        clientX: 150, // Inside element
        clientY: 150,
        bubbles: true,
      }),
    )

    expect(called).toBe(false)

    document.body.removeChild(element)
    cleanup()
  })

  it('respects hit box', () => {
    let element = document.createElement('div')

    // Mock getBoundingClientRect for the target element
    Object.defineProperty(element, 'getBoundingClientRect', {
      value: () => ({ left: 100, top: 100, right: 200, bottom: 200 }),
    })

    document.body.appendChild(element)

    let called = false

    let cleanup = events(element, [
      outerPressDown(
        () => {
          called = true
        },
        { hit: 20 },
      ),
    ])

    // Test pointer down within hit box (should not fire)
    document.dispatchEvent(
      new PointerEvent('pointerdown', {
        clientX: 85, // 15px outside left edge, within 20px hit box
        clientY: 150,
        bubbles: true,
      }),
    )

    expect(called).toBe(false)

    // Test pointer down outside hit box (should fire)
    document.dispatchEvent(
      new PointerEvent('pointerdown', {
        clientX: 75, // 25px outside left edge, outside 20px hit box
        clientY: 150,
        bubbles: true,
      }),
    )

    expect(called).toBe(true)

    document.body.removeChild(element)
    cleanup()
  })
})

describe('outerPressUp', () => {
  it('fires when both down and up are outside', () => {
    let element = document.createElement('div')
    let outsideElement = document.createElement('div')

    // Mock getBoundingClientRect for the target element
    Object.defineProperty(element, 'getBoundingClientRect', {
      value: () => ({ left: 100, top: 100, right: 200, bottom: 200 }),
    })

    document.body.appendChild(element)
    document.body.appendChild(outsideElement)

    let called = false
    let receivedDetail: any = null

    let cleanup = events(element, [
      outerPressUp((event) => {
        called = true
        receivedDetail = event.detail
      }),
    ])

    // Pointer down and up outside the element and its hit box
    document.dispatchEvent(
      new PointerEvent('pointerdown', {
        clientX: 50, // Outside element and default 10px hit box
        clientY: 50,
        bubbles: true,
      }),
    )
    document.dispatchEvent(
      new PointerEvent('pointerup', {
        clientX: 50,
        clientY: 50,
        bubbles: true,
      }),
    )

    expect(called).toBe(true)
    expect(receivedDetail).not.toBeNull()
    expect(receivedDetail.originalEvent).toBeInstanceOf(PointerEvent)

    document.body.removeChild(element)
    document.body.removeChild(outsideElement)
    cleanup()
  })

  it('does not fire when only down is outside', () => {
    let element = document.createElement('div')

    // Mock getBoundingClientRect for the target element
    Object.defineProperty(element, 'getBoundingClientRect', {
      value: () => ({ left: 100, top: 100, right: 200, bottom: 200 }),
    })

    document.body.appendChild(element)

    let called = false

    let cleanup = events(element, [
      outerPressUp(() => {
        called = true
      }),
    ])

    // Pointer down outside, but up inside
    document.dispatchEvent(
      new PointerEvent('pointerdown', {
        clientX: 50, // Outside element and hit box
        clientY: 50,
        bubbles: true,
      }),
    )
    document.dispatchEvent(
      new PointerEvent('pointerup', {
        clientX: 150, // Inside element
        clientY: 150,
        bubbles: true,
      }),
    )

    expect(called).toBe(false)

    document.body.removeChild(element)
    cleanup()
  })

  it('does not fire when down is inside', () => {
    let element = document.createElement('div')

    // Mock getBoundingClientRect for the target element
    Object.defineProperty(element, 'getBoundingClientRect', {
      value: () => ({ left: 100, top: 100, right: 200, bottom: 200 }),
    })

    document.body.appendChild(element)

    let called = false

    let cleanup = events(element, [
      outerPressUp(() => {
        called = true
      }),
    ])

    // Pointer down inside, up outside
    document.dispatchEvent(
      new PointerEvent('pointerdown', {
        clientX: 150, // Inside element
        clientY: 150,
        bubbles: true,
      }),
    )
    document.dispatchEvent(
      new PointerEvent('pointerup', {
        clientX: 50, // Outside element and hit box
        clientY: 50,
        bubbles: true,
      }),
    )

    expect(called).toBe(false)

    document.body.removeChild(element)
    cleanup()
  })

  it('resets state properly', () => {
    let element = document.createElement('div')

    // Mock getBoundingClientRect for the target element
    Object.defineProperty(element, 'getBoundingClientRect', {
      value: () => ({ left: 100, top: 100, right: 200, bottom: 200 }),
    })

    document.body.appendChild(element)

    let callCount = 0

    let cleanup = events(element, [
      outerPressUp(() => {
        callCount++
      }),
    ])

    // First outer press sequence
    document.dispatchEvent(
      new PointerEvent('pointerdown', {
        clientX: 50, // Outside element and hit box
        clientY: 50,
        bubbles: true,
      }),
    )
    document.dispatchEvent(
      new PointerEvent('pointerup', {
        clientX: 50,
        clientY: 50,
        bubbles: true,
      }),
    )

    expect(callCount).toBe(1)

    // Second outer press sequence should work independently
    document.dispatchEvent(
      new PointerEvent('pointerdown', {
        clientX: 50, // Outside element and hit box
        clientY: 50,
        bubbles: true,
      }),
    )
    document.dispatchEvent(
      new PointerEvent('pointerup', {
        clientX: 50,
        clientY: 50,
        bubbles: true,
      }),
    )

    expect(callCount).toBe(2)

    document.body.removeChild(element)
    cleanup()
  })

  it('works with custom hit box and release box', () => {
    let element = document.createElement('div')

    // Mock getBoundingClientRect for the target element
    Object.defineProperty(element, 'getBoundingClientRect', {
      value: () => ({ left: 100, top: 100, right: 200, bottom: 200 }),
    })

    document.body.appendChild(element)

    let called = false

    let cleanup = events(element, [
      outerPressUp(
        () => {
          called = true
        },
        { hit: 10, release: 5 }, // release box = hit + release = 15px
      ),
    ])

    // Test pointer down outside hit box, up within release box (should fire)
    document.dispatchEvent(
      new PointerEvent('pointerdown', {
        clientX: 85, // 15px outside left edge, outside 10px hit box
        clientY: 150,
        bubbles: true,
      }),
    )
    document.dispatchEvent(
      new PointerEvent('pointerup', {
        clientX: 88, // 12px outside left edge, within 15px release box
        clientY: 150,
        bubbles: true,
      }),
    )

    expect(called).toBe(true)

    document.body.removeChild(element)
    cleanup()
  })

  it('works together with outerPressDown', () => {
    let element = document.createElement('div')

    // Mock getBoundingClientRect for the target element
    Object.defineProperty(element, 'getBoundingClientRect', {
      value: () => ({ left: 100, top: 100, right: 200, bottom: 200 }),
    })

    document.body.appendChild(element)

    let downCalled = false
    let upCalled = false

    let cleanup = events(element, [
      outerPressDown(() => {
        downCalled = true
      }),
      outerPressUp(() => {
        upCalled = true
      }),
    ])

    // Test complete outer press sequence
    document.dispatchEvent(
      new PointerEvent('pointerdown', {
        clientX: 50, // Outside element and hit box
        clientY: 50,
        bubbles: true,
      }),
    )

    expect(downCalled).toBe(true)
    expect(upCalled).toBe(false)

    document.dispatchEvent(
      new PointerEvent('pointerup', {
        clientX: 50,
        clientY: 50,
        bubbles: true,
      }),
    )

    expect(upCalled).toBe(true)

    document.body.removeChild(element)
    cleanup()
  })
})
