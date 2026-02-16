import { Fragment } from './component.ts'
import { invariant } from './invariant.ts'
import type { RemixElement, RemixNode } from './jsx.ts'
import { isRemixElement, TEXT_NODE, type VNode } from './vnode.ts'

function flatMapChildrenToVNodes(node: RemixElement): VNode[] {
  return 'children' in node.props
    ? Array.isArray(node.props.children)
      ? node.props.children.flat(Infinity).map(toVNode)
      : [toVNode(node.props.children)]
    : []
}

function flattenRemixNodeArray(nodes: RemixNode[], out: RemixNode[] = []): RemixNode[] {
  for (let child of nodes) {
    if (Array.isArray(child)) {
      flattenRemixNodeArray(child, out)
    } else {
      out.push(child)
    }
  }
  return out
}

export function toVNode(node: RemixNode): VNode {
  if (node === null || node === undefined || typeof node === 'boolean') {
    return { type: TEXT_NODE, _text: '' }
  }

  if (typeof node === 'string' || typeof node === 'number' || typeof node === 'bigint') {
    return { type: TEXT_NODE, _text: String(node) }
  }

  if (Array.isArray(node)) {
    let flatChildren = flattenRemixNodeArray(node)
    return { type: Fragment, _children: flatChildren.map(toVNode) }
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
