import type { NodePolicy } from '@remix-run/reconciler'

export type DomParentNode = Node & ParentNode
export type DomNode = Node
export type DomTextNode = Text
export type DomElementNode = Element
export type DomTraversal = {
  namespace: string
  next: null | Node
}
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'
const HTML_NAMESPACE = 'http://www.w3.org/1999/xhtml'

export type DomNodePolicy = NodePolicy<
  DomParentNode,
  DomNode,
  DomTextNode,
  DomElementNode,
  DomTraversal
>

export function createDomNodePolicy(document: Document): DomNodePolicy {
  return {
    firstChild(parent) {
      return parent.firstChild
    },
    nextSibling(node) {
      return node.nextSibling
    },
    begin(parent) {
      return createTraversal(parent, parent.firstChild)
    },
    enter(parent) {
      return createTraversal(parent, parent.firstChild)
    },
    insert(parent, node, anchor) {
      parent.insertBefore(node, anchor)
    },
    move(parent, node, anchor) {
      parent.insertBefore(node, anchor)
    },
    remove(_parent, node) {
      node.parentNode?.removeChild(node)
    },
    resolveText(parent, traversal, value) {
      let candidate = traversal.next
      if (candidate && candidate.nodeType === Node.TEXT_NODE) {
        let node = candidate as Text
        if (node.data !== value) node.data = value
        return {
          node,
          next: createTraversal(parent, candidate.nextSibling),
        }
      }
      return {
        node: document.createTextNode(value),
        next: traversal,
      }
    },
    resolveElement(parent, traversal, type) {
      let candidate = traversal.next
      let namespace = traversal.namespace
      if (candidate && candidate.nodeType === Node.ELEMENT_NODE) {
        let node = candidate as Element
        if (node.localName === type && node.namespaceURI === namespace) {
          return {
            node,
            next: createTraversal(parent, candidate.nextSibling),
          }
        }
      }
      return {
        node: createElementForNamespace(document, namespace, type),
        next: traversal,
      }
    },
  }
}

function createTraversal(parent: DomParentNode, next: null | Node): DomTraversal {
  return {
    namespace: resolveNamespace(parent),
    next,
  }
}

function createElementForNamespace(document: Document, namespace: string, type: string) {
  if (namespace === HTML_NAMESPACE) return document.createElement(type)
  return document.createElementNS(namespace, type)
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
