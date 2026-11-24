import { getNonceManager, type ResourceNonces } from './nonce.ts'
import type { Component, ComponentHandle, FrameHandle, FrameProps } from './component.ts'
import { createComponent, Fragment, FRAME_NODE, Portal, type PortalProps } from './component.ts'
import {
  disposeClientEntryBoundary,
  getClientEntryBoundaryOwner,
  getFrameRuntime,
  type FrameMountState,
} from './frame-runtime.ts'
import { invariant } from './invariant.ts'
import { patchHostProps, setSelectDefaultValue, setSelectValue } from './core/props.ts'
import {
  isEmptyChild,
  isPrimitiveChild,
  isRemixElement,
  isRemixNode,
  jsx,
  normalizeChildren,
} from './core/vnode.ts'
import type { RemixNode } from './core/vnode.ts'
import { normalizeUnsafeHTMLProps } from './unsafe-html.ts'
import type { ElementFunction } from './element-function.ts'
import type { Key } from './key.ts'
import { isEntry, skipComments, logHydrationMismatch } from './client-entries.ts'
import type { Scheduler } from './vdom.ts'
import {
  MixinRuntime,
  isMixinDescriptor,
  type MixinRuntimeBinding,
  type MixinRuntimeValue,
} from './mixins/mixin.ts'
import { OnBinding, isOnMixinDescriptor, type OnMixinDescriptor } from './mixins/on-mixin.ts'
import { componentStalenessCheck } from './refresh.ts'
import { isCommentNode, isFrameStart, isHydrationStart } from './stream-protocol.ts'
import { createStyleManager } from '../style/stylesheet.ts'
import type { StyleManager } from '../style/stylesheet.ts'

export const TEXT_NODE = Symbol('TEXT_NODE')
const NON_RENDER_NODE = Symbol('NON_RENDER_NODE')
export const ROOT_VNODE = Symbol('ROOT_VNODE')

export type VNodeKind =
  | 'root'
  | 'empty'
  | 'text'
  | 'fragment'
  | 'host'
  | 'component'
  | 'client-entry'
  | 'frame'
  | 'portal'

export type RuntimeElementProps = {
  [name: string]: unknown
}

export type RuntimeHostProps = RuntimeElementProps & {
  children?: RemixNode
  innerHTML?: string
  srcDoc?: string
  srcdoc?: string
  mix?: MixinRuntimeValue
}

type InputNodeBase<kind extends VNodeKind, type> = {
  kind: kind
  type: type
  key?: Key
  _parent?: never
}

export type NonRenderNode = InputNodeBase<'empty', typeof NON_RENDER_NODE>

export type TextNode = InputNodeBase<'text', typeof TEXT_NODE> & {
  _text: string
}

export type FragmentNode = InputNodeBase<'fragment', typeof Fragment> & {
  _children: VNodeInput[]
}

export type HostNode = InputNodeBase<'host', string> & {
  props: RuntimeHostProps
  _children: VNodeInput[]
}

export type ComponentNode = InputNodeBase<'component', ElementFunction> & {
  props: RuntimeElementProps
}

export type FrameNode = InputNodeBase<'frame', FrameComponent> & {
  props: RuntimeElementProps & FrameProps
}

export type PortalNode = InputNodeBase<'portal', typeof Portal> & {
  props: RuntimeElementProps & PortalProps
}

export type VNodeInput =
  | NonRenderNode
  | TextNode
  | FragmentNode
  | HostNode
  | ComponentNode
  | FrameNode
  | PortalNode

type MountedNodeBase = {
  _parent: VNodeParent
  _svg: boolean
}

type CommittedNodeBase<kind extends VNodeKind, type> = {
  kind: kind
  type: type
  key?: Key
} & MountedNodeBase

export type CommittedNonRenderNode = CommittedNodeBase<'empty', typeof NON_RENDER_NODE>

export type CommittedTextNode = CommittedNodeBase<'text', typeof TEXT_NODE> & {
  _text: string
  _dom: Text
}

export type HostPersistenceState = {
  parent: ParentNode
  token: number
}

export type CommittedHostNode = CommittedNodeBase<'host', string> & {
  props: RuntimeHostProps
  _children: CommittedVNode[]
  _dom: Element
  _mixedProps: RuntimeHostProps
  _mixState?: MixinRuntime
  _directEventDescriptors?: OnMixinDescriptor[]
  _directEventState?: OnBinding[]
  _controlledState?: ControlledReflection
  _persistence?: HostPersistenceState
}

export type CommittedFragmentNode = CommittedNodeBase<'fragment', typeof Fragment> & {
  _children: CommittedVNode[]
}

export type MountingComponentNode = CommittedNodeBase<'component', ElementFunction> & {
  props: RuntimeElementProps
  _handle: ComponentHandle
  _context: ReconcileContext
}

export type CommittedComponentNode = MountingComponentNode & {
  _content: CommittedVNode
}

export type CommittedClientEntryNode = CommittedNodeBase<'client-entry', ElementFunction> & {
  props: RuntimeElementProps
  _rangeStart: Comment
  _rangeEnd: Comment
}

export type CommittedFrameNode = CommittedNodeBase<'frame', FrameComponent> & {
  props: RuntimeElementProps & FrameProps
  _rangeStart: Comment
  _rangeEnd: Comment
  _state: FrameMountState
}

export type CommittedPortalNode = CommittedNodeBase<'portal', typeof Portal> & {
  props: RuntimeElementProps & PortalProps
  _container: HTMLElement
  _rangeStart: Comment
  _rangeEnd: Comment
  _children: CommittedVNode[]
  _removed?: boolean
}

export type CommittedVNode =
  | CommittedNonRenderNode
  | CommittedTextNode
  | CommittedFragmentNode
  | CommittedHostNode
  | CommittedComponentNode
  | CommittedClientEntryNode
  | CommittedFrameNode
  | CommittedPortalNode

export type RootVNode = {
  kind: 'root'
  type: typeof ROOT_VNODE
  _children: CommittedVNode[]
  _svg: boolean
  _getContext?: (type: ElementFunction) => unknown
  _rangeStart?: Node
  _rangeEnd?: Node
  _pendingHydrationComponentId?: string
  _resourceNonces?: ResourceNonces
}

export interface ReconcileContext {
  frame: FrameHandle
  scheduler: Scheduler
  styles: StyleManager
  rootTarget: EventTarget
  // New Portals need cleanup if their source render fails before recording them.
  _pendingPortals?: Set<CommittedPortalNode> | null
}

export type VNodeParent =
  | RootVNode
  | CommittedFragmentNode
  | CommittedHostNode
  | CommittedPortalNode
  | MountingComponentNode
  | CommittedComponentNode

export type VNode = VNodeInput | CommittedVNode | RootVNode | MountingComponentNode

export type HydrationCursor = { current: Node | null | undefined }

/**
 * Renders `<Frame>` nodes. The frame runtime attaches it to the built-in `Frame` component so the
 * reconciler can render frames without importing the frame runtime.
 */
export interface FrameNodeRenderer {
  insert(
    node: FrameNode,
    domParent: ParentNode,
    vParent: VNodeParent,
    context: ReconcileContext,
    svg: boolean,
    anchor?: Node,
    cursor?: HydrationCursor,
  ): CommittedFrameNode
  diff(
    curr: CommittedFrameNode,
    next: FrameNode,
    domParent: ParentNode,
    vParent: VNodeParent,
    context: ReconcileContext,
    svg: boolean,
    anchor?: Node,
  ): CommittedFrameNode
  dispose(node: CommittedFrameNode): void
}

export type FrameComponent = ElementFunction & { readonly [FRAME_NODE]: FrameNodeRenderer }

function isFrameComponent(type: ElementFunction): type is FrameComponent {
  return Object.hasOwn(type, FRAME_NODE)
}

function isFragmentNode(node: VNode): node is FragmentNode | CommittedFragmentNode {
  return node.kind === 'fragment'
}

function isCommittedTextNode(node: CommittedVNode): node is CommittedTextNode {
  return node.kind === 'text'
}

function isCommittedHostNode(node: CommittedVNode): node is CommittedHostNode {
  return node.kind === 'host'
}

export function isCommittedComponentNode(node: VNode): node is CommittedComponentNode {
  return node.kind === 'component' && '_content' in node
}

function isCommittedClientEntryNode(node: CommittedVNode): node is CommittedClientEntryNode {
  return node.kind === 'client-entry'
}

export function findContextFromAncestry(node: VNodeParent, type: ElementFunction): unknown {
  let current: VNodeParent | undefined = node
  while (current) {
    if (current.kind === 'component' && current.type === type) {
      return current._handle.getContextValue()
    }
    if (current.kind === 'root') {
      return current._getContext?.(type)
    }
    current = '_parent' in current ? current._parent : undefined
  }
  return undefined
}

