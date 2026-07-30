import { Fragment } from './component.ts'
import { Frame } from './component.ts'
import { invariant } from './invariant.ts'
import { isEmptyChild, isPrimitiveChild, normalizeChildren } from './core/children.ts'
import type { RemixElement, RemixNode } from './jsx.ts'
import type { ElementFunction } from './element-function.ts'
import type { FrameProps } from './component.ts'
import {
  isRemixElement,
  NON_RENDER_NODE,
  TEXT_NODE,
  type RuntimeElementProps,
  type VNodeInput,
} from './vnode.ts'

function flatMapChildrenToVNodes(node: RemixElement): VNodeInput[] {
  if (!('children' in node.props)) return []
  let children = node.props.children
  if (!Array.isArray(children)) return [toVNode(children)]
  let vnodes: VNodeInput[] = []
  flattenChildrenToVNodes(children, vnodes)
  return vnodes
}

function flattenChildrenToVNodes(nodes: RemixNode[], out: VNodeInput[]): void {
  let children = normalizeChildren(nodes)
  for (let i = 0; i < children.length; i++) {
    out.push(toVNode(children[i]))
  }
}

export function toVNode(node: RemixNode): VNodeInput {
  if (isEmptyChild(node)) {
    return { kind: 'empty', type: NON_RENDER_NODE }
  }

  if (isPrimitiveChild(node)) {
    return { kind: 'text', type: TEXT_NODE, _text: String(node) }
  }

  if (isRemixElement(node)) {
    if (node.type === Fragment) {
      return {
        kind: 'fragment',
        type: Fragment,
        key: node.key,
        _children: flatMapChildrenToVNodes(node),
      }
    }

    if (node.type === Frame) {
      invariant(isFrameProps(node.props), '<Frame /> requires a src prop')
      return { kind: 'frame', type: Frame, key: node.key, props: node.props }
    }

    // When innerHTML is set, ignore children
    let children = node.props.innerHTML != null ? [] : flatMapChildrenToVNodes(node)
    if (typeof node.type === 'string') {
      return {
        kind: 'host',
        type: node.type,
        key: node.key,
        props: node.props,
        _children: children,
      }
    }
    invariant(isElementFunction(node.type), 'Expected component element type')
    return { kind: 'component', type: node.type, key: node.key, props: node.props }
  }

  if (Array.isArray(node)) {
    let children: VNodeInput[] = []
    flattenChildrenToVNodes(node, children)
    return { kind: 'fragment', type: Fragment, _children: children }
  }

  invariant(false, 'Unexpected RemixNode')
}

function isFrameProps(props: RuntimeElementProps): props is RuntimeElementProps & FrameProps {
  return typeof props.src === 'string' && props.src.length > 0
}

function isElementFunction(value: unknown): value is ElementFunction {
  return typeof value === 'function'
}
