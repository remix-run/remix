import { describe, expect, it, vi } from 'vitest'
import { createDomReconciler } from '../dom-reconciler.ts'
import { on } from './on-mixin.tsx'
import { pressEvents } from './press-mixin.tsx'

describe('press mixin', () => {
  it('dispatches synthetic press lifecycle events', () => {
    let downCount = 0
    let upCount = 0
    let pressCount = 0
    let pressX = 0
    let pressY = 0

    let reconciler = createDomReconciler(document)
    let container = document.createElement('div')
    let root = reconciler.createRoot(container)

    root.render(
      <button
        mix={[
          pressEvents(),
          on(pressEvents.down, () => {
            downCount++
          }),
          on(pressEvents.up, () => {
            upCount++
          }),
          on(pressEvents.press, (event: Event) => {
            let pressEvent = event as Event & { clientX: number; clientY: number }
            pressCount++
            pressX = pressEvent.clientX
            pressY = pressEvent.clientY
          }),
        ]}
      >
        Play
      </button>,
    )
    root.flush()

    let button = container.firstElementChild as HTMLButtonElement
    button.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, clientX: 10, clientY: 20, isPrimary: true }),
    )
    button.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 10, clientY: 20 }))

    expect(downCount).toBe(1)
    expect(upCount).toBe(1)
    expect(pressCount).toBe(1)
    expect(pressX).toBe(10)
    expect(pressY).toBe(20)
  })

  it('supports long press suppression via preventDefault', () => {
    vi.useFakeTimers()
    let longCount = 0
    let upCount = 0
    let pressCount = 0

    let reconciler = createDomReconciler(document)
    let container = document.createElement('div')
    let root = reconciler.createRoot(container)

    root.render(
      <button
        mix={[
          pressEvents(),
          on(pressEvents.long, (event) => {
            longCount++
            event.preventDefault()
          }),
          on(pressEvents.up, () => {
            upCount++
          }),
          on(pressEvents.press, () => {
            pressCount++
          }),
        ]}
      >
        Hold
      </button>,
    )
    root.flush()

    let button = container.firstElementChild as HTMLButtonElement
    button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, isPrimary: true }))
    vi.advanceTimersByTime(500)
    button.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))

    expect(longCount).toBe(1)
    expect(upCount).toBe(0)
    expect(pressCount).toBe(0)
    vi.useRealTimers()
  })

  it('ignores non-primary pointerdown and cancels pointer press on document pointerup', () => {
    let downCount = 0
    let upCount = 0
    let pressCount = 0
    let cancelCount = 0

    let reconciler = createDomReconciler(document)
    let container = document.createElement('div')
    let root = reconciler.createRoot(container)

    root.render(
      <button
        mix={[
          pressEvents(),
          on(pressEvents.down, () => {
            downCount++
          }),
          on(pressEvents.up, () => {
            upCount++
          }),
          on(pressEvents.press, () => {
            pressCount++
          }),
          on(pressEvents.cancel, () => {
            cancelCount++
          }),
        ]}
      >
        Pointer
      </button>,
    )
    root.flush()

    let button = container.firstElementChild as HTMLButtonElement
    button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, isPrimary: false }))
    button.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
    expect(downCount).toBe(0)
    expect(upCount).toBe(0)
    expect(pressCount).toBe(0)
    expect(cancelCount).toBe(0)

    button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, isPrimary: true }))
    document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
    expect(downCount).toBe(1)
    expect(cancelCount).toBe(1)
    expect(upCount).toBe(0)
    expect(pressCount).toBe(0)
  })

  it('handles keyboard guards and escape cancellation', () => {
    let downCount = 0
    let upCount = 0
    let pressCount = 0
    let cancelCount = 0

    let reconciler = createDomReconciler(document)
    let container = document.createElement('div')
    let root = reconciler.createRoot(container)

    root.render(
      <button
        mix={[
          pressEvents(),
          on(pressEvents.down, () => {
            downCount++
          }),
          on(pressEvents.up, () => {
            upCount++
          }),
          on(pressEvents.press, () => {
            pressCount++
          }),
          on(pressEvents.cancel, () => {
            cancelCount++
          }),
        ]}
      >
        Keyboard
      </button>,
    )
    root.flush()

    let button = container.firstElementChild as HTMLButtonElement

    button.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'a' }))
    button.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'a' }))
    button.dispatchEvent(
      new KeyboardEvent('keydown', { bubbles: true, key: 'Enter', repeat: true }),
    )
    expect(downCount).toBe(0)

    button.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }))
    button.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }))
    button.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }))
    button.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Enter' }))

    expect(downCount).toBe(1)
    expect(cancelCount).toBe(1)
    expect(upCount).toBe(0)
    expect(pressCount).toBe(0)

    button.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: ' ' }))
    button.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: ' ' }))
    expect(downCount).toBe(2)
    expect(upCount).toBe(1)
    expect(pressCount).toBe(1)
  })

  it('clears long timer on pointerleave and detaches listeners on remove', () => {
    vi.useFakeTimers()
    let longCount = 0
    let downCount = 0

    let reconciler = createDomReconciler(document)
    let container = document.createElement('div')
    let root = reconciler.createRoot(container)

    root.render(
      <button
        mix={[
          pressEvents(),
          on(pressEvents.down, () => {
            downCount++
          }),
          on(pressEvents.long, () => {
            longCount++
          }),
        ]}
      >
        Pointer Leave
      </button>,
    )
    root.flush()

    let button = container.firstElementChild as HTMLButtonElement
    button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, isPrimary: true }))
    button.dispatchEvent(new PointerEvent('pointerleave', { bubbles: true }))
    vi.advanceTimersByTime(500)
    expect(longCount).toBe(0)

    root.remove()
    button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, isPrimary: true }))
    expect(downCount).toBe(1)
    vi.useRealTimers()
  })

  it('ignores no-op events and non-HTMLElement hosts', () => {
    let cancelCount = 0
    let downCount = 0

    let reconciler = createDomReconciler(document)
    let container = document.createElement('div')
    let root = reconciler.createRoot(container)

    root.render(
      <div>
        <button
          id="button"
          mix={[
            pressEvents(),
            on(pressEvents.down, () => {
              downCount++
            }),
            on(pressEvents.cancel, () => {
              cancelCount++
            }),
          ]}
        >
          Guarded
        </button>
        <svg id="icon" mix={[pressEvents()]} />
      </div>,
    )
    root.flush()

    let button = container.querySelector('#button') as HTMLButtonElement
    let icon = container.querySelector('#icon') as SVGElement

    button.dispatchEvent(new PointerEvent('pointerleave', { bubbles: true }))
    button.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Enter' }))
    expect(downCount).toBe(0)
    expect(cancelCount).toBe(0)

    button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, isPrimary: true }))
    button.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }))
    expect(downCount).toBe(1)
    expect(cancelCount).toBe(1)

    icon.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, isPrimary: true }))
    icon.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }))
    expect(downCount).toBe(1)
    expect(cancelCount).toBe(1)
  })

  it('keeps listeners stable across rerenders and ignores duplicate pointerdown while active', () => {
    let downCount = 0

    let reconciler = createDomReconciler(document)
    let container = document.createElement('div')
    let root = reconciler.createRoot(container)

    root.render(
      <button
        mix={[
          pressEvents(),
          on(pressEvents.down, () => {
            downCount++
          }),
        ]}
      >
        Stable
      </button>,
    )
    root.flush()

    root.render(
      <button
        mix={[
          pressEvents(),
          on(pressEvents.down, () => {
            downCount++
          }),
        ]}
      >
        Stable
      </button>,
    )
    root.flush()

    let button = container.firstElementChild as HTMLButtonElement
    button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, isPrimary: true }))
    button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, isPrimary: true }))
    button.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
    expect(downCount).toBe(1)
  })
})
