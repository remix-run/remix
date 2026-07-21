import { Fragment } from './component.ts'
import { invariant } from './invariant.ts'
import { isEmptyChild, isPrimitiveChild, normalizeChildren } from './core/children.ts'
import type { RemixElement, RemixNode } from './jsx.ts'
import { isRemixElement, NON_RENDER_NODE, TEXT_NODE, type VNode } from './vnode.ts'

function flatMapChildrenToVNodes(node: RemixElement): VNode[] {
  if (!('children' in node.props)) return []
  let children = node.props.children
  if (!Array.isArray(children)) return [toVNode(children)]
  let vnodes: VNode[] = []
  flattenChildrenToVNodes(children, vnodes)
  return vnodes
}

function flattenChildrenToVNodes(nodes: RemixNode[], out: VNode[]): void {
  let children = normalizeChildren(nodes)
  for (let i = 0; i < children.length; i++) {
    out.push(toVNode(children[i]))
  }
}

export function toVNode(node: RemixNode): VNode {
  if (isEmptyChild(node)) {
    return { type: NON_RENDER_NODE }
  }

  if (isPrimitiveChild(node)) {
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
