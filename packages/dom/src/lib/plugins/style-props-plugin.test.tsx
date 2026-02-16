import { createReconciler } from '@remix-run/reconciler'
import { describe, expect, it } from 'vitest'

import { createDomNodePolicy } from '../dom-node-policy.ts'
import { stylePropsPlugin } from './style-props-plugin.ts'

describe('stylePropsPlugin', () => {
  it('applies and removes inline style values', () => {
    let container = document.createElement('div')
    let root = createDomRoot(container)

    root.render(<div style={{ backgroundColor: 'red', fontSize: '12px' }} />)
    root.flush()

    let node = container.firstElementChild as HTMLElement
    expect(node.style.getPropertyValue('background-color')).toBe('red')
    expect(node.style.getPropertyValue('font-size')).toBe('12px')

    root.render(<div style={{ backgroundColor: 'blue' }} />)
    root.flush()

    let nextNode = container.firstElementChild as HTMLElement
    expect(nextNode.style.getPropertyValue('background-color')).toBe('blue')
    expect(nextNode.style.getPropertyValue('font-size')).toBe('')
  })

  it('supports cssText style strings and resets when switching back to object styles', () => {
    let container = document.createElement('div')
    let root = createDomRoot(container)

    root.render(<div style="color: red; display: block;" />)
    root.flush()

    let node = container.firstElementChild as HTMLElement
    expect(node.style.getPropertyValue('color')).toBe('red')
    expect(node.style.getPropertyValue('display')).toBe('block')

    root.render(<div style={{ backgroundColor: 'green' }} />)
    root.flush()

    let nextNode = container.firstElementChild as HTMLElement
    expect(nextNode.style.getPropertyValue('color')).toBe('')
    expect(nextNode.style.getPropertyValue('display')).toBe('')
    expect(nextNode.style.getPropertyValue('background-color')).toBe('green')
  })
})

function createDomRoot(container: HTMLElement) {
  let reconciler = createReconciler(createDomNodePolicy(document), [stylePropsPlugin])
  return reconciler.createRoot(container)
}
