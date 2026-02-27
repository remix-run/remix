import { describe, it, expect, vi } from 'vitest'
import { createRoot } from '../vdom.ts'
import { invariant } from '../invariant.ts'
import { on } from './on-mixin.tsx'
import { pressEvents } from './press-mixin.tsx'

describe('press mixin', () => {
  it('dispatches down, up, and press for Enter key', () => {
    let events: string[] = []
    let container = document.createElement('div')
    let root = createRoot(container)

    root.render(
      <button
        mix={[
          pressEvents(),
          on(pressEvents.down, () => {
            events.push('down')
          }),
          on(pressEvents.up, () => {
            events.push('up')
          }),
          on(pressEvents.press, () => {
            events.push('press')
          }),
        ]}
      >
        Press me
      </button>,
    )
    root.flush()

    let button = container.querySelector('button')
    invariant(button)
    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    button.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }))
    root.flush()

    expect(events).toEqual(['down', 'up', 'press'])
  })

  it('suppresses up and press when long press is prevented', () => {
    vi.useFakeTimers()
    try {
      let events: string[] = []
      let container = document.createElement('div')
      let root = createRoot(container)

      root.render(
        <button
          mix={[
            pressEvents(),
            on(pressEvents.long, (event) => {
              events.push('long')
              event.preventDefault()
            }),
            on(pressEvents.up, () => {
              events.push('up')
            }),
            on(pressEvents.press, () => {
              events.push('press')
            }),
          ]}
        >
          Hold me
        </button>,
      )
      root.flush()

      let button = container.querySelector('button')
      invariant(button)
      button.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
      vi.advanceTimersByTime(501)
      button.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true }))
      root.flush()

      expect(events).toEqual(['long'])
    } finally {
      vi.useRealTimers()
    }
  })

  it('dispatches cancel when pointer ends outside target', () => {
    let events: string[] = []
    let container = document.createElement('div')
    let root = createRoot(container)

    root.render(
      <button
        mix={[
          pressEvents(),
          on(pressEvents.cancel, () => {
            events.push('cancel')
          }),
        ]}
      >
        Press me
      </button>,
    )
    root.flush()

    let button = container.querySelector('button')
    invariant(button)
    dispatchPointer(button, 'pointerdown', { isPrimary: true })
    dispatchPointer(button.ownerDocument, 'pointerup')
    root.flush()

    expect(events).toEqual(['cancel'])
  })
})

function dispatchPointer(
  target: EventTarget,
  type: 'pointerdown' | 'pointerup' | 'pointerleave',
  init: { clientX?: number; clientY?: number; isPrimary?: boolean } = {},
) {
  let event = new Event(type, { bubbles: true, cancelable: true }) as PointerEvent
  ;(event as { clientX: number }).clientX = init.clientX ?? 0
  ;(event as { clientY: number }).clientY = init.clientY ?? 0
  ;(event as { isPrimary: boolean }).isPrimary = init.isPrimary ?? true
  target.dispatchEvent(event)
}
