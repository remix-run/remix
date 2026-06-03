import { Fragment } from './fragment.ts'
import { invariant } from './invariant.ts'
import { isEmptyChild, isPrimitiveChild, normalizeChildren } from './core/children.ts'
import type { RemixElement, RemixNode } from './jsx.ts'
import { isRemixElement, NON_RENDER_NODE, TEXT_NODE, type VNode } from './vnode.ts'

function flatMapChildrenToVNodes(node: RemixElement): VNode[] {
  let vnodes: VNode[] = []
  if ('children' in node.props) {
    flattenChildrenToVNodes(node.props.children, vnodes)
  }
  return vnodes
}

function flattenChildrenToVNodes(node: RemixNode, out: VNode[]): void {
  if (Array.isArray(node)) {
    for (let child of normalizeChildren(node)) {
      out.push(toVNode(child))
    }
  } else {
    out.push(toVNode(node))
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
