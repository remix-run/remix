import { Fragment } from './component.ts'
import { Frame } from './component.ts'
import { invariant } from './invariant.ts'
import { isEmptyChild, isPrimitiveChild, isRemixNode, normalizeChildren } from './core/children.ts'
import type { RemixNode } from './jsx.ts'
import type { ElementFunction } from './element-function.ts'
import type { FrameProps } from './component.ts'
import { isMixinDescriptor } from './core/mix.ts'
import {
  isRemixElement,
  NON_RENDER_NODE,
  TEXT_NODE,
  type RuntimeElementProps,
  type RuntimeHostProps,
  type VNodeInput,
} from './vnode.ts'

function flatMapChildrenToVNodes(props: RuntimeHostProps): VNodeInput[] {
  let children = props.children
  if (children === undefined) return []
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
      let props = parseHostProps(node.props)
      return {
        kind: 'fragment',
        type: Fragment,
        key: node.key,
        _children: flatMapChildrenToVNodes(props),
      }
    }

    if (node.type === Frame) {
      invariant(isFrameProps(node.props), '<Frame /> requires a src prop')
      return { kind: 'frame', type: Frame, key: node.key, props: node.props }
    }

    if (typeof node.type === 'string') {
      let props = parseHostProps(node.props)
      // When innerHTML is set, ignore children
      let children = props.innerHTML != null ? [] : flatMapChildrenToVNodes(props)
      return {
        kind: 'host',
        type: node.type,
        key: node.key,
        props,
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

function parseHostProps(props: RuntimeElementProps): RuntimeHostProps {
  let children = props.children
  invariant(children === undefined || isRemixNode(children), 'Invalid host children')

  let innerHTML = props.innerHTML
  invariant(innerHTML === undefined || typeof innerHTML === 'string', 'Invalid innerHTML prop')

  let mix = props.mix
  invariant(mix === undefined || isRuntimeMixValue(mix), 'Invalid mix prop')
  return props
}

function isRuntimeMixValue(value: unknown): value is RuntimeHostProps['mix'] {
  if (!Array.isArray(value)) return isMixinDescriptor(value)
  for (let descriptor of value) {
    if (!isMixinDescriptor(descriptor)) return false
  }
  return true
}

function isElementFunction(value: unknown): value is ElementFunction {
  return typeof value === 'function'
}
