import { describe, expect, it } from 'vitest'

import { createReconciler } from '../index.ts'
import { attributeProps } from './attribute-props.ts'

describe('plugin-spike attribute-props plugin', () => {
  it('applies remaining props as attributes and removes stale ones', () => {
    let reconciler = createReconciler([attributeProps])
    let container = document.createElement('div')
    let root = reconciler.createRoot(container)

    root.render(() => (
      <div
        key="a"
        title="first"
        hidden={true}
        data-id="1"
        {...({ objectValue: { ignored: true } } as Record<string, unknown>)}
      />
    ))
    root.flush()

    let node = container.querySelector('div')
    if (!node) throw new Error('expected div')
    expect(node.getAttribute('title')).toBe('first')
    expect(node.hasAttribute('hidden')).toBe(true)
    expect(node.getAttribute('data-id')).toBe('1')
    expect(node.hasAttribute('objectValue')).toBe(false)

    root.render(() => <div key="a" />)
    root.flush()
    expect(node.hasAttribute('title')).toBe(false)
    expect(node.hasAttribute('hidden')).toBe(false)
    expect(node.hasAttribute('data-id')).toBe(false)
  })
})
