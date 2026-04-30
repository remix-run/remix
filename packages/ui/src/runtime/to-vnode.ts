import { Fragment } from './component.ts'
import { invariant } from './invariant.ts'
import type { RemixElement, RemixNode } from './jsx.ts'
import { isRemixElement, TEXT_NODE, type VNode } from './vnode.ts'

function flatMapChildrenToVNodes(node: RemixElement): VNode[] {
  if (!('children' in node.props)) return []
  let children = node.props.children
  if (!Array.isArray(children)) return [toVNode(children)]
  let vnodes: VNode[] = []
  flattenChildrenToVNodes(children, vnodes)
  return vnodes
}

function flattenChildrenToVNodes(nodes: RemixNode[], out: VNode[]): void {
  for (let child of nodes) {
    if (Array.isArray(child)) {
      flattenChildrenToVNodes(child, out)
    } else {
      out.push(toVNode(child))
    }
  }
}

export function toVNode(node: RemixNode): VNode {
  if (node === null || node === undefined || typeof node === 'boolean') {
    return { type: TEXT_NODE, _text: '' }
  }

  if (typeof node === 'string' || typeof node === 'number' || typeof node === 'bigint') {
    return { type: TEXT_NODE, _text: String(node) }
  }

  if (Array.isArray(node)) {
    let children: VNode[] = []
    flattenChildrenToVNodes(node, children)
    return { type: Fragment, _children: children }
  }

  if (node.type === Fragment) {
    return { type: Fragment, key: node.key, _children: flatMapChildrenToVNodes(node) }
  }

  if (isRemixElement(node)) {
    // When innerHTML is set, ignore children
    let children = node.props.innerHTML != null ? [] : flatMapChildrenToVNodes(node)
    return { type: node.type, key: node.key, props: node.props, _children: children }
  }

  invariant(false, 'Unexpected RemixNode')
}
