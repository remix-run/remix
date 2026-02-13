import { describe, expect, it } from 'vitest'

import { createReconciler } from '../index.ts'
import { styleProps } from './style-props.ts'

describe('plugin-spike style-props plugin', () => {
  it('diffs style object via element.style', () => {
    let reconciler = createReconciler([styleProps])
    let container = document.createElement('div')
    let root = reconciler.createRoot(container)

    root.render(() => (
      <div
        key="a"
        style={{
          color: 'rgb(255, 0, 0)',
          backgroundColor: 'rgb(0, 0, 0)',
        }}
      />
    ))
    root.flush()

    let node = container.querySelector('div')
    if (!(node instanceof HTMLElement)) throw new Error('expected div')
    expect(node.style.color).toBe('rgb(255, 0, 0)')
    expect(node.style.backgroundColor).toBe('rgb(0, 0, 0)')

    root.render(() => (
      <div
        key="a"
        style={{
          color: 'rgb(0, 0, 255)',
        }}
      />
    ))
    root.flush()
    expect(node.style.color).toBe('rgb(0, 0, 255)')
    expect(node.style.backgroundColor).toBe('')
  })
})
