import type { EventsContainer } from '@remix-run/interaction'
import type { ComponentHandle, Component } from './component.ts'
import { Fragment, Frame } from './component.ts'
import type { ElementProps, RemixElement, RemixNode } from './jsx.ts'

export const TEXT_NODE = Symbol('TEXT_NODE')
export const ROOT_VNODE = Symbol('ROOT_VNODE')

export type VNodeType =
  | typeof ROOT_VNODE
  | string // host element
  | Function // component
  | typeof TEXT_NODE
  | typeof Fragment
  | typeof Frame

export type VNode<T extends VNodeType = VNodeType> = {
  type: T
  props?: ElementProps
  key?: string

  // _prefixes assigned during reconciliation
  _parent?: VNode
  _children?: VNode[]
  _dom?: unknown
  _events?: EventsContainer<EventTarget>
  _controller?: AbortController
  _svg?: boolean
  // Range roots render between comment boundary markers
  _rangeStart?: Node
  _rangeEnd?: Node
  _pendingHydrationComponentId?: string
  _frameInstance?: unknown
  _frameFallbackRoot?: { render: (element: RemixNode) => void; dispose: () => void }
  _frameResolveToken?: number
  _frameResolveController?: AbortController
  _frameResolved?: boolean

  // Internal diffing fields
  _index?: number
  _flags?: number

  // TEXT_NODE
  _text?: string

  // Component
  _handle?: ComponentHandle
  _id?: string
  _content?: VNode

  // Presence animation
  _animation?: Animation
  _exiting?: boolean
  _exitingParent?: ParentNode
}

export type FragmentNode = VNode & {
  type: typeof Fragment
  _children: VNode[]
}

export type TextNode = VNode & {
  type: typeof TEXT_NODE
  _text: string
}

export type CommittedTextNode = TextNode & {
  _dom: Text
}

export type HostNode = VNode & {
  type: string
  props: ElementProps
  _children: VNode[]
}

export type CommittedHostNode = HostNode & {
  _dom: Element
  _controller?: AbortController
  _events?: EventsContainer<EventTarget>
}

export type ComponentNode = VNode & {
  type: Function
  props: ElementProps
  _handle: ComponentHandle
}

export type CommittedComponentNode = VNode & {
  type: Function
  props: ElementProps
  _content: VNode
  _handle: ComponentHandle
}

export function isFragmentNode(node: VNode): node is FragmentNode {
  return node.type === Fragment
}

export function isTextNode(node: VNode): node is TextNode {
  return node.type === TEXT_NODE
}

export function isCommittedTextNode(node: VNode): node is CommittedTextNode {
  return isTextNode(node) && node._dom instanceof Text
}

export function isHostNode(node: VNode): node is HostNode {
  return typeof node.type === 'string'
}

export function isCommittedHostNode(node: VNode): node is CommittedHostNode {
  return isHostNode(node) && node._dom instanceof Element
}

export function isComponentNode(node: VNode): node is ComponentNode {
  return typeof node.type === 'function' && node.type !== Frame
}

export function isCommittedComponentNode(node: VNode): node is CommittedComponentNode {
  return isComponentNode(node) && node._content !== undefined
}

export function isRemixElement(node: RemixNode): node is RemixElement {
  return typeof node === 'object' && node !== null && '$rmx' in node
}

export function findContextFromAncestry(node: VNode, type: Component): unknown {
  let current: VNode | undefined = node
  while (current) {
    if (current.type === type && isComponentNode(current)) {
      return current._handle.getContextValue()
    }
    current = current._parent
  }
  return undefined
}
