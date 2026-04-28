import { afterEach, describe, expect, it, vi } from 'vitest'

import { createRoot, on } from '@remix-run/ui'

import { onPointerDownClick, onPointerUpClick } from './pointer-click.ts'

function renderButton(node: JSX.Element) {
  let container = document.createElement('div')
  document.body.append(container)
  let root = createRoot(container)
  root.render(node)
  root.flush()

  return {
    button: container.querySelector('button') as HTMLButtonElement,
    root,
  }
}

function dispatchPointer(
  target: EventTarget,
  type: 'pointerdown' | 'pointerup',
  init: {
    button?: number
    isPrimary?: boolean
  } = {},
) {
  let event = new Event(type, { bubbles: true, cancelable: true }) as PointerEvent
  Object.defineProperties(event, {
    button: { configurable: true, value: init.button ?? 0 },
    isPrimary: { configurable: true, value: init.isPrimary ?? true },
  })
  target.dispatchEvent(event)
  return event
}

function dispatchClick(
  target: EventTarget,
  init: {
    button?: number
  } = {},
) {
  let event = new MouseEvent('click', {
    bubbles: true,
    button: init.button ?? 0,
    cancelable: true,
  })
  target.dispatchEvent(event)
  return event
}

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('onPointerUpClick', () => {
  it('handles pointerup and suppresses the immediate follow-up click', () => {
    let events: string[] = []
    let { button, root } = renderButton(
      <button
        type="button"
        mix={[
          onPointerUpClick((event) => {
            events.push(event.type)
          }),
          on('click', () => {
            events.push('click-listener')
          }),
        ]}
      >
        Press me
      </button>,
    )

    dispatchPointer(button, 'pointerup')
    let click = dispatchClick(button)
    root.flush()

    expect(events).toEqual(['pointerup'])
    expect(click.defaultPrevented).toBe(true)
  })

  it('handles click-only activation', () => {
    let events: string[] = []
    let { button, root } = renderButton(
      <button
        type="button"
        mix={onPointerUpClick((event) => {
          events.push(event.type)
        })}
      >
        Press me
      </button>,
    )

    dispatchClick(button)
    root.flush()

    expect(events).toEqual(['click'])
  })

  it('clears suppression if no click follows the pointerup', async () => {
    let events: string[] = []
    let { button, root } = renderButton(
      <button
        type="button"
        mix={onPointerUpClick((event) => {
          events.push(event.type)
        })}
      >
        Press me
      </button>,
    )

    dispatchPointer(button, 'pointerup')
    await Promise.resolve()
    dispatchClick(button)
    root.flush()

    expect(events).toEqual(['pointerup', 'click'])
  })
})

describe('onPointerDownClick', () => {
  it('handles pointerdown and suppresses the immediate follow-up click', () => {
    let events: string[] = []
    let { button, root } = renderButton(
      <button
        type="button"
        mix={[
          onPointerDownClick((event) => {
            events.push(event.type)
          }),
          on('click', () => {
            events.push('click-listener')
          }),
        ]}
      >
        Press me
      </button>,
    )

    dispatchPointer(button, 'pointerdown')
    let click = dispatchClick(button)
    root.flush()

    expect(events).toEqual(['pointerdown'])
    expect(click.defaultPrevented).toBe(true)
  })

  it('handles click-only activation', () => {
    let events: string[] = []
    let { button, root } = renderButton(
      <button
        type="button"
        mix={onPointerDownClick((event) => {
          events.push(event.type)
        })}
      >
        Press me
      </button>,
    )

    dispatchClick(button)
    root.flush()

    expect(events).toEqual(['click'])
  })

  it('clears suppression if no click follows the pointerdown', async () => {
    let events: string[] = []
    let { button, root } = renderButton(
      <button
        type="button"
        mix={onPointerDownClick((event) => {
          events.push(event.type)
        })}
      >
        Press me
      </button>,
    )

    dispatchPointer(button, 'pointerdown')
    await Promise.resolve()
    dispatchClick(button)
    root.flush()

    expect(events).toEqual(['pointerdown', 'click'])
  })
})
