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
})
