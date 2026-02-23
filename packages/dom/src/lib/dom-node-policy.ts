import type { HostInput, NodePolicy } from '@remix-run/reconciler'

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

let hostInputByNode = new WeakMap<Node, HostInput>()

export function getDomHostInput(node: Node) {
  return hostInputByNode.get(node) ?? null
}

export function createDomNodePolicy(document: Document): DomNodePolicy {
  let pendingHostInput: null | HostInput = null

  return {
    createText(value) {
      return document.createTextNode(value)
    },
    setText(node, value) {
      if (node.data !== value) node.data = value
    },
    prepareHostMount(_parent, input) {
      pendingHostInput = input
    },
    createElement(parent, type) {
      let mountInput = pendingHostInput
      pendingHostInput = null
      let namespace = resolveNamespace(parent)
      let created =
        namespace === HTML_NAMESPACE
          ? document.createElement(type)
          : document.createElementNS(namespace, type)
      if (mountInput) hostInputByNode.set(created, mountInput)
      return created
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
