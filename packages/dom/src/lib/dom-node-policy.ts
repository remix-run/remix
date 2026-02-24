import { createNodePolicy } from '@remix-run/reconciler'
import type { HostInput, NodePolicy, NodePolicyDefinition } from '@remix-run/reconciler'

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
export type DomNodePolicyDefinition = NodePolicyDefinition<
  DomParentNode,
  DomNode,
  DomTextNode,
  DomElementNode
>

type CursorScope = {
  parent: DomParentNode | DomElementNode
  endAnchor: null | Node
  cursor: null | Node
}

let hostInputByNode = new WeakMap<Node, HostInput>()

export function getDomHostInput(node: Node) {
  return hostInputByNode.get(node) ?? null
}

export function createDomNodePolicy(document: Document): DomNodePolicyDefinition {
  return createNodePolicy((reconciler) => {
    let pendingHostInput: null | HostInput = null
    let cursorScopes: CursorScope[] = []

    reconciler.addEventListener('enterChildren', (event) => {
      let enter = event as Event & {
        parent?: unknown
        startAnchor?: unknown
        endAnchor?: unknown
      }
      if (!(enter.parent instanceof Node)) return
      let parent = enter.parent as DomParentNode | DomElementNode
      let startAnchor = enter.startAnchor instanceof Node ? enter.startAnchor : null
      let endAnchor = enter.endAnchor instanceof Node ? enter.endAnchor : null
      let initial = startAnchor ? startAnchor.nextSibling : parent.firstChild
      cursorScopes.push({
        parent,
        endAnchor,
        cursor: skipCommentNodes(initial, endAnchor),
      })
    })

    reconciler.addEventListener('leaveChildren', (event) => {
      let leave = event as Event & { parent?: unknown }
      if (!(leave.parent instanceof Node)) return
      for (let index = cursorScopes.length - 1; index >= 0; index--) {
        if (cursorScopes[index]?.parent !== leave.parent) continue
        cursorScopes.splice(index, 1)
        return
      }
    })

    return {
      createText(parent, value) {
        let scope = getCursorScope(cursorScopes, parent)
        if (scope) {
          let candidate = scope.cursor
          if (candidate instanceof Text) {
            if (candidate.data !== value) {
              if (candidate.data.startsWith(value) && value.length < candidate.data.length) {
                let remainder = candidate.splitText(value.length)
                scope.cursor = skipCommentNodes(remainder, scope.endAnchor)
              } else {
                candidate.data = value
                scope.cursor = skipCommentNodes(candidate.nextSibling, scope.endAnchor)
              }
            } else {
              scope.cursor = skipCommentNodes(candidate.nextSibling, scope.endAnchor)
            }
            return candidate
          }
        }
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
        let scope = getCursorScope(cursorScopes, parent)
        if (scope && scope.cursor instanceof Element) {
          let candidate = scope.cursor
          let candidateNamespace = candidate.namespaceURI || HTML_NAMESPACE
          if (candidate.localName === type && candidateNamespace === namespace) {
            scope.cursor = skipCommentNodes(candidate.nextSibling, scope.endAnchor)
            if (mountInput) hostInputByNode.set(candidate, mountInput)
            return candidate
          }
        }
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
  })
}

function getCursorScope(scopes: CursorScope[], parent: DomParentNode | DomElementNode) {
  for (let index = scopes.length - 1; index >= 0; index--) {
    let scope = scopes[index]
    if (scope?.parent === parent) return scope
  }
  return null
}

function skipCommentNodes(cursor: null | Node, endAnchor: null | Node) {
  while (cursor && cursor !== endAnchor && cursor.nodeType === Node.COMMENT_NODE) {
    cursor = cursor.nextSibling
  }
  if (cursor === endAnchor) return null
  return cursor
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
