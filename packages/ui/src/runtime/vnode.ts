import type { ComponentHandle, Fragment, Frame, FrameHandle, FrameProps } from './component.ts'
import { isRemixElement } from './core/vnode.ts'
import type { Frame as FrameInstance } from './frame.ts'
import type { RemixNode } from './jsx.ts'
import type { ElementFunction } from './element-function.ts'
import type { Key } from './key.ts'
import type { MixinRuntimeState } from './mixins/mixin.ts'
import type { OnMixinDescriptor } from './mixins/on-mixin.ts'
import type { Scheduler } from './scheduler.ts'
import type { StyleManager } from '../style/index.ts'

export { isRemixElement }

export const TEXT_NODE = Symbol('TEXT_NODE')
export const NON_RENDER_NODE = Symbol('NON_RENDER_NODE')
export const ROOT_VNODE = Symbol('ROOT_VNODE')

export type VNodeKind = 'root' | 'empty' | 'text' | 'fragment' | 'host' | 'component' | 'frame'

export type RuntimeElementProps = {
  children?: RemixNode
  innerHTML?: string
  mix?: unknown
  [name: string]: unknown
}

type InputNodeBase<kind extends VNodeKind, type> = {
  kind: kind
  type: type
  key?: Key
}

export type NonRenderNode = InputNodeBase<'empty', typeof NON_RENDER_NODE>

export type TextNode = InputNodeBase<'text', typeof TEXT_NODE> & {
  _text: string
}

export type FragmentNode = InputNodeBase<'fragment', typeof Fragment> & {
  _children: VNodeInput[]
}

export type HostNode = InputNodeBase<'host', string> & {
  props: RuntimeElementProps
  _children: VNodeInput[]
}

export type ComponentNode = InputNodeBase<'component', ElementFunction> & {
  props: RuntimeElementProps
}

export type FrameNode = InputNodeBase<'frame', typeof Frame> & {
  props: RuntimeElementProps & FrameProps
}

export type VNodeInput =
  | NonRenderNode
  | TextNode
  | FragmentNode
  | HostNode
  | ComponentNode
  | FrameNode

type MountedNodeBase = {
  _parent: VNodeParent
  _svg: boolean
}

export type CommittedNonRenderNode = NonRenderNode & MountedNodeBase

export type CommittedTextNode = TextNode &
  MountedNodeBase & {
    _dom: Text
  }

export type ControlledReflectionState = {
  disposed: boolean
  listenersAttached: boolean
  pendingRestoreVersion: number
  managesValue: boolean
  managesChecked: boolean
  hasControlledValue: boolean
  controlledValue: unknown
  hasControlledChecked: boolean
  controlledChecked: unknown
  onInput(): void
  onChange(): void
}

export type DirectEventBinding = {
  type: string
  handler: (event: Event, signal: AbortSignal) => void | Promise<void>
  capture: boolean
  stableHandler: ((event: Event) => void) | null
  reentry: AbortController | null
}

export type DirectEventState = {
  bindings: DirectEventBinding[]
}

export type HostPersistenceState = {
  parent: ParentNode
  token: number
}

export type CommittedHostNode = Omit<HostNode, '_children'> &
  MountedNodeBase & {
    _children: CommittedVNode[]
    _dom: Element
    _mixedProps: RuntimeElementProps
    _mixState?: MixinRuntimeState
    _directEventDescriptors?: OnMixinDescriptor[]
    _directEventState?: DirectEventState
    _controlledState?: ControlledReflectionState
    _persistence?: HostPersistenceState
  }

export type CommittedFragmentNode = Omit<FragmentNode, '_children'> &
  MountedNodeBase & {
    _children: CommittedVNode[]
  }

export type MountingComponentNode = ComponentNode &
  MountedNodeBase & {
    _handle: ComponentHandle
    _context: ReconcileContext
  }

export type CommittedComponentNode = MountingComponentNode & {
  _content: CommittedVNode
}

export interface FrameFallbackRoot {
  render(element: RemixNode): void
  dispose(): void
}

export type CommittedFrameNode = FrameNode &
  MountedNodeBase & {
    _rangeStart: Comment
    _rangeEnd: Comment
    _frameInstance: FrameInstance
    _frameFallbackRoot?: FrameFallbackRoot
    _frameResolveToken: number
    _frameResolveController?: AbortController
    _frameResolved: boolean
  }

export type CommittedVNode =
  | CommittedNonRenderNode
  | CommittedTextNode
  | CommittedFragmentNode
  | CommittedHostNode
  | CommittedComponentNode
  | CommittedFrameNode

export type RootVNode = {
  kind: 'root'
  type: typeof ROOT_VNODE
  _children: CommittedVNode[]
  _svg: boolean
  _rangeStart?: Node
  _rangeEnd?: Node
  _pendingHydrationComponentId?: string
}

export interface ReconcileContext {
  frame: FrameHandle
  scheduler: Scheduler
  styles: StyleManager
  rootTarget: EventTarget
}

export type VNodeParent =
  | RootVNode
  | CommittedFragmentNode
  | CommittedHostNode
  | MountingComponentNode
  | CommittedComponentNode

export type VNode = VNodeInput | CommittedVNode | RootVNode | MountingComponentNode

export function isFragmentNode(node: VNode): node is FragmentNode | CommittedFragmentNode {
  return node.kind === 'fragment'
}

export function isTextNode(node: VNode): node is TextNode | CommittedTextNode {
  return node.kind === 'text'
}

export function isNonRenderNode(node: VNode): node is NonRenderNode | CommittedNonRenderNode {
  return node.kind === 'empty'
}

export function isCommittedTextNode(node: VNode): node is CommittedTextNode {
  return node.kind === 'text' && '_dom' in node
}

export function isHostNode(node: VNode): node is HostNode | CommittedHostNode {
  return node.kind === 'host'
}

export function isCommittedHostNode(node: unknown): node is CommittedHostNode {
  return (
    typeof node === 'object' &&
    node !== null &&
    'kind' in node &&
    node.kind === 'host' &&
    '_dom' in node
  )
}

export function isComponentNode(
  node: VNode,
): node is ComponentNode | MountingComponentNode | CommittedComponentNode {
  return node.kind === 'component'
}

export function isCommittedComponentNode(node: VNode): node is CommittedComponentNode {
  return node.kind === 'component' && '_content' in node
}

export function isFrameNode(node: VNode): node is FrameNode | CommittedFrameNode {
  return node.kind === 'frame'
}

export function isCommittedFrameNode(node: VNode): node is CommittedFrameNode {
  return node.kind === 'frame' && '_frameInstance' in node
}

export function findContextFromAncestry(node: VNodeParent, type: ElementFunction): unknown {
  let current: VNodeParent | undefined = node
  while (current) {
    if (current.kind === 'component' && current.type === type) {
      return current._handle.getContextValue()
    }
    current = '_parent' in current ? current._parent : undefined
  }
  return undefined
}
