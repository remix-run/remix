import { describe, expect, it } from 'vitest'
import { createDomNodePolicy } from './dom-node-policy.ts'

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'
const HTML_NAMESPACE = 'http://www.w3.org/1999/xhtml'

describe('dom node policy', () => {
  it('supports basic create/insert/move/remove operations', () => {
    let policy = createDomNodePolicy(document)
    let container = document.createElement('div')

    let alpha = policy.resolveElement(container, null, 'alpha').node
    let beta = policy.resolveElement(container, null, 'beta').node
    let text = policy.resolveText(container, null, 'x').node

    policy.insert(container, alpha, null)
    policy.insert(container, beta, null)
    policy.insert(container, text, null)
    expect(container.innerHTML).toBe('<alpha></alpha><beta></beta>x')

    policy.move(container, beta, alpha)
    expect(container.innerHTML).toBe('<beta></beta><alpha></alpha>x')

    policy.remove(container, alpha)
    expect(container.innerHTML).toBe('<beta></beta>x')
  })

  it('resolves and reuses existing traversal nodes', () => {
    let policy = createDomNodePolicy(document)
    let container = document.createElement('div')
    let text = document.createTextNode('hello')
    let node = document.createElement('section')
    container.append(text, node)

    let start = policy.begin(container)
    let resolvedText = policy.resolveText(container, start, 'updated')
    expect(resolvedText.node).toBe(text)
    expect(resolvedText.node.data).toBe('updated')

    let resolvedElement = policy.resolveElement(container, resolvedText.next, 'section')
    expect(resolvedElement.node).toBe(node)
    expect(resolvedElement.next).toBeNull()
  })

  it('creates fresh nodes when traversal does not match', () => {
    let policy = createDomNodePolicy(document)
    let container = document.createElement('div')
    let existing = document.createElement('div')
    container.append(existing)

    let resolvedText = policy.resolveText(container, existing, 'next')
    expect(resolvedText.node).not.toBe(existing)
    expect(resolvedText.node.nodeType).toBe(Node.TEXT_NODE)
    expect(resolvedText.next).toBe(existing)

    let resolvedElement = policy.resolveElement(container, existing, 'span')
    expect(resolvedElement.node).not.toBe(existing)
    expect(resolvedElement.node.localName).toBe('span')
    expect(resolvedElement.next).toBe(existing)
  })

  it('creates nodes from document parents', () => {
    let documentParent = document.implementation.createHTMLDocument('x')
    let policy = createDomNodePolicy(documentParent)
    let container = documentParent.body

    let text = policy.resolveText(documentParent, null, 'hello').node
    let node = policy.resolveElement(documentParent, null, 'article').node
    policy.insert(container, text, null)
    policy.insert(container, node, null)

    expect(container.firstChild).toBe(text)
    expect(text.nextSibling).toBe(node)
    expect(node.ownerDocument).toBe(documentParent)
  })

  it('creates svg nodes in the svg namespace', () => {
    let policy = createDomNodePolicy(document)
    let svg = document.createElementNS(SVG_NAMESPACE, 'svg')

    let circle = policy.resolveElement(svg, null, 'circle').node
    policy.insert(svg, circle, null)

    expect(circle.namespaceURI).toBe(SVG_NAMESPACE)
    expect(circle.localName).toBe('circle')
  })

  it('uses html namespace under foreignObject', () => {
    let policy = createDomNodePolicy(document)
    let svg = document.createElementNS(SVG_NAMESPACE, 'svg')
    let foreignObject = document.createElementNS(SVG_NAMESPACE, 'foreignObject')
    policy.insert(svg, foreignObject, null)

    let div = policy.resolveElement(foreignObject, null, 'div').node
    policy.insert(foreignObject, div, null)

    expect(div.namespaceURI).toBe(HTML_NAMESPACE)
    expect(div.localName).toBe('div')
  })

  it('does not reuse element traversal when namespace mismatches', () => {
    let policy = createDomNodePolicy(document)
    let svg = document.createElementNS(SVG_NAMESPACE, 'svg')
    let existingHtmlDiv = document.createElement('div')

    let resolved = policy.resolveElement(svg, existingHtmlDiv, 'div')
    expect(resolved.node).not.toBe(existingHtmlDiv)
    expect(resolved.node.namespaceURI).toBe(SVG_NAMESPACE)
    expect(resolved.next).toBe(existingHtmlDiv)
  })
})
