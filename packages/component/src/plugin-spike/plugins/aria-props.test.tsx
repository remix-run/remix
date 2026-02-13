import { describe, expect, it } from 'vitest'

import { createReconciler } from '../index.ts'
import { ariaProps } from './aria-props.ts'

describe('plugin-spike aria-props plugin', () => {
  it('normalizes aria props and removes stale aria attributes', () => {
    let reconciler = createReconciler([ariaProps])
    let container = document.createElement('div')
    let root = reconciler.createRoot(container)

    root.render(() => (
      <div key="a" aria-hidden={true} aria-colindex={3} />
    ))
    root.flush()

    let node = container.querySelector('div')
    if (!node) throw new Error('expected div')
    expect(node.getAttribute('aria-hidden')).toBe('true')
    expect(node.getAttribute('aria-colindex')).toBe('3')

    root.render(() => <div key="a" aria-hidden={false} />)
    root.flush()
    expect(node.hasAttribute('aria-hidden')).toBe(false)
    expect(node.hasAttribute('aria-colindex')).toBe(false)
  })
})
