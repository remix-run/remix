import { describe, expect, it } from 'vitest'

import { createReconciler } from '../index.ts'
import { ariaProps } from './aria-props.ts'

describe('plugin-spike aria-props plugin', () => {
  it('normalizes aria props and removes stale aria attributes', () => {
    let reconciler = createReconciler([ariaProps])
    let container = document.createElement('div')
    let root = reconciler.createRoot(container)

    root.render((handle) =>
      handle.host({
        type: 'div',
        key: 'a',
        props: {
          'aria-hidden': true,
          'aria-colindex': 3,
        },
        children: [],
      }),
    )
    root.flush()

    let node = container.querySelector('div')
    if (!node) throw new Error('expected div')
    expect(node.getAttribute('aria-hidden')).toBe('true')
    expect(node.getAttribute('aria-colindex')).toBe('3')

    root.render((handle) =>
      handle.host({
        type: 'div',
        key: 'a',
        props: {
          'aria-hidden': false,
        },
        children: [],
      }),
    )
    root.flush()
    expect(node.hasAttribute('aria-hidden')).toBe(false)
    expect(node.hasAttribute('aria-colindex')).toBe(false)
  })
})
