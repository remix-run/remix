import { Frame } from './component.ts'
import type { VNode } from './vnode.ts'
import {
  isCommittedComponentNode,
  isCommittedHostNode,
  isCommittedTextNode,
  isFragmentNode,
} from './vnode.ts'

let activeSchedulerUpdateParents: ParentNode[] | undefined

export function setActiveSchedulerUpdateParents(parents: ParentNode[] | undefined): void {
  activeSchedulerUpdateParents = parents
}

export function shouldDispatchInlineMixinLifecycle(node: Node): boolean {
  let parents = activeSchedulerUpdateParents
  if (!parents?.length) return true
  for (let parent of parents) {
    let parentNode = parent as Node
    if (parentNode === node) return false
    if (parentNode.contains(node)) return false
  }
  return true
}

export function findFirstDomAnchor(node: VNode | null | undefined): Node | null {
  if (!node) return null
  if (node._range?.first) return node._range.first
  if (isCommittedTextNode(node)) return node._dom
  if (isCommittedHostNode(node)) return node._dom
  if (isCommittedComponentNode(node)) return findFirstDomAnchor(node._content)
  if (node.type === Frame) return node._rangeStart ?? null
  if (isFragmentNode(node)) {
    for (let child of node._children) {
      let dom = findFirstDomAnchor(child)
      if (dom) return dom
    }
  }
  return null
}

export function findLastDomAnchor(node: VNode | null | undefined): Node | null {
  if (!node) return null
  if (node._range?.last) return node._range.last
  if (isCommittedTextNode(node)) return node._dom
  if (isCommittedHostNode(node)) return node._dom
  if (isCommittedComponentNode(node)) return findLastDomAnchor(node._content)
  if (node.type === Frame) return node._rangeEnd ?? null
  if (isFragmentNode(node)) {
    for (let i = node._children.length - 1; i >= 0; i--) {
      let dom = findLastDomAnchor(node._children[i])
      if (dom) return dom
    }
  }
  return null
}

export function findNextSiblingDomAnchor(curr: VNode, vParent?: VNode): Node | null {
  if (!vParent || !Array.isArray(vParent._children)) return null
  let children = vParent._children
  let idx = children.indexOf(curr)
  if (idx === -1) return null
  for (let i = idx + 1; i < children.length; i++) {
    let dom = findFirstDomAnchor(children[i])
    if (dom) return dom
  }
  return null
}

export function domRangeContainsNode(first: Node, last: Node, node: Node): boolean {
  let current: Node | null = first
  while (current) {
    if (current === node) return true
    if (current === last) break
    current = current.nextSibling
  }
  return false
}

export function moveDomRange(
  domParent: ParentNode,
  first: Node,
  last: Node,
  before: Node | null,
): void {
  let current: Node | null = first
  while (current) {
    let next: Node | null = current === last ? null : current.nextSibling
    domParent.insertBefore(current, before)
    if (current === last) break
    current = next
  }
}