function childrenToVNodes(children: RemixNode): VNodeInput[] {
  if (children === undefined) return []
  if (!Array.isArray(children)) return [toVNode(children)]
  let result: VNodeInput[] = []
  for (let child of normalizeChildren(children)) result.push(toVNode(child))
  return result
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
        _children: childrenToVNodes(props.children),
      }
    }

    if (typeof node.type === 'string') {
      let props = parseHostProps(node.props)
      // When innerHTML is set, ignore children
      let children = props.innerHTML != null ? [] : childrenToVNodes(props.children)
      return {
        kind: 'host',
        type: node.type,
        key: node.key,
        props,
        _children: children,
      }
    }
    invariant(isElementFunction(node.type), 'Expected component element type')
    if (node.type === Portal) {
      let props = parseHostProps(node.props)
      let container: PortalProps['container'] = node.props.container
      // Adoption changes ownerDocument without changing the element's prototype, so avoid
      // instanceof checks against either window's HTMLElement constructor.
      invariant(
        container === undefined ||
          (container?.nodeType === Node.ELEMENT_NODE &&
            container.namespaceURI === 'http://www.w3.org/1999/xhtml'),
        'Portal container must be an HTMLElement',
      )
      return { kind: 'portal', type: Portal, key: node.key, props: { ...props, container } }
    }
    if (isFrameComponent(node.type)) {
      invariant(isFrameProps(node.props), '<Frame /> requires a src prop')
      return { kind: 'frame', type: node.type, key: node.key, props: node.props }
    }
    return { kind: 'component', type: node.type, key: node.key, props: node.props }
  }

  if (Array.isArray(node)) {
    return { kind: 'fragment', type: Fragment, _children: childrenToVNodes(node) }
  }

  invariant(false, 'Unexpected RemixNode')
}

function isFrameProps(props: RuntimeElementProps): props is RuntimeElementProps & FrameProps {
  return typeof props.src === 'string' && props.src.length > 0
}

