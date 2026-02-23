import { describe, expect, it } from 'vitest'
import { createDomNodePolicy, getDomHostInput } from './dom-node-policy.ts'

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'
const HTML_NAMESPACE = 'http://www.w3.org/1999/xhtml'

describe('dom node policy', () => {
  it('supports basic create/insert/move/remove operations', () => {
    let policy = createDomNodePolicy(document)
    let container = document.createElement('div')

    let alpha = policy.createElement(container, 'alpha')
    let beta = policy.createElement(container, 'beta')
    let text = policy.createText('x')

    policy.insert(container, alpha, null)
    policy.insert(container, beta, null)
    policy.insert(container, text, null)
    expect(container.innerHTML).toBe('<alpha></alpha><beta></beta>x')

    policy.move(container, beta, alpha)
    expect(container.innerHTML).toBe('<beta></beta><alpha></alpha>x')

    policy.remove(container, alpha)
    expect(container.innerHTML).toBe('<beta></beta>x')
  })

  it('creates svg nodes in the svg namespace', () => {
    let policy = createDomNodePolicy(document)
    let svg = document.createElementNS(SVG_NAMESPACE, 'svg')

    let circle = policy.createElement(svg, 'circle')
    policy.insert(svg, circle, null)

    expect(circle.namespaceURI).toBe(SVG_NAMESPACE)
    expect(circle.localName).toBe('circle')
  })

  it('uses html namespace under foreignObject', () => {
    let policy = createDomNodePolicy(document)
    let svg = document.createElementNS(SVG_NAMESPACE, 'svg')
    let foreignObject = document.createElementNS(SVG_NAMESPACE, 'foreignObject')
    policy.insert(svg, foreignObject, null)

    let div = policy.createElement(foreignObject, 'div')
    policy.insert(foreignObject, div, null)

    expect(div.namespaceURI).toBe(HTML_NAMESPACE)
    expect(div.localName).toBe('div')
  })

  it('updates text nodes through setText', () => {
    let policy = createDomNodePolicy(document)
    let text = policy.createText('hello')
    policy.setText(text, 'updated')
    expect(text.data).toBe('updated')
  })

  it('tracks latest host input metadata for created elements', () => {
    let policy = createDomNodePolicy(document)
    let container = document.createElement('div')

    policy.prepareHostMount?.(container, {
      type: 'item',
      key: 'same-key',
      props: {},
      children: [],
    })
    let first = policy.createElement(container, 'item')
    policy.insert(container, first, null)
    expect(getDomHostInput(first)?.key).toBe('same-key')
  })

  it('falls back to normal remove when parent does not match', () => {
    let policy = createDomNodePolicy(document)
    let firstParent = document.createElement('div')
    let secondParent = document.createElement('div')
    let node = policy.createElement(firstParent, 'item')
    policy.insert(firstParent, node, null)

    policy.remove(secondParent, node)
    expect(firstParent.firstChild).toBe(node)
  })

  it('resolves namespace inside a shadow root host', () => {
    let policy = createDomNodePolicy(document)
    let host = document.createElement('div')
    let shadow = host.attachShadow({ mode: 'open' })
    let node = policy.createElement(shadow, 'span')
    expect(node.namespaceURI).toBe(HTML_NAMESPACE)
  })

  it('resolves svg namespace for fragment-like parents with svg hosts', () => {
    let policy = createDomNodePolicy(document)
    let pseudoShadowRoot = {
      nodeType: Node.DOCUMENT_FRAGMENT_NODE,
      host: {
        namespaceURI: SVG_NAMESPACE,
        localName: 'svg',
      },
    } as unknown as ShadowRoot

    let node = policy.createElement(pseudoShadowRoot, 'circle')
    expect(node.namespaceURI).toBe(SVG_NAMESPACE)
  })
})
