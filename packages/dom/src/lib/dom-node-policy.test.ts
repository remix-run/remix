import { describe, expect, it } from 'vitest'
import { createDomNodePolicy, getDomHostInput } from './dom-node-policy.ts'

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'
const HTML_NAMESPACE = 'http://www.w3.org/1999/xhtml'

describe('dom node policy', () => {
  let createPolicy = () => createDomNodePolicy(document)(new EventTarget())

  it('returns null host input for unknown nodes', () => {
    let node = document.createElement('div')
    expect(getDomHostInput(node)).toBeNull()
  })

  it('supports basic create/insert/move/remove operations', () => {
    let policy = createPolicy()
    let container = document.createElement('div')

    let alpha = policy.createElement(container, 'alpha')
    let beta = policy.createElement(container, 'beta')
    let text = policy.createText(container, 'x')

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
    let policy = createPolicy()
    let svg = document.createElementNS(SVG_NAMESPACE, 'svg')

    let circle = policy.createElement(svg, 'circle')
    policy.insert(svg, circle, null)

    expect(circle.namespaceURI).toBe(SVG_NAMESPACE)
    expect(circle.localName).toBe('circle')
  })

  it('uses html namespace under foreignObject', () => {
    let policy = createPolicy()
    let svg = document.createElementNS(SVG_NAMESPACE, 'svg')
    let foreignObject = document.createElementNS(SVG_NAMESPACE, 'foreignObject')
    policy.insert(svg, foreignObject, null)

    let div = policy.createElement(foreignObject, 'div')
    policy.insert(foreignObject, div, null)

    expect(div.namespaceURI).toBe(HTML_NAMESPACE)
    expect(div.localName).toBe('div')
  })

  it('updates text nodes through setText', () => {
    let policy = createPolicy()
    let text = policy.createText(document.body, 'hello')
    policy.setText(text, 'updated')
    expect(text.data).toBe('updated')
  })

  it('provides getType/firstChild traversal helpers', () => {
    let policy = createPolicy()
    let container = document.createElement('div')
    let alpha = policy.createElement(container, 'alpha')
    let beta = policy.createElement(container, 'beta')
    policy.insert(container, alpha, null)
    policy.insert(container, beta, null)

    expect(policy.getType(alpha)).toBe('alpha')
    expect(policy.firstChild(container)).toBe(alpha)
    expect(policy.nextSibling(alpha)).toBe(beta)
    expect(policy.getParent(alpha)).toBe(container)
  })

  it('tracks latest host input metadata for created elements', () => {
    let policy = createPolicy()
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
    let policy = createPolicy()
    let firstParent = document.createElement('div')
    let secondParent = document.createElement('div')
    let node = policy.createElement(firstParent, 'item')
    policy.insert(firstParent, node, null)

    policy.remove(secondParent, node)
    expect(firstParent.firstChild).toBe(node)
  })

  it('hoists head-managed html elements to document head', () => {
    let policy = createPolicy()
    let container = document.createElement('div')
    document.body.appendChild(container)

    let title = policy.createElement(container, 'title')
    policy.insert(container, title, null)
    expect(document.head.contains(title)).toBe(true)
    expect(container.contains(title)).toBe(false)

    let meta = policy.createElement(container, 'meta')
    ;(meta as HTMLMetaElement).setAttribute('name', 'description')
    ;(meta as HTMLMetaElement).setAttribute('content', 'desc')
    policy.insert(container, meta, null)
    expect(document.head.contains(meta)).toBe(true)

    let ldJson = policy.createElement(container, 'script')
    ;(ldJson as HTMLScriptElement).setAttribute('type', 'application/ld+json')
    ldJson.textContent = '{"x":1}'
    policy.insert(container, ldJson, null)
    expect(document.head.contains(ldJson)).toBe(true)

    let regularScript = policy.createElement(container, 'script')
    ;(regularScript as HTMLScriptElement).setAttribute('type', 'text/javascript')
    regularScript.textContent = 'window.__notHoisted = true'
    policy.insert(container, regularScript, null)
    expect(container.contains(regularScript)).toBe(true)
    expect(document.head.contains(regularScript)).toBe(false)
  })

  it('removes hoisted head-managed elements when removed by original parent', () => {
    let policy = createPolicy()
    let container = document.createElement('div')
    document.body.appendChild(container)

    let title = policy.createElement(container, 'title')
    title.textContent = 'Policy title'
    policy.insert(container, title, null)
    expect(document.head.contains(title)).toBe(true)

    policy.remove(container, title)
    expect(document.head.contains(title)).toBe(false)
  })

  it('inserts directly into head when parent is already document head', () => {
    let policy = createPolicy()
    let title = policy.createElement(document.head, 'title')
    title.textContent = 'direct head insert'
    policy.insert(document.head, title, null)
    expect(document.head.contains(title)).toBe(true)
    policy.remove(document.head, title)
    expect(document.head.contains(title)).toBe(false)
  })

  it('resolves namespace inside a shadow root host', () => {
    let policy = createPolicy()
    let host = document.createElement('div')
    let shadow = host.attachShadow({ mode: 'open' })
    let node = policy.createElement(shadow, 'span')
    expect(node.namespaceURI).toBe(HTML_NAMESPACE)
  })

  it('resolves svg namespace for fragment-like parents with svg hosts', () => {
    let policy = createPolicy()
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

  it('falls back to html namespace for non-element/non-fragment parents', () => {
    let policy = createPolicy()
    let pseudoParent = {
      nodeType: Node.DOCUMENT_NODE,
      insertBefore: document.body.insertBefore.bind(document.body),
    } as unknown as Node & ParentNode
    let node = policy.createElement(pseudoParent, 'div')
    expect(node.namespaceURI).toBe(HTML_NAMESPACE)
  })

  it('reuses existing nodes when cursor scope points at a matching element', () => {
    let reconciler = new EventTarget()
    let policy = createDomNodePolicy(document)(reconciler)
    let container = document.createElement('div')
    let comment = document.createComment('skip')
    let existing = document.createElement('item')
    container.append(comment, existing)

    let enter = new Event('enterChildren') as Event & {
      parent?: unknown
      startAnchor?: unknown
      endAnchor?: unknown
    }
    enter.parent = container
    reconciler.dispatchEvent(enter)

    policy.prepareHostMount?.(container, {
      type: 'item',
      key: 'reused',
      props: {},
      children: [],
    })

    let created = policy.createElement(container, 'item')
    expect(created).toBe(existing)
    expect(getDomHostInput(existing)?.key).toBe('reused')
  })

  it('ignores enter/leave children events with non-node parents', () => {
    let reconciler = new EventTarget()
    let policy = createDomNodePolicy(document)(reconciler)
    let container = document.createElement('div')
    let enter = new Event('enterChildren') as Event & {
      parent?: unknown
      startAnchor?: unknown
      endAnchor?: unknown
    }
    enter.parent = 'not-a-node'
    let leave = new Event('leaveChildren') as Event & {
      parent?: unknown
    }
    leave.parent = 123

    reconciler.dispatchEvent(enter)
    reconciler.dispatchEvent(leave)

    let created = policy.createElement(container, 'alpha')
    expect(created.localName).toBe('alpha')
  })

  it('does not reuse cursor candidates when namespace differs', () => {
    let reconciler = new EventTarget()
    let policy = createDomNodePolicy(document)(reconciler)
    let container = document.createElement('div')
    let existingSvg = document.createElementNS(SVG_NAMESPACE, 'item')
    container.append(existingSvg)

    let enter = new Event('enterChildren') as Event & {
      parent?: unknown
      startAnchor?: unknown
      endAnchor?: unknown
    }
    enter.parent = container
    reconciler.dispatchEvent(enter)

    let created = policy.createElement(container, 'item')
    expect(created).not.toBe(existingSvg)
    expect(created.namespaceURI).toBe(HTML_NAMESPACE)
  })

  it('falls back to html namespace when element or shadow host namespace is empty', () => {
    let policy = createPolicy()
    let pseudoElementParent = {
      nodeType: Node.ELEMENT_NODE,
      localName: 'div',
      namespaceURI: '',
    } as unknown as Node & ParentNode
    let fromElementFallback = policy.createElement(pseudoElementParent, 'span')
    expect(fromElementFallback.namespaceURI).toBe(HTML_NAMESPACE)

    let pseudoShadowRoot = {
      nodeType: Node.DOCUMENT_FRAGMENT_NODE,
      host: {
        namespaceURI: '',
        localName: 'div',
      },
    } as unknown as ShadowRoot
    let fromShadowFallback = policy.createElement(pseudoShadowRoot, 'span')
    expect(fromShadowFallback.namespaceURI).toBe(HTML_NAMESPACE)
  })

  it('ignores leaveChildren events that do not match any tracked scope', () => {
    let reconciler = new EventTarget()
    createDomNodePolicy(document)(reconciler)
    let parentA = document.createElement('div')
    let parentB = document.createElement('div')

    let enter = new Event('enterChildren') as Event & {
      parent?: unknown
      startAnchor?: unknown
      endAnchor?: unknown
    }
    enter.parent = parentA
    reconciler.dispatchEvent(enter)

    let leave = new Event('leaveChildren') as Event & {
      parent?: unknown
    }
    leave.parent = parentB
    expect(() => reconciler.dispatchEvent(leave)).not.toThrow()
  })
})
