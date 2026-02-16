import { createReconciler } from '@remix-run/reconciler'
import { describe, expect, it } from 'vitest'

import { createDomNodePolicy } from '../dom-node-policy.ts'
import { ariaDataAttributePlugin } from './aria-data-attribute-plugin.ts'

describe('ariaDataAttributePlugin', () => {
  it('sets and removes aria/data attributes', () => {
    let container = document.createElement('div')
    let root = createDomRoot(container)

    root.render(<div aria-label="Dialog" data-id="x1" />)
    root.flush()

    let node = container.firstElementChild
    expect(node?.getAttribute('aria-label')).toBe('Dialog')
    expect(node?.getAttribute('data-id')).toBe('x1')

    root.render(<div aria-label={null} data-id={null} />)
    root.flush()

    let nextNode = container.firstElementChild
    expect(nextNode?.hasAttribute('aria-label')).toBe(false)
    expect(nextNode?.hasAttribute('data-id')).toBe(false)
  })

  it('serializes false as a string for aria/data values', () => {
    let container = document.createElement('div')
    let root = createDomRoot(container)

    root.render(<div aria-hidden={false} data-open={false} />)
    root.flush()

    let node = container.firstElementChild
    expect(node?.getAttribute('aria-hidden')).toBe('false')
    expect(node?.getAttribute('data-open')).toBe('false')
  })
})

function createDomRoot(container: HTMLElement) {
  let reconciler = createReconciler(createDomNodePolicy(document), [ariaDataAttributePlugin])
  return reconciler.createRoot(container)
}
