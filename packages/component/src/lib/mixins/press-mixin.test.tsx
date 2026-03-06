import { describe, it, expect, vi } from 'vitest'
import { createRoot, on, pressEvents } from '../../index.ts'

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

    let button = container.querySelector('button') as HTMLButtonElement
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

      let button = container.querySelector('button') as HTMLButtonElement
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

    let button = container.querySelector('button') as HTMLButtonElement
    dispatchPointer(button, 'pointerdown', { isPrimary: true })
    dispatchPointer(button.ownerDocument, 'pointerup')
    root.flush()

    expect(events).toEqual(['cancel'])
  })

  it('dispatches down, up, and press for primary pointer interactions', () => {
    let events: string[] = []
    let points: Array<{ type: string; x: number; y: number }> = []
    let container = document.createElement('div')
    let root = createRoot(container)

    root.render(
      <button
        mix={[
          pressEvents(),
          on(pressEvents.down, (event) => {
            events.push('down')
            points.push({ type: 'down', x: event.clientX, y: event.clientY })
          }),
          on(pressEvents.up, (event) => {
            events.push('up')
            points.push({ type: 'up', x: event.clientX, y: event.clientY })
          }),
          on(pressEvents.press, (event) => {
            events.push('press')
            points.push({ type: 'press', x: event.clientX, y: event.clientY })
          }),
        ]}
      >
        Press me
      </button>,
    )
    root.flush()

    let button = container.querySelector('button') as HTMLButtonElement

    dispatchPointer(button, 'pointerdown', { clientX: 11, clientY: 22, isPrimary: true })
    dispatchPointer(button, 'pointerup', { clientX: 33, clientY: 44, isPrimary: true })
    root.flush()

    expect(events).toEqual(['down', 'up', 'press'])
    expect(points).toEqual([
      { type: 'down', x: 11, y: 22 },
      { type: 'up', x: 33, y: 44 },
      { type: 'press', x: 33, y: 44 },
    ])
  })

  it('ignores non-primary pointerdown events', () => {
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

    let button = container.querySelector('button') as HTMLButtonElement

    dispatchPointer(button, 'pointerdown', { isPrimary: false })
    dispatchPointer(button, 'pointerup', { isPrimary: false })
    root.flush()

    expect(events).toEqual([])
  })

  it('clears long-press timer on pointerleave while pressed', () => {
    let events: string[] = []
    let container = document.createElement('div')
    let root = createRoot(container)

    root.render(
      <button
        mix={[
          pressEvents(),
          on(pressEvents.long, () => {
            events.push('long')
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

    let button = container.querySelector('button') as HTMLButtonElement

    dispatchPointer(button, 'pointerdown')
    dispatchPointer(button, 'pointerleave')
    dispatchPointer(button, 'pointerup')
    root.flush()

    expect(events).toEqual(['up', 'press'])
  })

  it('suppresses pointer up/press after prevented long press', () => {
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
          Press me
        </button>,
      )
      root.flush()

      let button = container.querySelector('button') as HTMLButtonElement

      dispatchPointer(button, 'pointerdown')
      vi.advanceTimersByTime(501)
      dispatchPointer(button, 'pointerup')
      root.flush()

      expect(events).toEqual(['long'])
    } finally {
      vi.useRealTimers()
    }
  })

  it('dispatches cancel and suppresses up/press when Escape cancels keyboard press', () => {
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
          on(pressEvents.cancel, () => {
            events.push('cancel')
          }),
        ]}
      >
        Press me
      </button>,
    )
    root.flush()

    let button = container.querySelector('button') as HTMLButtonElement

    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    button.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }))
    root.flush()

    expect(events).toEqual(['down', 'cancel'])
  })

  it('ignores keyup when no keyboard press is active', () => {
    let events: string[] = []
    let container = document.createElement('div')
    let root = createRoot(container)

    root.render(
      <button
        mix={[
          pressEvents(),
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

    let button = container.querySelector('button') as HTMLButtonElement

    button.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }))
    root.flush()

    expect(events).toEqual([])
  })

  it('ignores duplicate keydown while a key press is already active', () => {
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

    let button = container.querySelector('button') as HTMLButtonElement

    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    button.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }))
    root.flush()

    expect(events).toEqual(['down', 'up', 'press'])
  })

  it('ignores document pointerup when no pointer press is active', () => {
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

    let button = container.querySelector('button') as HTMLButtonElement
    dispatchPointer(button.ownerDocument, 'pointerup')
    root.flush()

    expect(events).toEqual([])
  })

  it('cleans up listeners when root is removed', () => {
    let events: string[] = []
    let container = document.createElement('div')
    let root = createRoot(container)

    root.render(
      <button
        mix={[
          pressEvents(),
          on(pressEvents.press, () => {
            events.push('press')
          }),
          on(pressEvents.cancel, () => {
            events.push('cancel')
          }),
        ]}
      >
        Press me
      </button>,
    )
    root.flush()

    let button = container.querySelector('button') as HTMLButtonElement

    dispatchPointer(button, 'pointerdown')
    root.render(null)
    root.flush()

    dispatchPointer(button, 'pointerup')
    dispatchPointer(button.ownerDocument, 'pointerup')

    expect(events).toEqual([])
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
