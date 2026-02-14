import { describe, expect, it } from 'vitest'

import { createReconciler } from '../index.ts'
import { attributeProps } from './attribute-props.ts'
import { dragEndEvent, dragStartEvent, draggable } from './draggable.ts'
import { on } from './on.ts'
import { use } from './use.ts'

describe('plugin-spike draggable directive', () => {
  it('dispatches drag events and updates left/top', () => {
    let starts = 0
    let ends = 0

    let reconciler = createReconciler([use, attributeProps])
    let container = document.createElement('div')
    let root = reconciler.createRoot(container)

    root.render(() => (
      <div
        use={[
          draggable(),
          on(dragStartEvent, () => {
            starts++
          }),
          on(dragEndEvent, () => {
            ends++
          }),
        ]}
      >
        drag me
      </div>
    ))
    root.flush()

    let element = container.querySelector('div')
    if (!(element instanceof HTMLElement)) {
      throw new Error('expected div')
    }

    element.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        button: 0,
        pointerId: 1,
        clientX: 10,
        clientY: 10,
      }),
    )
    window.dispatchEvent(
      new PointerEvent('pointermove', {
        bubbles: true,
        pointerId: 1,
        clientX: 35,
        clientY: 45,
      }),
    )
    window.dispatchEvent(
      new PointerEvent('pointerup', {
        bubbles: true,
        pointerId: 1,
      }),
    )

    expect(starts).toBe(1)
    expect(ends).toBe(1)
    expect(element.style.left).toBe('25px')
    expect(element.style.top).toBe('35px')
  })
})
