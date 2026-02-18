import type { NodePolicy } from '@remix-run/reconciler'

export type DomParentNode = Node & ParentNode
export type DomNode = Node
export type DomTextNode = Text
export type DomElementNode = Element
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'
const HTML_NAMESPACE = 'http://www.w3.org/1999/xhtml'

export type DomTraversal = {
  next: null | Node
}

export type DomNodePolicy = NodePolicy<DomParentNode, DomNode, DomTextNode, DomElementNode>

export function createDomNodePolicy(document: Document): DomNodePolicy {
  return {
    createText(value) {
      return document.createTextNode(value)
    },
    setText(node, value) {
      if (node.data !== value) node.data = value
    },
    createElement(parent, type) {
      let namespace = resolveNamespace(parent)
      if (namespace === HTML_NAMESPACE) return document.createElement(type)
      return document.createElementNS(namespace, type)
    },
    getType(node) {
      return node.localName
    },
    getParent(node) {
      return node.parentNode as null | DomParentNode
    },
    firstChild(parent) {
      return parent.firstChild
    },
    nextSibling(node) {
      return node.nextSibling
    },
    insert(parent, node, anchor) {
      parent.insertBefore(node, anchor)
    },
    move(parent, node, anchor) {
      parent.insertBefore(node, anchor)
    },
    remove(parent, node) {
      if (node.parentNode !== parent) return
      node.parentNode?.removeChild(node)
    },
  }
}

function resolveNamespace(parent: DomParentNode) {
  if (parent.nodeType === Node.ELEMENT_NODE) {
    let element = parent as Element
    if (element.localName === 'foreignObject') return HTML_NAMESPACE
    if (element.namespaceURI === SVG_NAMESPACE && element.localName !== 'foreignObject') {
      return SVG_NAMESPACE
    }
    return element.namespaceURI || HTML_NAMESPACE
  }
  if (parent.nodeType === Node.DOCUMENT_FRAGMENT_NODE && 'host' in parent) {
    let host = (parent as ShadowRoot).host
    if (host.namespaceURI === SVG_NAMESPACE && host.localName !== 'foreignObject') {
      return SVG_NAMESPACE
    }
    return host.namespaceURI || HTML_NAMESPACE
  }
  return HTML_NAMESPACE
}
