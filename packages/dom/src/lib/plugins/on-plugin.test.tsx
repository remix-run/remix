import { createReconciler } from '@remix-run/reconciler'
import { describe, expect, it } from 'vitest'

import { createDomNodePolicy } from '../dom-node-policy.ts'
import { onPlugin } from './on-plugin.ts'

describe('onPlugin', () => {
  it('attaches and updates listeners from on prop', () => {
    let container = document.createElement('div')
    let root = createDomRoot(container)
    let events: string[] = []

    root.render(
      <button
        on={{
          click() {
            events.push('first')
          },
        }}
      >
        click
      </button>,
    )
    root.flush()

    let button = container.querySelector('button')
    if (!button) throw new Error('expected button')
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(events).toEqual(['first'])

    root.render(
      <button
        on={{
          click() {
            events.push('second')
          },
        }}
      >
        click
      </button>,
    )
    root.flush()

    button = container.querySelector('button')
    if (!button) throw new Error('expected button')
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(events).toEqual(['first', 'second'])
  })

  it('clears listeners when on prop is removed', () => {
    let container = document.createElement('div')
    let root = createDomRoot(container)
    let clicks = 0

    root.render(
      <button
        on={{
          click() {
            clicks++
          },
        }}
      >
        click
      </button>,
    )
    root.flush()

    let button = container.querySelector('button')
    if (!button) throw new Error('expected button')
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(clicks).toBe(1)

    root.render(<button>click</button>)
    root.flush()

    button = container.querySelector('button')
    if (!button) throw new Error('expected button')
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(clicks).toBe(1)
  })
})

function createDomRoot(container: HTMLElement) {
  let reconciler = createReconciler(createDomNodePolicy(document), [onPlugin])
  return reconciler.createRoot(container)
}
