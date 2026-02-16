import { createReconciler } from '@remix-run/reconciler'
import { describe, expect, it } from 'vitest'

import { createDomNodePolicy } from '../dom-node-policy.ts'
import { attributeFallbackPlugin } from './attribute-fallback-plugin.ts'

describe('attributeFallbackPlugin', () => {
  it('sets primitive attributes left in props and removes absent ones', () => {
    let container = document.createElement('div')
    let root = createDomRoot(container)

    root.render(<div title="hello" hidden count={3} />)
    root.flush()

    let node = container.firstElementChild
    expect(node?.getAttribute('title')).toBe('hello')
    expect(node?.hasAttribute('hidden')).toBe(true)
    expect(node?.getAttribute('count')).toBe('3')

    root.render(<div title={null} hidden={false} count={undefined} />)
    root.flush()

    let nextNode = container.firstElementChild
    expect(nextNode?.hasAttribute('title')).toBe(false)
    expect(nextNode?.hasAttribute('hidden')).toBe(false)
    expect(nextNode?.hasAttribute('count')).toBe(false)
  })

  it('ignores object and function values', () => {
    let container = document.createElement('div')
    let root = createDomRoot(container)

    root.render(<div callback={() => {}} options={{ x: true }} title="ok" />)
    root.flush()

    let node = container.firstElementChild
    expect(node?.hasAttribute('callback')).toBe(false)
    expect(node?.hasAttribute('options')).toBe(false)
    expect(node?.getAttribute('title')).toBe('ok')
  })
})

function createDomRoot(container: HTMLElement) {
  let reconciler = createReconciler(createDomNodePolicy(document), [attributeFallbackPlugin])
  return reconciler.createRoot(container)
}
