import { describe, it, expect } from 'vitest'
import { createRoot } from '../vdom.ts'
import { invariant } from '../invariant.ts'
import { on } from './on-mixin.ts'
import { keys } from './keys-mixin.ts'

describe('keysEvents mixin', () => {
  it('dispatches keydown:Space events and prevents default', () => {
    let calls = 0
    let keydownResult = true
    let container = document.createElement('div')
    let root = createRoot(container)

    root.render(
      <div
        tabIndex={0}
        mix={[
          keys(),
          on(keys.space, () => {
            calls++
          }),
        ]}
      />,
    )
    root.flush()

    let div = container.querySelector('div')
    invariant(div)
    keydownResult = div.dispatchEvent(
      new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }),
    )
    root.flush()

    expect(calls).toBe(1)
    expect(keydownResult).toBe(false)
  })

  it('dispatches keydown:ArrowUp events', () => {
    let calls = 0
    let container = document.createElement('div')
    let root = createRoot(container)

    root.render(
      <div
        mix={[
          keys(),
          on(keys.arrowUp, () => {
            calls++
          }),
        ]}
      />,
    )
    root.flush()

    let div = container.querySelector('div')
    invariant(div)
    div.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }))
    root.flush()

    expect(calls).toBe(1)
  })
})
