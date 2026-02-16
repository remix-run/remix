import { createReconciler } from '@remix-run/reconciler'
import { describe, expect, it } from 'vitest'

import { createDomNodePolicy } from '../dom-node-policy.ts'
import { domPropertyOrAttributePlugin } from './dom-property-or-attribute-plugin.ts'

describe('domPropertyOrAttributePlugin', () => {
  it('uses property assignment for known properties', () => {
    let container = document.createElement('div')
    let root = createDomRoot(container)

    root.render(<input readOnly value="hello" />)
    root.flush()

    let input = container.firstElementChild as HTMLInputElement
    expect(input.readOnly).toBe(true)
    expect(input.value).toBe('hello')
  })

  it('falls back to attributes for exception keys and unknowns', () => {
    let container = document.createElement('div')
    let root = createDomRoot(container)

    root.render(<a href="/docs" role="button" unknownProp="x" />)
    root.flush()

    let anchor = container.firstElementChild as HTMLAnchorElement
    expect(anchor.getAttribute('href')).toBe('/docs')
    expect(anchor.getAttribute('role')).toBe('button')
    expect(anchor.getAttribute('unknownProp')).toBe('x')
  })

  it('removes attribute fallback values on nullish updates', () => {
    let container = document.createElement('div')
    let root = createDomRoot(container)

    root.render(<a href="/docs" unknownProp="x" />)
    root.flush()
    root.render(<a href={null} unknownProp={undefined} />)
    root.flush()

    let anchor = container.firstElementChild as HTMLAnchorElement
    expect(anchor.hasAttribute('href')).toBe(false)
    expect(anchor.hasAttribute('unknownProp')).toBe(false)
  })

  it('handles boolean attribute fallback and skips functions/objects', () => {
    let container = document.createElement('div')
    let root = createDomRoot(container)

    root.render(<div popover foo-bar={true} callback={() => {}} dataObj={{ a: 1 }} />)
    root.flush()

    let node = container.firstElementChild as HTMLDivElement
    expect(node.getAttribute('popover')).toBe('')
    expect(node.getAttribute('foo-bar')).toBe('')
    expect(node.hasAttribute('callback')).toBe(false)
    expect(node.hasAttribute('dataObj')).toBe(false)
  })

  it('resets property-assigned keys on removal', () => {
    let container = document.createElement('div')
    let root = createDomRoot(container)

    root.render(<input readOnly />)
    root.flush()
    root.render(<input />)
    root.flush()

    let input = container.firstElementChild as HTMLInputElement
    expect(input.readOnly).toBe(false)
  })
})

function createDomRoot(container: HTMLElement) {
  let reconciler = createReconciler(createDomNodePolicy(document), [domPropertyOrAttributePlugin])
  return reconciler.createRoot(container)
}