function parseHostProps(props: RuntimeElementProps): RuntimeHostProps {
  let normalizedProps = normalizeUnsafeHTMLProps(props)

  let children = normalizedProps.children
  invariant(children === undefined || isRemixNode(children), 'Invalid host children')

  let mix = normalizedProps.mix
  invariant(mix === undefined || isRuntimeMixValue(mix), 'Invalid mix prop')
  return normalizedProps
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

let defaultStyleManager: StyleManager | undefined

export function getDefaultStyleManager(): StyleManager {
  return (defaultStyleManager ??= createStyleManager())
}

const SVG_NS = 'http://www.w3.org/2000/svg'

let idCounter = 0
let persistedRemovalToken = 0
const persistedMixinNodes = new Set<CommittedHostNode>()
let activeSchedulerUpdateParents: ParentNode[] | undefined

// Compute SVG context for a node based on its parent and type.
// Returns true if the node is within an SVG subtree, false otherwise.
function getSvgContext(vParent: VNodeParent, node: VNodeInput): boolean {
  // Only host elements (strings) can affect SVG context
  if (node.kind === 'host') {
    // svg element creates SVG context
    if (node.type === 'svg') return true
    // foreignObject switches back to HTML context
    if (node.type === 'foreignObject') return false
  }
  // Otherwise inherit from parent
  return vParent._svg
}

function markNodePersistedByMixins(node: CommittedHostNode, domParent: ParentNode, token: number) {
  node._persistence = { parent: domParent, token }
  persistedMixinNodes.add(node)
  node._mixState?.bind()
}

function unmarkNodePersistedByMixins(node: CommittedHostNode) {
  node._persistence = undefined
  persistedMixinNodes.delete(node)
}

function findMatchingPersistedMixinNode(
  type: string,
  key: Key | undefined,
  domParent: ParentNode,
  vParent: VNodeParent,
): CommittedHostNode | null {
  if (key == null) return null
  for (let node of persistedMixinNodes) {
    if (node._persistence?.parent !== domParent) continue
    if (node.type !== type) continue
    if (node.key !== key) continue
    if (findPortalAncestor(node._parent) !== findPortalAncestor(vParent)) continue
    return node
  }
  return null
}

function findPortalAncestor(parent: VNodeParent): CommittedPortalNode | undefined {
  while (parent.kind !== 'root') {
    if (parent.kind === 'portal') return parent
    parent = parent._parent
  }
}

const EMPTY_DIRECT_EVENT_DESCRIPTORS: OnMixinDescriptor[] = []
const EMPTY_COMMITTED_CHILDREN: CommittedVNode[] = []

// Option lists may change in a separate component or hydration root.
const controlledSelectValues = new WeakMap<HTMLSelectElement, unknown>()

class ControlledReflection {
  #element: Element
  #status: 'pending' | 'attached' | 'disposed' = 'pending'
  #version = 0
  #value: unknown
  #checked: unknown
  #select: boolean

  constructor(node: CommittedHostNode, scheduler: Scheduler) {
    let element = (this.#element = node._dom)
    this.#select = node.type === 'select'
    scheduler.enqueueTasks([
      () => {
        if (this.#status !== 'pending') return
        element.addEventListener('input', this)
        element.addEventListener('change', this)
        this.#status = 'attached'
      },
    ])
  }

  update(type: string, props: RuntimeHostProps) {
    if (this.#status === 'disposed') return
    let element = this.#element
    this.#value = type !== 'progress' && 'value' in element ? props.value : undefined
    this.#checked = 'checked' in element ? props.checked : undefined
    this.#version++
    if (element instanceof HTMLSelectElement) {
      if (this.#value === undefined) controlledSelectValues.delete(element)
      else {
        controlledSelectValues.set(element, this.#value)
        setSelectValue(element, this.#value)
      }
    }
  }

  handleEvent(event: Event) {
    if (this.#status === 'disposed') return
    // Let change handlers see the user's selection before restoring these controls.
    if (event.type === 'input' && (this.#checked !== undefined || this.#select)) return
    let version = ++this.#version
    queueMicrotask(() => {
      if (version !== this.#version) return
      let element = this.#element
      if (this.#value !== undefined && 'value' in element && element.value !== this.#value) {
        if (element instanceof HTMLSelectElement) setSelectValue(element, this.#value)
        else element.value = this.#value ?? ''
      }
      if (
        this.#checked !== undefined &&
        'checked' in element &&
        element.checked !== this.#checked
      ) {
        if (this.#checked === '') patchHostProps({}, { checked: '' }, element)
        else element.checked = this.#checked ?? ''
      }
    })
  }

  dispose(detach: boolean) {
    let element = this.#element
    if (detach && this.#status === 'attached') {
      element.removeEventListener('input', this)
      element.removeEventListener('change', this)
    }
    this.#status = 'disposed'
    this.#version++
    if (element instanceof HTMLSelectElement) controlledSelectValues.delete(element)
  }
}

function syncControlledReflection(node: CommittedHostNode, scheduler: Scheduler): void {
  let props = node._mixedProps
  if (!node._controlledState && props.value === undefined && props.checked === undefined) return
  node._controlledState ??= new ControlledReflection(node, scheduler)
  node._controlledState.update(node.type, props)
}

export function restoreAncestorSelect(parent: ParentNode): void {
  let select = parent instanceof Element ? parent.closest('select') : null
  if (!(select instanceof HTMLSelectElement)) return
  let value = controlledSelectValues.get(select)
  if (value !== undefined) setSelectValue(select, value)
}

type ResolvedHostProps = {
  props: RuntimeHostProps
  mixState?: MixinRuntime
  directEventDescriptors?: OnMixinDescriptor[]
}

function resolveNodeMixProps(
  node: HostNode | CommittedHostNode,
  parent: VNodeParent,
  frame: FrameHandle,
  scheduler: Scheduler,
  state?: MixinRuntime,
): ResolvedHostProps {
  let mix = node.props.mix
  let directEventDescriptors = resolveDirectEventDescriptors(mix)
  let props = node.props
  if (directEventDescriptors) {
    state?.teardown()
    state = undefined
  } else {
    state ??= new MixinRuntime(node.type, frame, scheduler, (type: Component | string | symbol) =>
      typeof type === 'function' ? findContextFromAncestry(parent, type) : undefined,
    )
    props = state.resolve(node.type, props)
  }
  return {
    props: getNonceManager().resolveResourceNonce(node.type, props, parent),
    mixState: state,
    directEventDescriptors: directEventDescriptors ?? undefined,
  }
}

function applyResolvedHostProps(node: CommittedHostNode, resolved: ResolvedHostProps): void {
  node._mixedProps = resolved.props
  node._mixState = resolved.mixState
  node._directEventDescriptors = resolved.directEventDescriptors
}

function resolveDirectEventDescriptors(mix: RuntimeHostProps['mix']): OnMixinDescriptor[] | null {
  if (!mix) return EMPTY_DIRECT_EVENT_DESCRIPTORS
  if (!Array.isArray(mix)) {
    return isOnMixinDescriptor(mix) ? [mix] : null
  }

  return allOnDescriptors(mix) ? mix : null
}

function allOnDescriptors(descriptors: unknown[]): descriptors is OnMixinDescriptor[] {
  for (let descriptor of descriptors) {
    if (!isOnMixinDescriptor(descriptor)) return false
  }
  return true
}

function enqueueMixinBindingUpdate(
  this: MixinRuntimeBinding<CommittedHostNode>,
  done: (signal: AbortSignal) => void,
): void {
  let node = this.target
  let state = node._mixState
  this.scheduler.enqueueWork([
    () => {
      if (state?.removed) {
        done(state.lifetime)
        return
      }

      state?.dispatchUpdate('beforeUpdate')
      let prevProps = node._mixedProps
      let resolved = resolveNodeMixProps(node, node._parent, this.frame, this.scheduler, state)
      applyResolvedHostProps(node, resolved)
      patchHostProps(prevProps, resolved.props, this.node)
      syncControlledReflection(node, this.scheduler)
      if (this.node.parentNode) restoreAncestorSelect(this.node.parentNode)

      state?.dispatchUpdate('commit')
      done(state ? state.lifetime : AbortSignal.abort())
    },
  ])
}

function bindNodeMixRuntime(
  node: CommittedHostNode,
  context: ReconcileContext,
  reclaimed: boolean = false,
  parent?: ParentNode,
) {
  let state = node._mixState
  if (!state) return
  state.bind(
    {
      node: node._dom,
      parent: parent ?? getRequiredDomParent(node._dom),
      key: node.key,
      target: node,
      frame: context.frame,
      scheduler: context.scheduler,
      enqueueUpdate: enqueueMixinBindingUpdate,
    },
    reclaimed,
  )
}

function isHeadHostNode(node: HostNode | CommittedHostNode): boolean {
  return node.type.length === 4 && node.type.toLowerCase() === 'head'
}

function getRequiredDomParent(node: Node): ParentNode {
  let parent = node.parentNode
  invariant(parent, 'Expected mounted host node to have a DOM parent')
  return parent
}

function getDocumentHead(domParent: ParentNode): HTMLHeadElement | null {
  if (domParent instanceof Document) {
    return domParent.head
  }
  if (domParent instanceof Node) {
    return domParent.ownerDocument?.head ?? null
  }
  return null
}

function commitNonRenderNode(
  node: VNodeInput & { kind: 'empty' },
  parent: VNodeParent,
  svg: boolean,
): CommittedNonRenderNode {
  let committed = node as unknown as CommittedNonRenderNode
  committed._parent = parent
  committed._svg = svg
  return committed
}

function commitTextNode(
  node: TextNode,
  parent: VNodeParent,
  svg: boolean,
  dom: Text,
): CommittedTextNode {
  let committed = node as unknown as CommittedTextNode
  committed._parent = parent
  committed._svg = svg
  committed._dom = dom
  return committed
}

function beginFragmentNode(
  node: VNodeInput & { kind: 'fragment' },
  parent: VNodeParent,
  svg: boolean,
): CommittedFragmentNode {
  let committed = node as unknown as CommittedFragmentNode
  committed._parent = parent
  committed._svg = svg
  committed._children = EMPTY_COMMITTED_CHILDREN
  return committed
}

function commitHostNode(
  node: HostNode,
  parent: VNodeParent,
  svg: boolean,
  dom: Element,
  resolved: ResolvedHostProps,
): CommittedHostNode {
  let committed = node as unknown as CommittedHostNode
  committed._parent = parent
  committed._svg = svg
  committed._dom = dom
  committed._children = EMPTY_COMMITTED_CHILDREN
  applyResolvedHostProps(committed, resolved)
  return committed
}

function beginComponentNode(
  node: ComponentNode,
  parent: VNodeParent,
  svg: boolean,
  handle: ComponentHandle,
  context: ReconcileContext,
): MountingComponentNode {
  let mounting = node as unknown as MountingComponentNode
  mounting._parent = parent
  mounting._svg = svg
  mounting._handle = handle
  mounting._context = context
  return mounting
}

function commitComponentNode(
  node: MountingComponentNode,
  content: CommittedVNode,
): CommittedComponentNode {
  let committed = node as CommittedComponentNode
  committed._content = content
  return committed
}

export function diffVNodes(
  curr: CommittedVNode | null,
  next: VNodeInput,
  domParent: ParentNode,
  vParent: VNodeParent,
  context: ReconcileContext,
  anchor?: Node,
  cursor?: HydrationCursor,
): CommittedVNode {
  if (context._pendingPortals !== undefined) {
    return reconcileVNodes(curr, next, domParent, vParent, context, anchor, cursor)
  }
  // Null marks an active render without allocating a collection unless it creates a Portal.
  context._pendingPortals = null
  try {
    return reconcileVNodes(curr, next, domParent, vParent, context, anchor, cursor)
  } catch (error) {
    for (let portal of context._pendingPortals ?? []) remove(portal, null, context)
    throw error
  } finally {
    context._pendingPortals = undefined
  }
}

function reconcileVNodes(
  curr: CommittedVNode | null,
  next: VNodeInput,
  domParent: ParentNode,
  vParent: VNodeParent,
  context: ReconcileContext,
  anchor?: Node,
  cursor?: HydrationCursor,
): CommittedVNode {
  if (curr === null) {
    return insert(next, domParent, vParent, context, anchor, cursor)
  }

  if (isCommittedClientEntryNode(curr) && next.kind === 'component' && isEntry(next.type)) {
    return diffClientEntryBoundary(curr, next, vParent, context)
  }

  if (
    componentStalenessCheck !== null &&
    curr.kind === 'component' &&
    next.kind === 'component' &&
    componentStalenessCheck(curr.type) === true
  ) {
    return replace(curr, next, domParent, vParent, context, anchor)
  }

  if (curr.kind !== next.kind || curr.type !== next.type) {
    return replace(curr, next, domParent, vParent, context, anchor)
  }

  let svg = getSvgContext(vParent, next)
  switch (next.kind) {
    case 'host': {
      return diffHost(curr as CommittedHostNode, next, vParent, context, svg)
    }
    case 'text': {
      return diffText(curr as CommittedTextNode, next, vParent, svg)
    }
    case 'empty': {
      return commitNonRenderNode(next, vParent, svg)
    }
    case 'fragment': {
      let childInputs = next._children
      // `anchor` marks the end of the parent's child list, not the end of this
      // fragment, so new children would land after the fragment's siblings.
      // Insert them right after the fragment's current DOM instead, which keeps
      // its range contiguous for a later keyed move.
      let currLastDom = findLastDomAnchor(curr)
      let fragmentAnchor =
        currLastDom && currLastDom.parentNode === domParent
          ? (currLastDom.nextSibling ?? undefined)
          : (findNextSiblingDomAnchor(curr, true) ?? anchor)
      let committed = beginFragmentNode(next, vParent, svg)
      committed._children = diffChildren(
        (curr as CommittedFragmentNode)._children,
        childInputs,
        domParent,
        committed,
        context,
        undefined,
        fragmentAnchor,
      )
      return committed
    }
    case 'portal': {
      return diffPortal(curr as CommittedPortalNode, next, domParent, vParent, context, anchor)
    }
    case 'frame': {
      return next.type[FRAME_NODE].diff(
        curr as CommittedFrameNode,
        next,
        domParent,
        vParent,
        context,
        svg,
        anchor,
      )
    }
    case 'component': {
      return diffComponent(
        curr as CommittedComponentNode,
        next,
        domParent,
        vParent,
        context,
        svg,
        anchor,
        cursor,
      )
    }
  }
}

function replace(
  curr: CommittedVNode,
  next: VNodeInput,
  domParent: ParentNode,
  vParent: VNodeParent,
  context: ReconcileContext,
  anchor?: Node,
): CommittedVNode {
  let currAnchor = findFirstDomAnchor(curr)
  if (currAnchor && currAnchor.parentNode === domParent) {
    let replacementAnchor = document.createComment('rmx:replace')
    domParent.insertBefore(replacementAnchor, currAnchor)
    try {
      remove(curr, domParent, context)
      return insert(next, domParent, vParent, context, replacementAnchor)
    } finally {
      replacementAnchor.parentNode?.removeChild(replacementAnchor)
    }
  }

  let replacementAnchor = findNextSiblingDomAnchor(curr, true) ?? anchor
  remove(curr, domParent, context)
  return insert(next, domParent, vParent, context, replacementAnchor)
}

function diffHost(
  curr: CommittedHostNode,
  next: HostNode,
  vParent: VNodeParent,
  context: ReconcileContext,
  svg: boolean,
  reclaimed = false,
): CommittedHostNode {
  let dom = curr._dom
  let { scheduler } = context
  let previous = curr._mixedProps
  let resolved = resolveNodeMixProps(next, vParent, context.frame, scheduler, curr._mixState)
  let mixins = resolved.mixState
  let dispatchInline = (reclaimed || mixins?.hasSlots) && shouldDispatchInlineMixinLifecycle(dom)
  if (dispatchInline) mixins?.dispatchUpdate('beforeUpdate')

  let children = next._children
  let committed = commitHostNode(next, vParent, svg, dom, resolved)
  committed._directEventState = curr._directEventState
  committed._controlledState = curr._controlledState
  if (reclaimed) {
    // Restore listeners and controlled values before reconciling a returning host's children.
    patchHostProps(previous, resolved.props, dom)
    syncDirectEventListeners(committed)
    committed._controlledState ??= new ControlledReflection(committed, scheduler)
    syncControlledReflection(committed, scheduler)
  } else if (previous.innerHTML != resolved.props.innerHTML) {
    setHostInnerHTML(dom, resolved.props.innerHTML ?? '')
  }

  committed._children = diffChildren(curr._children, children, dom, committed, context)
  if (!reclaimed) {
    patchHostProps(previous, resolved.props, dom)
    setupHostNode(committed, scheduler)
  }
  bindNodeMixRuntime(committed, context, reclaimed)
  if (reclaimed ? shouldDispatchInlineMixinLifecycle(dom) : dispatchInline) {
    scheduler.enqueueCommitPhase([
      () => (reclaimed ? committed._mixState : mixins)?.dispatchUpdate('commit'),
    ])
  }
  return committed
}

function setupHostNode(node: CommittedHostNode, scheduler: Scheduler): void {
  syncDirectEventListeners(node)
  syncControlledReflection(node, scheduler)
}

function syncDirectEventListeners(node: CommittedHostNode): void {
  let descriptors = node._directEventDescriptors
  if (!descriptors?.length) {
    disposeDirectEventListeners(node, true)
    return
  }
  let bindings = (node._directEventState ??= [])
  for (let index = 0; index < descriptors.length; index++) {
    let args = descriptors[index].args
    let binding = bindings[index]
    if (binding) binding.update(node._dom, args, true)
    else {
      binding = bindings[index] = new OnBinding(args)
      binding.attach(node._dom)
    }
  }
  for (let index = descriptors.length; index < bindings.length; index++) {
    bindings[index].detach(node._dom)
    bindings[index].abort()
  }
  bindings.length = descriptors.length
}

function disposeDirectEventListeners(node: CommittedHostNode, detach: boolean): void {
  if (!node._directEventState) return
  for (let binding of node._directEventState) {
    if (detach) binding.detach(node._dom)
    binding.abort()
  }
  node._directEventState = undefined
}

function diffText(
  curr: CommittedTextNode,
  next: TextNode,
  vParent: VNodeParent,
  svg: boolean,
): CommittedTextNode {
  if (curr._text !== next._text) {
    curr._dom.textContent = next._text
  }
  return commitTextNode(next, vParent, svg, curr._dom)
}

function mountHostNode(
  node: HostNode,
  vParent: VNodeParent,
  svg: boolean,
  dom: Element,
  resolved: ResolvedHostProps,
  context: ReconcileContext,
  childCursor?: HydrationCursor,
  parent?: ParentNode,
): CommittedHostNode {
  let hostProps = resolved.props
  let childInputs = node._children
  let hydratedProps = hostProps
  let editedBeforeHydration: 'value' | 'checked' | undefined
  if (childCursor) {
    // Server option attributes already reflect the select's winning value. Preserve them and edits.
    if (dom instanceof HTMLOptionElement) hydratedProps = { ...hostProps, selected: undefined }
    // Keep what the user typed or toggled before this control hydrated. It's replayed below.
    if (dom instanceof HTMLInputElement && (dom.type === 'checkbox' || dom.type === 'radio')) {
      if (dom.checked !== dom.defaultChecked) editedBeforeHydration = 'checked'
    } else if (
      (dom instanceof HTMLInputElement || dom instanceof HTMLTextAreaElement) &&
      dom.value !== dom.defaultValue
    ) {
      // Browsers sanitize some server values, such as lowercasing colors or clamping ranges, so
      // compare against the server value as this control holds it.
      let pristine = dom.cloneNode()
      if (pristine instanceof HTMLInputElement || pristine instanceof HTMLTextAreaElement) {
        pristine.value = dom.defaultValue
        if (pristine.value !== dom.value) editedBeforeHydration = 'value'
      }
    }
    if (editedBeforeHydration) {
      hydratedProps = { ...hydratedProps, [editedBeforeHydration]: undefined }
    }
  }
  patchHostProps({}, hydratedProps, dom)
  let committed = commitHostNode(node, vParent, svg, dom, resolved)

  if (hostProps.innerHTML != null) {
    dom.innerHTML = hostProps.innerHTML
  } else {
    committed._children = diffChildren(null, childInputs, dom, committed, context, childCursor)
  }

  if (!childCursor) {
    if (dom instanceof HTMLSelectElement) {
      let value = hostProps.value ?? hostProps.defaultValue
      if (value != null) {
        let scalar = !dom.multiple || (hostProps.value != null && !Array.isArray(value))
        setSelectDefaultValue(dom, value, scalar)
      }
    } else if (dom instanceof HTMLOptionElement) {
      dom.defaultSelected = hostProps.selected === '' || Boolean(hostProps.selected)
    }
  }

  setupHostNode(committed, context.scheduler)
  bindNodeMixRuntime(committed, context, false, parent)

  if (editedBeforeHydration) {
    // Replay the edit once handlers are attached so app state catches up with what the user sees.
    context.scheduler.enqueueTasks([
      () => {
        if (!dom.isConnected) return
        // Selecting a radio unchecks the rest of its group, and only the selected one fires events.
        if (dom instanceof HTMLInputElement && dom.type === 'radio' && !dom.checked) {
          return
        }
        dom.dispatchEvent(new Event('input', { bubbles: true }))
        // These controls commit `change` while still focused. Others, like text, number, and
        // textarea, still fire their own `change` on blur.
        if (
          dom.ownerDocument.activeElement !== dom ||
          (dom instanceof HTMLInputElement &&
            ['checkbox', 'radio', 'range', 'color', 'file'].includes(dom.type))
        ) {
          dom.dispatchEvent(new Event('change', { bubbles: true }))
        }
      },
    ])
  }
  return committed
}

// SVG elements have case-sensitive tag names (e.g. linearGradient, clipPath)
// HTML elements are case-insensitive, so we lowercase for comparison
function getHydrationTagName(element: Element, svg: boolean): string {
  return svg ? element.tagName : element.tagName.toLowerCase()
}

export function insertDomNode(dom: Node, domParent: ParentNode, anchor?: Node): void {
  if (anchor) {
    domParent.insertBefore(dom, anchor)
  } else {
    domParent.appendChild(dom)
  }
}

function insert(
  node: VNodeInput,
  domParent: ParentNode,
  vParent: VNodeParent,
  context: ReconcileContext,
  anchor?: Node,
  cursor?: HydrationCursor,
): CommittedVNode {
  let { frame, scheduler, styles } = context
  let svg = getSvgContext(vParent, node)
  let hydrationNode = cursor?.current

  // Stop hydration if cursor has reached the anchor (end boundary)
  // Check BEFORE skipComments to prevent escaping range root markers
  if (hydrationNode && anchor && hydrationNode === anchor) {
    hydrationNode = null
  }

  // Keep client entry markers for descendants or following siblings to claim. Portals do not
  // claim source DOM. Empty strings need a placeholder because the server emits no Text node.
  hydrationNode = skipCommentsExceptBoundaryStart(
    hydrationNode ?? null,
    node.kind === 'component' ||
      node.kind === 'fragment' ||
      node.kind === 'portal' ||
      node.kind === 'empty' ||
      (node.kind === 'text' && node._text === ''),
    anchor,
  )

  if (hydrationNode && anchor && hydrationNode === anchor) {
    hydrationNode = null
  }
  if (cursor) cursor.current = hydrationNode

  if (
    vParent.kind !== 'root' &&
    node.kind === 'component' &&
    isEntry(node.type) &&
    isCommentNode(hydrationNode)
  ) {
    let runtime = getFrameRuntime(frame)
    let pending = runtime?.pendingClientEntries.get(hydrationNode)
    let owner = getClientEntryBoundaryOwner(hydrationNode)
    let end = pending?.[0] ?? owner?.end
    if (end) {
      let committed = commitClientEntryBoundary(node, vParent, svg, hydrationNode, end)
      updateClientEntryBoundary(committed, context)
      if (cursor) cursor.current = end.nextSibling
      return committed
    }
  }

  if (node.kind === 'empty') {
    return commitNonRenderNode(node, vParent, svg)
  }

  if (node.kind === 'text') {
    if (hydrationNode instanceof Text) {
      // Handle text node consolidation: server renders adjacent text as single node
      // e.g., <span>Hello {world}</span> → server: "Hello world", client: ["Hello ", "world"]
      if (hydrationNode.data !== node._text) {
        if (
          hydrationNode.data.startsWith(node._text) &&
          node._text.length < hydrationNode.data.length
        ) {
          // Consolidation case: split the text node at the boundary
          // cursor becomes the first part (node._text), remainder is returned for next vnode
          let remainder = hydrationNode.splitText(node._text.length)
          if (cursor) cursor.current = remainder
          return commitTextNode(node, vParent, svg, hydrationNode)
        }
        if (
          node._text.startsWith(hydrationNode.data) &&
          hydrationNode.data.length < node._text.length
        ) {
          // Parser-split case: one vnode text spread across several DOM Text nodes
          // (browser parsed a >64K text node into multiple chunks)
          let remainder = node._text.slice(hydrationNode.data.length)
          let sibling = hydrationNode.nextSibling
          while (
            remainder.length > 0 &&
            sibling instanceof Text &&
            remainder.startsWith(sibling.data)
          ) {
            remainder = remainder.slice(sibling.data.length)
            let next = sibling.nextSibling
            sibling.remove()
            sibling = next
          }
          if (
            remainder.length > 0 &&
            sibling instanceof Text &&
            sibling.data.startsWith(remainder)
          ) {
            // A parser chunk can also contain the start of the next text child.
            sibling.deleteData(0, remainder.length)
          }
          hydrationNode.data = node._text
          if (cursor) cursor.current = sibling
          return commitTextNode(node, vParent, svg, hydrationNode)
        }
        // Genuine mismatch - correct it
        logHydrationMismatch('text mismatch', hydrationNode.data, node._text)
        hydrationNode.data = node._text
      }
      if (cursor) cursor.current = hydrationNode.nextSibling
      return commitTextNode(node, vParent, svg, hydrationNode)
    }
    let dom = document.createTextNode(node._text)
    // The server renders nothing for an empty string, so hydration reaches the next sibling
    // instead of a Text node. Insert before that sibling, where the child belongs, and leave it
    // for the next child to claim.
    insertDomNode(dom, domParent, hydrationNode?.parentNode === domParent ? hydrationNode : anchor)
    return commitTextNode(node, vParent, svg, dom)
  }

  if (node.kind === 'host') {
    let resolved = resolveNodeMixProps(node, vParent, frame, scheduler)

    if (isHeadHostNode(node)) {
      let targetHead = getDocumentHead(domParent)
      if (targetHead) {
        let childInputs = node._children
        let childCursor = cursor ? { current: hydrationNode } : undefined
        if (hydrationNode instanceof Element && hydrationNode.tagName.toLowerCase() === 'head') {
          if (childCursor) childCursor.current = hydrationNode.firstChild
          let nextCursor = hydrationNode.nextSibling
          if (hydrationNode !== targetHead) {
            while (hydrationNode.firstChild) {
              targetHead.appendChild(hydrationNode.firstChild)
            }
            hydrationNode.remove()
          }
          if (cursor) cursor.current = nextCursor
        }

        let committed = commitHostNode(node, vParent, svg, targetHead, resolved)
        // Render explicit <head> children directly into document.head.
        committed._children = diffChildren(
          null,
          childInputs,
          targetHead,
          committed,
          context,
          childCursor,
        )
        patchHostProps({}, resolved.props, targetHead)
        setupHostNode(committed, scheduler)
        bindNodeMixRuntime(committed, context)
        return committed
      }
    }

    // Check for matching mixin-persisted node that can be reclaimed
    let persistedNode = findMatchingPersistedMixinNode(node.type, node.key, domParent, vParent)
    if (persistedNode) {
      persistedNode._mixState?.cancelRemoval()
      unmarkNodePersistedByMixins(persistedNode)
      return diffHost(persistedNode, node, vParent, context, svg, true)
    }

    if (hydrationNode instanceof Element) {
      let cursorTag = getHydrationTagName(hydrationNode, svg)
      let match: Element | null = cursorTag === node.type ? hydrationNode : null
      if (!match) {
        // Type mismatch - try single-advance retry to handle browser extension injections
        // at the start of containers. Skip this node and try the next sibling once, and
        // leave the skipped node in place if the next sibling matches.
        let nextSibling = skipComments(hydrationNode.nextSibling)
        if (nextSibling instanceof Element && getHydrationTagName(nextSibling, svg) === node.type) {
          match = nextSibling
        }
      }
      if (match) {
        let nextCursor = match.nextSibling
        // Ignore excess child nodes - browser extensions may inject content
        let committed = mountHostNode(node, vParent, svg, match, resolved, context, {
          current: match.firstChild,
        })
        if (cursor) cursor.current = nextCursor
        return committed
      }
      // Retry failed - log mismatch and create new element (don't remove mismatched nodes)
      logHydrationMismatch('tag', cursorTag, node.type)
      if (cursor) cursor.current = undefined // stop hydration for this tree
    }
    let dom = svg ? document.createElementNS(SVG_NS, node.type) : document.createElement(node.type)
    let committed = mountHostNode(node, vParent, svg, dom, resolved, context, undefined, domParent)
    insertDomNode(dom, domParent, anchor)
    return committed
  }

  if (node.kind === 'fragment') {
    let childInputs = node._children
    let committed = beginFragmentNode(node, vParent, svg)
    let children: Array<VNodeInput | CommittedVNode> = childInputs
    // Insert fragment children in order before the same anchor
    for (let i = 0; i < childInputs.length; i++) {
      children[i] = insert(childInputs[i], domParent, committed, context, anchor, cursor)
    }
    committed._children = children as CommittedVNode[]
    return committed
  }

  if (node.kind === 'component') {
    return diffComponent(null, node, domParent, vParent, context, svg, anchor, cursor)
  }

  if (node.kind === 'portal') {
    return insertPortal(node, domParent, vParent, context)
  }

  if (node.kind === 'frame') {
    return node.type[FRAME_NODE].insert(node, domParent, vParent, context, svg, anchor, cursor)
  }

  invariant(false, 'Unexpected node type')
}

type PortalRange = {
  _container: HTMLElement
  _rangeStart: Comment
  _rangeEnd: Comment
  _removed?: boolean
}

const portalRanges = new WeakMap<Node, Comment>()
const portalContainers = new WeakMap<Node, Set<PortalRange>>()
let activePortalRanges = 0
let portalSnapshots: WeakMap<Node[], Node[]> | undefined

function registerPortalRange(range: PortalRange): void {
  // Keep recognition for snapshots taken before disposal. Weak keys let detached ranges be collected.
  portalRanges.set(range._rangeStart, range._rangeEnd)
  let ranges = portalContainers.get(range._container)
  if (!ranges) portalContainers.set(range._container, (ranges = new Set()))
  ranges.add(range)
  activePortalRanges++
}

function getPortalRangeEnd(start: Node): Comment | undefined {
  return start.nodeType === Node.COMMENT_NODE ? portalRanges.get(start) : undefined
}

export function excludePortalRanges(nodes: Node[], parent?: Node): Node[] {
  if (nodes.length === 0) return nodes
  let snapshot = portalSnapshots?.get(nodes)
  if (snapshot) return snapshot
  if (activePortalRanges === 0) return nodes
  parent ??= nodes[0].parentNode ?? undefined
  if (!parent || !portalContainers.has(parent)) return nodes
  let result: Node[] | undefined
  for (let i = 0; i < nodes.length; i++) {
    let end = getPortalRangeEnd(nodes[i])
    if (end) {
      result ??= nodes.slice(0, i)
      let endIndex = nodes.indexOf(end, i)
      invariant(endIndex !== -1, 'Portal end marker not found')
      i = endIndex
    } else {
      result?.push(nodes[i])
    }
  }
  if (!result) return nodes
  // Cleanup can dispose the last portal before a second pass visits this same node snapshot.
  portalSnapshots ??= new WeakMap()
  portalSnapshots.set(nodes, result)
  return result
}

function finishPortalRemovals(container: ParentNode): void {
  let portals = portalContainers.get(container)
  if (!portals) return
  for (let portal of portals) {
    if (!portal._removed) continue
    if (
      portal._rangeStart.parentNode === container &&
      portal._rangeEnd.parentNode === container &&
      portal._rangeStart.nextSibling !== portal._rangeEnd
    ) {
      continue
    }
    portals.delete(portal)
    activePortalRanges--
    if (!portals.size) portalContainers.delete(container)
    portal._rangeStart.remove()
    portal._rangeEnd.remove()
  }
}

function setHostInnerHTML(element: Element, html: string): void {
  // A template's innerHTML updates its content fragment, leaving Portal nodes untouched.
  if (!portalContainers.get(element) || element.localName === 'template') {
    element.innerHTML = html
    return
  }
  // Keep Portal ranges connected. Detaching them would disturb focus and trigger connection
  // lifecycle callbacks.
  for (let node of excludePortalRanges(Array.from(element.childNodes), element)) {
    element.removeChild(node)
  }
  if (element.localName === 'html') {
    // insertAdjacentHTML uses a body context for html elements, unlike innerHTML.
    let parsed = element.ownerDocument.createElement('html')
    parsed.innerHTML = html
    let anchor = element.firstChild
    while (parsed.firstChild) element.insertBefore(parsed.firstChild, anchor)
  } else {
    element.insertAdjacentHTML('afterbegin', html)
  }
}

function getPortalContainer(props: PortalProps, doc: Document): HTMLElement {
  let container = props.container === undefined ? doc.body : props.container
  invariant(container, 'Portal requires a destination container or a document body')
  invariant(container.ownerDocument === doc, 'Portal container must belong to the same document')
  return container
}

function insertPortal(
  node: PortalNode,
  domParent: ParentNode,
  vParent: VNodeParent,
  context: ReconcileContext,
): CommittedPortalNode {
  let doc = domParent.ownerDocument ?? document
  let container = getPortalContainer(node.props, doc)
  let start = doc.createComment('rmx:portal')
  let end = doc.createComment('/rmx:portal')
  container.append(start, end)
  let committed: CommittedPortalNode = {
    kind: 'portal',
    type: Portal,
    key: node.key,
    props: node.props,
    _parent: vParent,
    _svg: false,
    _container: container,
    _rangeStart: start,
    _rangeEnd: end,
    _children: [],
  }
  registerPortalRange(committed)
  context._pendingPortals ??= new Set()
  context._pendingPortals.add(committed)
  for (let child of childrenToVNodes(node.props.children)) {
    committed._children.push(insert(child, container, committed, context, end))
  }
  restoreAncestorSelect(container)
  return committed
}

function diffPortal(
  curr: CommittedPortalNode,
  next: PortalNode,
  domParent: ParentNode,
  vParent: VNodeParent,
  context: ReconcileContext,
  anchor?: Node,
): CommittedVNode {
  let container = getPortalContainer(next.props, domParent.ownerDocument ?? document)
  // A failed replacement can leave the previous portal in the committed tree after its removal.
  if (
    curr._removed ||
    container !== curr._container ||
    curr._rangeStart.parentNode !== curr._container
  ) {
    let current: Node | null = curr._rangeStart
    while (current) {
      invariant(
        !current.contains(container),
        'Portal container must not be inside its own children',
      )
      if (current === curr._rangeEnd) break
      current = current.nextSibling
    }
    return replace(curr, next, domParent, vParent, context, anchor)
  }
  curr._parent = vParent
  curr.props = next.props
  curr._children = diffChildren(
    curr._children,
    childrenToVNodes(next.props.children),
    container,
    curr,
    context,
    undefined,
    curr._rangeEnd,
  )
  restoreAncestorSelect(container)
  return curr
}

function removeDomRange(start: Node, end: Node, domParent: ParentNode): void {
  let cursor: Node | null = start
  while (cursor) {
    let nextSibling: Node | null = cursor.nextSibling
    if (cursor.parentNode === domParent) {
      domParent.removeChild(cursor)
    }
    if (cursor === end) break
    cursor = nextSibling
  }
}

function skipCommentsExceptBoundaryStart(
  cursor: Node | null,
  preserveClientEntry: boolean,
  anchor?: Node,
): Node | null {
  while (cursor && cursor.nodeType === Node.COMMENT_NODE) {
    if (cursor === anchor) return cursor
    let portalEnd = getPortalRangeEnd(cursor)
    if (portalEnd) {
      cursor = portalEnd.nextSibling
      continue
    }
    if (isFrameStart(cursor)) return cursor
    if (preserveClientEntry && isHydrationStart(cursor)) return cursor
    cursor = cursor.nextSibling
  }
  return cursor
}

export function renderComponent(
  currContent: CommittedVNode | null,
  next: MountingComponentNode | CommittedComponentNode,
  domParent: ParentNode,
  context: ReconcileContext,
  anchor?: Node,
  cursor?: HydrationCursor,
): CommittedComponentNode {
  let { scheduler } = context
  let handle = next._handle
  if (handle.isRemoved()) {
    invariant('_content' in next, 'Expected removed component to be committed')
    return next
  }

  let [element, tasks] = handle.render(next.props)
  let content = diffVNodes(currContent, toVNode(element), domParent, next, context, anchor, cursor)
  let committed = commitComponentNode(next, content)
  handle.setScheduleUpdate(scheduler, committed, domParent)
  restoreAncestorSelect(domParent)

  scheduler.enqueueTasks(tasks)

  return committed
}

function diffComponent(
  curr: CommittedComponentNode | null,
  next: ComponentNode,
  domParent: ParentNode,
  vParent: VNodeParent,
  context: ReconcileContext,
  svg: boolean,
  anchor?: Node,
  cursor?: HydrationCursor,
): CommittedComponentNode {
  let { frame } = context
  let handle: ComponentHandle
  if (curr === null) {
    let componentId = vParent.kind === 'root' ? vParent._pendingHydrationComponentId : undefined
    if (componentId) {
      if (vParent.kind === 'root') vParent._pendingHydrationComponentId = undefined
    } else {
      componentId = `c${++idCounter}`
    }
    handle = createComponent({
      id: componentId,
      frame,
      type: next.type,
      getContext: (type: ElementFunction) => findContextFromAncestry(vParent, type),
      getFrameByName(name: string) {
        let runtime = getFrameRuntime(frame)
        return runtime?.namedFrames.get(name)
      },
      getTopFrame() {
        let runtime = getFrameRuntime(frame)
        return runtime?.topFrame
      },
    })
  } else {
    handle = curr._handle
  }
  let mounting = beginComponentNode(next, vParent, svg, handle, context)
  return renderComponent(curr && curr._content, mounting, domParent, context, anchor, cursor)
}

function commitClientEntryBoundary(
  node: ComponentNode,
  parent: VNodeParent,
  svg: boolean,
  start: Comment,
  end: Comment,
): CommittedClientEntryNode {
  return {
    kind: 'client-entry',
    type: node.type,
    key: node.key,
    props: node.props,
    _parent: parent,
    _svg: svg,
    _rangeStart: start,
    _rangeEnd: end,
  }
}

function updateClientEntryBoundary(
  node: CommittedClientEntryNode,
  context: ReconcileContext,
): void {
  let element = jsx(node.type, node.props, node.key)
  let owner = getClientEntryBoundaryOwner(node._rangeStart)
  if (owner) {
    getNonceManager().inheritRootResourceNonces(owner.root, node._parent)
    owner.root.render(element)
    return
  }

  let runtime = getFrameRuntime(context.frame)
  let pending = runtime?.pendingClientEntries.get(node._rangeStart)
  invariant(runtime && pending?.[0] === node._rangeEnd, 'Expected pending client entry boundary')
  runtime.pendingClientEntries.set(node._rangeStart, [
    node._rangeEnd,
    element,
    getNonceManager().getResourceNonces(node._parent),
  ])
}

function diffClientEntryBoundary(
  curr: CommittedClientEntryNode,
  next: ComponentNode,
  parent: VNodeParent,
  context: ReconcileContext,
): CommittedClientEntryNode {
  let committed = commitClientEntryBoundary(
    next,
    parent,
    curr._svg,
    curr._rangeStart,
    curr._rangeEnd,
  )
  updateClientEntryBoundary(committed, context)
  return committed
}

function disposeCommittedClientEntryBoundary(
  node: CommittedClientEntryNode,
  context: ReconcileContext,
): boolean {
  getFrameRuntime(context.frame)?.pendingClientEntries.delete(node._rangeStart)
  return disposeClientEntryBoundary(node._rangeStart)
}

// A null domParent cleans up without DOM removal - used for descendants when an
// ancestor DOM node is removed.
export function remove(
  node: CommittedVNode,
  domParent: ParentNode | null,
  context: ReconcileContext,
): void {
  let { scheduler } = context
  if (isCommittedTextNode(node)) {
    if (domParent) node._dom.remove()
    return
  }

  if (isCommittedHostNode(node)) {
    if (domParent) {
      if (node._persistence) return

      let persistedRemoval = node._mixState?.prepareRemoval()
      if (persistedRemoval) {
        let token = ++persistedRemovalToken
        markNodePersistedByMixins(node, domParent, token)
        void persistedRemoval
          .catch(() => {})
          .finally(() => {
            if (!node._persistence) return
            if (node._persistence.token !== token) return
            unmarkNodePersistedByMixins(node)
            performHostNodeRemoval(node, domParent, context)
            finishPortalRemovals(domParent)
          })
        return
      }
    }
    performHostNodeRemoval(node, domParent, context)
    return
  }

  if (isFragmentNode(node)) {
    for (let child of node._children) remove(child, domParent, context)
    return
  }

  if (isCommittedComponentNode(node)) {
    remove(node._content, domParent, context)
    let tasks = node._handle.remove()
    scheduler.enqueueTasks(tasks)
    return
  }

  if (isCommittedClientEntryNode(node)) {
    let disposedRoot = disposeCommittedClientEntryBoundary(node, context)
    if (!domParent) return
    if (disposedRoot) {
      // The root removes its content and honors mixin persistence. Only remove
      // the boundary markers here so exit animations can finish in the DOM.
      node._rangeStart.remove()
      node._rangeEnd.remove()
    } else {
      removeDomRange(node._rangeStart, node._rangeEnd, domParent)
    }
    return
  }

  if (node.kind === 'portal') {
    if (node._removed) return
    node._removed = true
    context._pendingPortals?.delete(node)
    for (let child of node._children) remove(child, node._container, context)
    node._children = []
    // An interrupted child update can leave DOM outside the recorded child list. Removing a
    // normal host removes that DOM too. A Portal must clear its range, preserving known exits.
    if (
      node._rangeStart.parentNode === node._container &&
      node._rangeEnd.parentNode === node._container &&
      node._rangeStart.nextSibling !== node._rangeEnd
    ) {
      let retained: Set<Node> | undefined
      for (let child of persistedMixinNodes) {
        if (child._persistence?.parent !== node._container) continue
        if (findPortalAncestor(child._parent) !== node) continue
        retained ??= new Set()
        retained.add(child._dom)
      }
      let current = node._rangeStart.nextSibling
      while (current && current !== node._rangeEnd) {
        let next = current.nextSibling
        if (!retained?.has(current)) current.remove()
        current = next
      }
    }
    finishPortalRemovals(node._container)
    restoreAncestorSelect(node._container)
    return
  }

  if (node.kind === 'frame') {
    node.type[FRAME_NODE].dispose(node)
    if (domParent) removeDomRange(node._rangeStart, node._rangeEnd, domParent)
    return
  }
}

// Actually remove a host node from DOM and clean up
function performHostNodeRemoval(
  node: CommittedHostNode,
  domParent: ParentNode | null,
  context: ReconcileContext,
): void {
  // Never remove the real document.head node when reconciling a <head> vnode,
  // and since it stays alive, remove its children and detach its listeners for
  // real. Otherwise clean up all descendants before removing the DOM subtree.
  let isHead = domParent !== null && isHeadHostNode(node)
  let children = node._children
  for (let i = 0; i < children.length; i++) {
    remove(children[i], isHead ? node._dom : null, context)
  }

  node._mixState?.teardown()
  disposeDirectEventListeners(node, isHead)
  node._controlledState?.dispose(isHead)
  if (domParent && !isHead) {
    node._dom.remove()
  }
}

function diffChildren(
  curr: CommittedVNode[] | null,
  next: VNodeInput[],
  domParent: ParentNode,
  vParent: VNodeParent,
  context: ReconcileContext,
  cursor?: HydrationCursor,
  anchor?: Node,
): CommittedVNode[] {
  let hasKeys = hasKeyedChildren(next)
  let committed: Array<VNodeInput | CommittedVNode> = next

  if (curr === null) {
    if (hasKeys) {
      warnDuplicateKeys(next)
    }
    for (let i = 0; i < next.length; i++) {
      committed[i] = insert(next[i], domParent, vParent, context, anchor, cursor)
    }
    return committed as CommittedVNode[]
  }

  // Only bulk-clear when at least one committed child is being removed. A
  // fragment shares its DOM parent with its siblings, so it can't clear it.
  if (
    curr.length > 0 &&
    next.length === 0 &&
    anchor === undefined &&
    vParent.kind !== 'fragment' &&
    !portalContainers.get(domParent) &&
    !parentUsesInnerHTML(vParent) &&
    curr.every(canBulkClearNode)
  ) {
    for (let i = 0; i < curr.length; i++) {
      remove(curr[i], null, context)
    }
    domParent.textContent = ''
    return EMPTY_COMMITTED_CHILDREN
  }

  if (!hasKeys) {
    for (let i = 0; i < next.length; i++) {
      let currentNode = i < curr.length ? curr[i] : null
      committed[i] = reconcileVNodes(
        currentNode,
        next[i],
        domParent,
        vParent,
        context,
        anchor,
        cursor,
      )
    }

    for (let i = next.length; i < curr.length; i++) {
      remove(curr[i], domParent, context)
    }

    return committed as CommittedVNode[]
  }

  return patchKeyedChildren(curr, next, domParent, vParent, context, cursor, anchor)
}

function parentUsesInnerHTML(parent: VNodeParent): boolean {
  return parent.kind === 'host' && parent._mixedProps.innerHTML != null
}

function canBulkClearNode(node: CommittedVNode): boolean {
  if (isCommittedTextNode(node)) return true

  if (isCommittedHostNode(node)) {
    if (node._mixState) return false
    return node._children.every(canBulkClearNode)
  }

  if (isFragmentNode(node)) {
    return node._children.every(canBulkClearNode)
  }

  if (isCommittedComponentNode(node)) {
    return canBulkClearNode(node._content)
  }

  return false
}

function hasKeyedChildren(children: Array<{ key?: Key }>): boolean {
  for (let i = 0; i < children.length; i++) {
    if (children[i].key != null) return true
  }
  return false
}

function warnDuplicateKeys(children: Array<{ key?: Key }>): void {
  let seenKeys = new Set<Key>()
  let duplicateKeys: Set<Key> | undefined

  for (let node of children) {
    if (node.key == null) continue

    if (seenKeys.has(node.key)) {
      duplicateKeys ??= new Set()
      duplicateKeys.add(node.key)
    } else {
      seenKeys.add(node.key)
    }
  }

  if (duplicateKeys?.size) {
    let quotedKeys = Array.from(duplicateKeys, (key) => `"${String(key)}"`)
    console.warn(
      `Duplicate keys detected in siblings: ${quotedKeys.join(', ')}. Keys should be unique.`,
    )
  }
}

function patchKeyedChildren(
  curr: CommittedVNode[],
  next: VNodeInput[],
  domParent: ParentNode,
  vParent: VNodeParent,
  context: ReconcileContext,
  cursor?: HydrationCursor,
  anchor?: Node,
): CommittedVNode[] {
  let matches = matchCommonKeyedChanges(curr, next)
  if (!matches) {
    warnDuplicateKeys(next)
    matches = matchKeyedChildren(curr, next)
  }
  let committed: Array<VNodeInput | CommittedVNode> = next

  let matchAnalysis = analyzeKeyedChildMatches(curr.length, matches)
  if (matchAnalysis.hasRemovals) {
    let usedOldIndexes = new Uint8Array(curr.length)

    for (let index = 0; index < matches.length; index++) {
      let oldIndex = matches[index]
      if (oldIndex >= 0) {
        usedOldIndexes[oldIndex] = 1
      }
    }

    for (let oldIndex = 0; oldIndex < curr.length; oldIndex++) {
      if (usedOldIndexes[oldIndex] === 0) {
        remove(curr[oldIndex], domParent, context)
      }
    }
  }

  // Stable children keep their DOM position, so a new child can be inserted
  // directly before the next stable sibling instead of at the end of the list
  // and moved by the placement pass. Hydration keeps the list end anchor
  // because it marks where adoption stops.
  // A matched child without a DOM anchor still needs placement if it starts rendering DOM.
  let stableIndexes = matchAnalysis.canSkipPlacement
    ? null
    : getStableIndexes(matches, (oldIndex) => !!findFirstDomAnchor(curr[oldIndex]))
  let stableCursor = 0
  let cachedStableIndex = -1
  let stableAnchor: Node | undefined

  for (let index = 0; index < next.length; index++) {
    let oldIndex = matches[index]
    let oldNode = oldIndex < 0 ? null : curr[oldIndex]
    let insertAnchor = anchor
    if (stableIndexes) {
      let nextStable = stableIndexes[stableCursor]
      if (index === nextStable) {
        stableCursor++
      } else if (!oldNode && !cursor && nextStable !== undefined) {
        if (cachedStableIndex !== nextStable) {
          cachedStableIndex = nextStable
          stableAnchor = findFirstDomAnchor(curr[matches[nextStable]]) ?? anchor
        }
        insertAnchor = stableAnchor
      }
    }

    committed[index] = reconcileVNodes(
      oldNode,
      next[index],
      domParent,
      vParent,
      context,
      insertAnchor,
      cursor,
    )
  }
  let committedChildren = committed as CommittedVNode[]

  if (!stableIndexes) {
    return committedChildren
  }

  stableCursor = stableIndexes.length - 1
  let placementAnchor: Node | null = anchor ?? null

  for (let index = next.length - 1; index >= 0; index--) {
    let nextNode = committedChildren[index]
    let isStable = stableIndexes[stableCursor] === index

    if (isStable) {
      stableCursor--
    } else {
      placeVNode(nextNode, domParent, placementAnchor)
    }

    placementAnchor = findFirstDomAnchor(nextNode) ?? placementAnchor
  }
  return committedChildren
}

// Keyed child matches are arrays of old indexes (-1 = no match / new node),
// parallel to `next`. Plain numbers instead of wrapper objects keep large
// keyed diffs (1000-row tables) allocation-free.
function matchKeyedChildren(curr: CommittedVNode[], next: VNodeInput[]): number[] {
  let oldKeys = new Map<Key, number>()
  for (let i = 0; i < curr.length; i++) {
    let key = curr[i].key
    if (key != null) oldKeys.set(key, i)
  }

  let nextUnkeyed = 0
  return next.map((child) => {
    let { key, type } = child
    if (key != null) {
      let index = oldKeys.get(key)
      if (index !== undefined && curr[index].type === type) {
        oldKeys.delete(key)
        return index
      }
    } else {
      for (let i = nextUnkeyed; i < curr.length; i++) {
        if (curr[i].key == null && curr[i].type === type) {
          nextUnkeyed = i + 1
          return i
        }
      }
    }
    return -1
  })
}

function isSameKeyedNode(oldNode: CommittedVNode, nextNode: VNodeInput): boolean {
  return oldNode.key === nextNode.key && oldNode.type === nextNode.type
}

function matchCommonKeyedChanges(curr: CommittedVNode[], next: VNodeInput[]): number[] | null {
  let matches: number[] = []
  let skipped = 0
  let firstMismatch = -1
  let swapped = false

  for (let index = 0; index < next.length; index++) {
    let child = next[index]
    if (child.key == null) return null
    let oldIndex = index + skipped
    if (oldIndex >= curr.length) {
      matches.push(-1)
      continue
    }
    if (!isSameKeyedNode(curr[oldIndex], child)) {
      if (
        curr.length === next.length + 1 &&
        !skipped &&
        isSameKeyedNode(curr[oldIndex + 1], child)
      ) {
        skipped = 1
        oldIndex++
      } else if (curr.length !== next.length || swapped) {
        return null
      } else if (firstMismatch < 0) {
        firstMismatch = index
      } else if (
        isSameKeyedNode(curr[firstMismatch], child) &&
        isSameKeyedNode(curr[index], next[firstMismatch])
      ) {
        matches[firstMismatch] = index
        oldIndex = firstMismatch
        swapped = true
      } else return null
    }
    matches.push(oldIndex)
  }
  return firstMismatch < 0 || swapped ? matches : null
}

function analyzeKeyedChildMatches(
  currentLength: number,
  matches: readonly number[],
): { hasRemovals: boolean; canSkipPlacement: boolean } {
  let hasRemovals = matches.length !== currentLength
  let canSkipPlacement = true
  let lastOldIndex = -1
  let sawNewNode = false

  for (let index = 0; index < matches.length; index++) {
    let oldIndex = matches[index]
    if (oldIndex < 0) {
      hasRemovals = true
      sawNewNode = true
      continue
    }

    if (sawNewNode || oldIndex < lastOldIndex) {
      canSkipPlacement = false
    }
    lastOldIndex = oldIndex
  }

  return { hasRemovals, canSkipPlacement }
}

// Return positions of the longest increasing subsequence of reusable old indexes.
export function getStableIndexes(
  matches: readonly number[],
  hasAnchor?: (oldIndex: number) => boolean,
): number[] {
  let predecessors: number[] = []
  let tails: number[] = []
  for (let index = 0; index < matches.length; index++) {
    let value = matches[index]
    if (value < 0 || (hasAnchor && !hasAnchor(value))) continue
    let low = 0
    let high = tails.length

    while (low < high) {
      let middle = (low + high) >> 1

      if (matches[tails[middle]] < value) {
        low = middle + 1
      } else {
        high = middle
      }
    }

    predecessors[index] = low > 0 ? tails[low - 1] : -1
    tails[low] = index
  }

  let cursor = tails.at(-1) ?? -1

  for (let index = tails.length - 1; index >= 0; index--) {
    tails[index] = cursor
    cursor = predecessors[cursor] ?? -1
  }

  return tails
}

function placeVNode(node: CommittedVNode, domParent: ParentNode, anchor: Node | null): void {
  let firstDom = findFirstDomAnchor(node)
  if (!firstDom || firstDom.parentNode !== domParent) return

  let lastDom = findLastDomAnchor(node)
  if (!lastDom) return
  if (anchor && domRangeContainsNode(firstDom, lastDom, anchor)) return
  // Re-inserting a node that is already in place still disconnects and
  // reconnects it, which runs custom element callbacks and resets state
  if (lastDom.nextSibling === anchor) return

  moveDomRange(domParent, firstDom, lastDom, anchor)
}

function findFirstDomAnchor(node: CommittedVNode | null | undefined): Node | null {
  return findEdgeDomNode(node, false)
}

function findLastDomAnchor(node: CommittedVNode | null | undefined): Node | null {
  return findEdgeDomNode(node, true)
}

function findEdgeDomNode(node: CommittedVNode | null | undefined, last: boolean): Node | null {
  if (!node) return null
  if (isCommittedTextNode(node) || isCommittedHostNode(node)) return node._dom
  if (isCommittedComponentNode(node)) return findEdgeDomNode(node._content, last)
  if (isCommittedClientEntryNode(node) || node.kind === 'frame') {
    return last ? node._rangeEnd : node._rangeStart
  }
  if (isFragmentNode(node)) {
    let children = node._children
    for (let i = 0; i < children.length; i++) {
      let dom = findEdgeDomNode(children[last ? children.length - 1 - i : i], last)
      if (dom) return dom
    }
  }
  // Portals have no source DOM; their destination children cannot anchor source siblings.
  return null
}

function domRangeContainsNode(first: Node, last: Node, node: Node): boolean {
  let current: Node | null = first
  while (current) {
    if (current === node) return true
    if (current === last) break
    current = current.nextSibling
  }
  return false
}

function moveDomRange(domParent: ParentNode, first: Node, last: Node, before: Node | null): void {
  let portals = portalContainers.get(domParent)
  let current: Node | null = first
  while (current) {
    // A fragment's source output can surround a portal that owns its destination placement.
    let portalEnd: Comment | undefined = portals && getPortalRangeEnd(current)
    if (portalEnd) {
      current = portalEnd.nextSibling
      continue
    }
    let next: Node | null = current === last ? null : current.nextSibling
    domParent.insertBefore(current, before)
    if (current === last) break
    current = next
  }
}

export function setActiveSchedulerUpdateParents(parents: ParentNode[] | undefined) {
  activeSchedulerUpdateParents = parents
}

function shouldDispatchInlineMixinLifecycle(node: Node): boolean {
  let parents = activeSchedulerUpdateParents
  if (!parents?.length) return true
  for (let parent of parents) {
    if (parent instanceof Node && parent.contains(node)) return false
  }
  return true
}

// During a diff the caller already has the end anchor of the enclosing
// fragment, so `stopAtFragmentEnd` returns null there instead of walking the
// fragment's old siblings, which a keyed diff may have reordered or grown
export function findNextSiblingDomAnchor(
  curr: CommittedVNode | MountingComponentNode,
  stopAtFragmentEnd = false,
): Node | null {
  let vParent = curr._parent
  if (vParent.kind === 'component') return findNextSiblingDomAnchor(vParent, stopAtFragmentEnd)
  let children = vParent._children
  let idx = children.indexOf(curr as CommittedVNode)
  if (idx === -1 && children.length > 0) return null
  for (let i = idx + 1; i < children.length; i++) {
    let dom = findFirstDomAnchor(children[i])
    // During a keyed diff `children` is still the old list, so a sibling may
    // already have been removed from the DOM
    if (dom?.parentNode) return dom
  }

  if (isFragmentNode(vParent)) {
    return stopAtFragmentEnd ? null : findNextSiblingDomAnchor(vParent)
  }

  return vParent.kind === 'root' || vParent.kind === 'portal' ? (vParent._rangeEnd ?? null) : null
}
