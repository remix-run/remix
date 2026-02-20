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

export let DOM_RECLAIM_ON_REMOVE = Symbol.for('@remix-run/dom/reclaim-on-remove')

let hostInputByNode = new WeakMap<Node, HostInput>()
let reclaimOnRemoveByNode = new WeakMap<Element, boolean>()

export function markDomNodeForReclaim(node: Element, reclaimOnRemove: boolean) {
  reclaimOnRemoveByNode.set(node, reclaimOnRemove)
}

export function getDomHostInput(node: Node) {
  return hostInputByNode.get(node) ?? null
}

export function createDomNodePolicy(document: Document): DomNodePolicy {
  let pendingHostInput: null | HostInput = null
  let reclaimPoolByParent = new WeakMap<Node, Map<string, Map<unknown, Element[]>>>()

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
      if (mountInput?.key != null && mountInput.type === type) {
        let reclaimed = reclaimNode(reclaimPoolByParent, parent, type, mountInput.key)
        if (reclaimed) {
          hostInputByNode.set(reclaimed, mountInput)
          return reclaimed
        }
      }
      let namespace = resolveNamespace(parent)
      let created =
        namespace === HTML_NAMESPACE ? document.createElement(type) : document.createElementNS(namespace, type)
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
      if (node instanceof Element && shouldRetainNode(node)) {
        let input = hostInputByNode.get(node)
        if (input?.key != null) {
          parent.removeChild(node)
          retainNode(reclaimPoolByParent, parent, input.type, input.key, node)
          return
        }
      }
      node.parentNode?.removeChild(node)
    },
  }
}

function shouldRetainNode(node: Element) {
  return reclaimOnRemoveByNode.get(node) === true
}

function retainNode(
  reclaimPoolByParent: WeakMap<Node, Map<string, Map<unknown, Element[]>>>,
  parent: Node,
  type: string,
  key: unknown,
  node: Element,
) {
  let byType = reclaimPoolByParent.get(parent)
  if (!byType) {
    byType = new Map()
    reclaimPoolByParent.set(parent, byType)
  }
  let byKey = byType.get(type)
  if (!byKey) {
    byKey = new Map()
    byType.set(type, byKey)
  }
  let bucket = byKey.get(key)
  if (!bucket) {
    bucket = []
    byKey.set(key, bucket)
  }
  bucket.push(node)
}

function reclaimNode(
  reclaimPoolByParent: WeakMap<Node, Map<string, Map<unknown, Element[]>>>,
  parent: Node,
  type: string,
  key: unknown,
) {
  let byType = reclaimPoolByParent.get(parent)
  let byKey = byType?.get(type)
  let bucket = byKey?.get(key)
  if (!bucket || bucket.length === 0) return null
  let reclaimed = bucket.pop() ?? null
  if (bucket.length === 0) byKey?.delete(key)
  if (byKey && byKey.size === 0) byType?.delete(type)
  if (byType && byType.size === 0) reclaimPoolByParent.delete(parent)
  return reclaimed
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
