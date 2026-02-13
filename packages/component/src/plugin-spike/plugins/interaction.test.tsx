import { describe, expect, it } from 'vitest'

import { createReconciler, interactionPlugin } from '../index.ts'

describe('plugin-spike interaction plugin', () => {
  it('attaches and updates listeners from the on prop', () => {
    let events: string[] = []
    let mode: 'first' | 'second' = 'first'
    let reconciler = createReconciler([interactionPlugin])
    let container = document.createElement('div')
    let root = reconciler.createRoot(container)

    root.render(() => (
      <button
        key="button"
        on={
          mode === 'first'
            ? {
                click() {
                  events.push('first')
                },
              }
            : {
                click() {
                  events.push('second')
                },
              }
        }
        connect={() => {}}
      >
        click
      </button>
    ))
    root.flush()

    let element = container.querySelector('button')
    if (!element) throw new Error('expected button')
    expect(element.getAttribute('on')).toBe(null)
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(events).toEqual(['first'])

    mode = 'second'
    root.render(() => (
      <button
        key="button"
        on={{
          click() {
            events.push('second')
          },
        }}
        connect={() => {}}
      >
        click
      </button>
    ))
    root.flush()

    element = container.querySelector('button')
    if (!element) throw new Error('expected button')
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(events).toEqual(['first', 'second'])
  })
})
