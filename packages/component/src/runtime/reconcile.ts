import type { PortalNodeRenderer, PortalRanges } from './portal.ts'
import type { NonceManager, ResourceNonces } from './nonce.ts'
import type { Component, ComponentHandle, FrameHandle, FrameProps } from './component.ts'
import {
  createComponent,
  Fragment,
  FRAME_NODE,
  Portal,
  PORTAL_NODE,
  type PortalProps,
} from './component.ts'
import type { ClientEntryBoundaryRuntime, FrameMountState } from './frame-runtime.ts'
import { invariant } from './invariant.ts'
import { patchHostProps, setSelectDefaultValue, setSelectValue } from './core/props.ts'
import {
  defaultMixinRuntime,
  DIRECT_EVENT,
  isEmptyChild,
  isMixinDescriptor,
  isPrimitiveChild,
  isRemixElement,
  isRemixNode,
  jsx,
  MIXIN_RUNTIME,
  normalizeChildren,
} from './core/vnode.ts'
import type { RemixNode } from './core/vnode.ts'
import { normalizeUnsafeHTMLProps } from './unsafe-html.ts'
import type { ElementFunction } from './element-function.ts'
import type { Key } from './key.ts'
import type { Scheduler } from './vdom.ts'
import type { MixinRuntime, MixinRuntimeBinding, MixinRuntimeValue } from './mixins/mixin.ts'
import type { OnBinding, OnMixinDescriptor } from './mixins/on-mixin.ts'
import { componentStalenessCheck } from './refresh.ts'
import type { StyleManager } from '../style/stylesheet.ts'

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

export type RuntimeElementProps = { [name: string]: unknown }

export type RuntimeHostProps = RuntimeElementProps & {
  children?: RemixNode
  innerHTML?: string
  srcDoc?: string
  srcdoc?: string
  mix?: MixinRuntimeValue
}

type PortalComponent = ElementFunction & { readonly [PORTAL_NODE]: PortalNodeRenderer }

type InputNodeBase<kind extends VNodeKind, type> = {
  kind: kind
  type: type
  key?: Key
  _parent?: never
}

export type NonRenderNode = InputNodeBase<'empty', false>
export type TextNode = InputNodeBase<'text', null> & { _text: string }
export type FragmentNode = InputNodeBase<'fragment', typeof Fragment> & { _children: VNodeInput[] }

type HostMixState = {
  _mixedProps: RuntimeHostProps
  _mixState?: MixinRuntime
  _directEventDescriptors?: OnMixinDescriptor[]
}

export type HostNode = InputNodeBase<'host', string> &
  Partial<HostMixState> & {
    props: RuntimeHostProps
    _children: VNodeInput[]
  }

export type ComponentNode = InputNodeBase<'component', ElementFunction> & {
  props: RuntimeElementProps
}

export type FrameNode = InputNodeBase<'frame', FrameComponent> & {
  props: RuntimeElementProps & FrameProps
}

export type PortalNode = InputNodeBase<'portal', PortalComponent> & {
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

type MountedNodeBase = { _parent: VNodeParent; _svg: boolean }
type CommittedNodeBase<kind extends VNodeKind, type> = {
  kind: kind
  type: type
  key?: Key
} & MountedNodeBase

export type CommittedNonRenderNode = CommittedNodeBase<'empty', false>
export type CommittedTextNode = CommittedNodeBase<'text', null> & { _text: string; _dom: Text }
export type HostPersistenceState = { parent: ParentNode; token: number }

type ControlledState = {
  update(type: string, props: RuntimeHostProps): void
  dispose(detach: boolean): void
}

export type CommittedHostNode = CommittedNodeBase<'host', string> &
  HostMixState & {
    props: RuntimeHostProps
    _children: CommittedVNode[]
    _dom: Element
    _directEventState?: OnBinding[]
    _controlledState?: ControlledState
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

export type CommittedComponentNode = MountingComponentNode & { _content: CommittedVNode }

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

export type CommittedPortalNode = CommittedNodeBase<'portal', PortalComponent> & {
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
  styles?: StyleManager
  rootTarget: EventTarget
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

type OptionalFrameRuntime = {
  topFrame?: FrameHandle
  registry?: { get(name: string): FrameHandle | undefined }
  nonceManager?: NonceManager
  clientEntries?: ClientEntryBoundaryRuntime
}

const SVG_NS = 'http://www.w3.org/2000/svg'
const EMPTY_DIRECT_EVENTS: OnMixinDescriptor[] = []
const EMPTY_CHILDREN: CommittedVNode[] = []
const controlledSelectValues = new WeakMap<HTMLSelectElement, unknown>()

let idCounter = 0
let persistedRemovalToken = 0
export const persistedMixinNodes = new Set<CommittedHostNode>()
let activeSchedulerUpdateParents: ParentNode[] | undefined
export let portalRanges: PortalRanges | undefined

export function setPortalRanges(ranges: PortalRanges): PortalRanges {
  return (portalRanges = ranges)
}

export function excludePortalRanges(nodes: Node[], parent?: Node): Node[] {
  return portalRanges?.exclude(nodes, parent) ?? nodes
}

export function setActiveSchedulerUpdateParents(parents: ParentNode[] | undefined) {
  activeSchedulerUpdateParents = parents
}

export function insertDomNode(dom: Node, domParent: ParentNode, anchor?: Node): void {
  domParent.insertBefore(dom, anchor ?? null)
}

export function findContextFromAncestry(node: VNodeParent, type: ElementFunction): unknown {
  let current = node
  while (current.kind !== 'root') {
    if (current.kind === 'component' && current.type === type) {
      return current._handle.getContextValue()
    }
    current = current._parent
  }
  return current._getContext?.(type)
}

export function childrenToVNodes(children: RemixNode, hostChild = true): VNodeInput[] {
  if (children === undefined) return []
  if (!Array.isArray(children)) return [toVNode(children, hostChild)]
  let list = normalizeChildren(children)
  let out: VNodeInput[] = []
  for (let i = 0; i < list.length; i++) out.push(toVNode(list[i], hostChild))
  return out
}

export function toVNode(node: unknown, hostChild = false): VNodeInput {
  if (isEmptyChild(node)) return { kind: 'empty', type: false }
  if (isPrimitiveChild(node)) return { kind: 'text', type: null, _text: String(node) }
  if (Array.isArray(node)) {
    return { kind: 'fragment', type: Fragment, _children: childrenToVNodes(node, hostChild) }
  }
  if (isRemixElement(node)) {
    let { type, props, key } = node
    if (type === Fragment) {
      let hostProps = parseHostProps(props)
      return { kind: 'fragment', type: Fragment, key, _children: childrenToVNodes(hostProps.children) }
    }
    if (typeof type === 'string') {
      let hostProps = parseHostProps(props)
      let children: VNodeInput[]
      if (hostProps.innerHTML != null) {
        invariant(isRemixNode(hostProps.children), 'Invalid host children')
        children = []
      } else {
        children = childrenToVNodes(hostProps.children)
      }
      return { kind: 'host', type, key, props: hostProps, _children: children }
    }
    invariant(typeof type === 'function', 'Expected component element type')
    let fn = type as ElementFunction
    if (fn === Portal && Object.hasOwn(fn, PORTAL_NODE)) {
      let portalType = fn as PortalComponent
      return { kind: 'portal', type: portalType, key, props: portalType[PORTAL_NODE].parseProps(props) }
    }
    if (Object.hasOwn(fn, FRAME_NODE)) {
      invariant(typeof props.src === 'string' && props.src.length > 0, '<Frame /> requires a src prop')
      return { kind: 'frame', type: fn as FrameComponent, key, props: props as RuntimeElementProps & FrameProps }
    }
    return { kind: 'component', type: fn, key, props }
  }
  invariant(false, hostChild ? 'Invalid host children' : 'Unexpected RemixNode')
}

export function parseHostProps(props: RuntimeElementProps): RuntimeHostProps {
  let normalized = normalizeUnsafeHTMLProps(props)
  let mix = normalized.mix
  invariant(
    mix === undefined ||
      (Array.isArray(mix) ? mix.every(isMixinDescriptor) : isMixinDescriptor(mix)),
    'Invalid mix prop',
  )
  return normalized
}

function createControlledState(node: CommittedHostNode, scheduler: Scheduler): ControlledState {
  let element = node._dom
  let isSelect = node.type === 'select'
  let version: number | null = 0
  let value: unknown
  let checked: unknown

  let listener = {
    handleEvent(event: Event) {
      if (version === null) return
      if (event.type === 'input' && (checked !== undefined || isSelect)) return
      let v = ++version
      queueMicrotask(() => {
        if (v !== version) return
        let el = element as Element & Record<string, unknown>
        if (value !== undefined && 'value' in el && el.value !== value) {
          if (element instanceof HTMLSelectElement) setSelectValue(element, value)
          else el.value = value ?? ''
        }
        if (checked !== undefined && 'checked' in el && el.checked !== checked) {
          if (checked === '') patchHostProps({}, { checked: '' }, element)
          else el.checked = checked ?? ''
        }
      })
    },
  }

  scheduler.enqueueTasks([
    () => {
      if (version === null) return
      element.addEventListener('input', listener)
      element.addEventListener('change', listener)
    },
  ])

  return {
    update(type, props) {
      if (version === null) return
      value = type !== 'progress' && 'value' in element ? props.value : undefined
      checked = 'checked' in element ? props.checked : undefined
      version++
      if (element instanceof HTMLSelectElement) {
        if (value === undefined) controlledSelectValues.delete(element)
        else {
          controlledSelectValues.set(element, value)
          setSelectValue(element, value)
        }
      }
    },
    dispose(detach) {
      if (detach) {
        element.removeEventListener('input', listener)
        element.removeEventListener('change', listener)
      }
      version = null
      if (element instanceof HTMLSelectElement) controlledSelectValues.delete(element)
    },
  }
}

export function restoreAncestorSelect(parent: ParentNode): void {
  let select = parent instanceof Element ? parent.closest('select') : null
  if (select instanceof HTMLSelectElement) {
    let value = controlledSelectValues.get(select)
    if (value !== undefined) setSelectValue(select, value)
  }
}

function resolveNodeMixProps(
  node: HostNode | CommittedHostNode,
  parent: VNodeParent,
  frame: FrameHandle,
  scheduler: Scheduler,
  state?: MixinRuntime,
): RuntimeHostProps {
  let mix = node.props.mix
  let direct: OnMixinDescriptor[] | null = !mix
    ? EMPTY_DIRECT_EVENTS
    : Array.isArray(mix)
      ? mix.every((d) => DIRECT_EVENT in d.type)
        ? (mix as unknown as OnMixinDescriptor[])
        : null
      : DIRECT_EVENT in (mix as { type: object }).type
        ? [mix as unknown as OnMixinDescriptor]
        : null

  let props = node.props
  if (direct) {
    state?.teardown()
    state = undefined
  } else {
    if (!state) {
      let list = Array.isArray(mix) ? mix : [mix]
      let Ctor: typeof MixinRuntime | undefined
      for (let d of list) {
        Ctor = (d.type as Record<PropertyKey, typeof MixinRuntime | undefined>)[MIXIN_RUNTIME]
        if (Ctor) break
      }
      Ctor ??= defaultMixinRuntime as typeof MixinRuntime | undefined
      invariant(Ctor, 'Invalid mix prop')
      state = new Ctor(node.type, frame, scheduler, (type: Component | string | symbol) =>
        typeof type === 'function' ? findContextFromAncestry(parent, type) : undefined,
      )
    }
    props = state.resolve(node.type, props)
  }
  node._mixState = state
  node._directEventDescriptors = direct ?? undefined
  let nonceManager = (frame.$runtime as OptionalFrameRuntime | undefined)?.nonceManager
  return (node._mixedProps = nonceManager
    ? nonceManager.resolveResourceNonce(node.type, props, parent)
    : props)
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
      let prev = node._mixedProps
      let next = resolveNodeMixProps(node, node._parent, this.frame, this.scheduler, state)
      patchHostProps(prev, next, this.node)
      syncHostControls(node, this.scheduler)
      if (this.node.parentNode) restoreAncestorSelect(this.node.parentNode)
      state?.dispatchUpdate('commit')
      done(state ? state.lifetime : AbortSignal.abort())
    },
  ])
}

function bindNodeMixRuntime(
  node: CommittedHostNode,
  context: ReconcileContext,
  reclaimed = false,
  parent?: ParentNode,
) {
  let state = node._mixState
  if (!state) return
  let domParent = parent ?? node._dom.parentNode
  invariant(domParent, 'Expected mounted host node to have a DOM parent')
  state.bind(
    {
      node: node._dom,
      parent: domParent,
      key: node.key,
      target: node,
      frame: context.frame,
      scheduler: context.scheduler,
      enqueueUpdate: enqueueMixinBindingUpdate,
    },
    reclaimed,
  )
}

function syncDirectEventListeners(
  node: CommittedHostNode,
  descriptors?: OnMixinDescriptor[],
  detach = true,
): void {
  let count = descriptors?.length ?? 0
  if (!count && !node._directEventState) return
  let bindings = (node._directEventState ??= [])
  if (descriptors) {
    for (let i = 0; i < count; i++) {
      let descriptor = descriptors[i]
      let binding = bindings[i]
      if (binding) binding.update(node._dom, descriptor.args, true)
      else {
        let Ctor = (descriptor.type as unknown as Record<PropertyKey, typeof OnBinding>)[DIRECT_EVENT]
        ;(bindings[i] = new Ctor(descriptor.args)).attach(node._dom)
      }
    }
  }
  for (let i = count; i < bindings.length; i++) {
    if (detach) bindings[i].detach(node._dom)
    bindings[i].abort()
  }
  if (count) bindings.length = count
  else node._directEventState = undefined
}

function syncHostControls(node: CommittedHostNode, scheduler: Scheduler): void {
  syncDirectEventListeners(node, node._directEventDescriptors)
  let props = node._mixedProps
  if (node._controlledState || props.value !== undefined || props.checked !== undefined) {
    ;(node._controlledState ??= createControlledState(node, scheduler)).update(node.type, props)
  }
}

export function diffVNodes(
  curr: CommittedVNode | null,
  next: VNodeInput,
  domParent: ParentNode,
  vParent: VNodeParent,
  context: ReconcileContext,
  anchor?: Node | null,
  cursor?: HydrationCursor,
): CommittedVNode {
  if (context._pendingPortals !== undefined) {
    return reconcileVNodes(curr, next, domParent, vParent, context, anchor, cursor)
  }
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

export function replace(
  curr: CommittedVNode,
  next: VNodeInput,
  domParent: ParentNode,
  vParent: VNodeParent,
  context: ReconcileContext,
  anchor?: Node | null,
): CommittedVNode {
  let first = findEdgeDomNode(curr, false)
  let marker: Comment | undefined
  if (first?.parentNode === domParent) {
    marker = document.createComment('rmx:replace')
    domParent.insertBefore(marker, first)
    anchor = marker
  } else {
    anchor = findNextSiblingDomAnchor(curr, anchor)
  }
  try {
    remove(curr, domParent, context)
    return reconcileVNodes(null, next, domParent, vParent, context, anchor)
  } finally {
    marker?.remove()
  }
}

export function reconcileVNodes(
  curr: CommittedVNode | null,
  node: VNodeInput,
  domParent: ParentNode,
  vParent: VNodeParent,
  context: ReconcileContext,
  fragmentEnd?: Node | null,
  cursor?: HydrationCursor,
): CommittedVNode {
  let anchor = fragmentEnd ?? undefined
  let isEntry = (type: unknown) =>
    typeof type === 'function' && (type as { $entry?: boolean }).$entry === true

  if (curr) {
    if (curr.kind === 'client-entry' && node.kind === 'component' && isEntry(node.type)) {
      return renderClientEntryBoundary(
        node,
        vParent,
        curr._svg,
        curr._rangeStart,
        curr._rangeEnd,
        context,
      )
    }
    if (
      (componentStalenessCheck &&
        curr.kind === 'component' &&
        node.kind === 'component' &&
        componentStalenessCheck(curr.type) === true) ||
      curr.kind !== node.kind ||
      curr.type !== node.type
    ) {
      return replace(curr, node, domParent, vParent, context, fragmentEnd)
    }
  }

  let { frame } = context
  let svg =
    node.kind === 'host'
      ? node.type === 'svg'
        ? true
        : node.type === 'foreignObject'
          ? false
          : vParent._svg
      : vParent._svg
  let linked = node as unknown as MountedNodeBase
  linked._parent = vParent
  linked._svg = svg

  if (!curr && cursor) {
    let hydrationNode = nextHydrationNode(
      cursor.current ?? null,
      node.kind !== 'host' && node.kind !== 'frame' && (node.kind !== 'text' || node._text === ''),
      anchor,
    )
    cursor.current = hydrationNode
    if (
      vParent.kind !== 'root' &&
      node.kind === 'component' &&
      isEntry(node.type) &&
      hydrationNode?.nodeType === 8
    ) {
      let end = (frame.$runtime as OptionalFrameRuntime | undefined)?.clientEntries?.getEnd(
        hydrationNode as Comment,
      )
      if (end) {
        let committed = renderClientEntryBoundary(
          node,
          vParent,
          svg,
          hydrationNode as Comment,
          end,
          context,
        )
        cursor.current = end.nextSibling
        return committed
      }
    }
  }

  switch (node.kind) {
    case 'empty':
      return node as unknown as CommittedNonRenderNode
    case 'text':
      return reconcileText(curr?.kind === 'text' ? curr : null, node, domParent, anchor, cursor)
    case 'host':
      return reconcileHost(curr?.kind === 'host' ? curr : null, node, domParent, vParent, context, svg, anchor, cursor)
    case 'fragment': {
      let childInputs = node._children
      let childAnchor = anchor
      if (curr) {
        let last = findEdgeDomNode(curr, true)
        childAnchor =
          last?.parentNode === domParent
            ? (last.nextSibling ?? undefined)
            : (findNextSiblingDomAnchor(curr, fragmentEnd) ?? undefined)
      }
      let committed = node as unknown as CommittedFragmentNode
      committed._children = EMPTY_CHILDREN
      committed._children = diffChildren(
        curr?.kind === 'fragment' ? curr._children : null,
        childInputs,
        domParent,
        committed,
        context,
        curr ? undefined : cursor,
        childAnchor,
      )
      return committed
    }
    case 'component': {
      let handle: ComponentHandle
      if (!curr) {
        let componentId = vParent.kind === 'root' ? vParent._pendingHydrationComponentId : undefined
        if (componentId && vParent.kind === 'root') vParent._pendingHydrationComponentId = undefined
        else componentId = `c${++idCounter}`
        handle = createComponent({
          id: componentId,
          frame,
          type: node.type,
          getContext: (type: ElementFunction) => findContextFromAncestry(vParent, type),
          frames: {
            get top() {
              return (frame.$runtime as OptionalFrameRuntime | undefined)?.topFrame ?? frame
            },
            get(name) {
              return (frame.$runtime as OptionalFrameRuntime | undefined)?.registry?.get(name)
            },
          },
        })
      } else {
        handle = (curr as CommittedComponentNode)._handle
      }
      let mounting = node as unknown as MountingComponentNode
      mounting._handle = handle
      mounting._context = context
      return renderComponent(
        curr ? (curr as CommittedComponentNode)._content : null,
        mounting,
        domParent,
        context,
        fragmentEnd,
        cursor,
      )
    }
    case 'portal':
      return node.type[PORTAL_NODE].reconcile(
        curr?.kind === 'portal' ? curr : null,
        node,
        domParent,
        vParent,
        context,
        fragmentEnd,
      )
    case 'frame':
      if (curr?.kind === 'frame') {
        if (fragmentEnd === undefined) anchor = findNextSiblingDomAnchor(curr) ?? undefined
        return node.type[FRAME_NODE].diff(curr, node, domParent, vParent, context, svg, anchor)
      }
      return node.type[FRAME_NODE].insert(node, domParent, vParent, context, svg, anchor, cursor)
  }
}

function isHeadTag(type: string): boolean {
  return type.length === 4 && type.toLowerCase() === 'head'
}

function getDocumentHead(domParent: ParentNode): HTMLHeadElement | null {
  return domParent instanceof Document
    ? domParent.head
    : domParent instanceof Node
      ? (domParent.ownerDocument?.head ?? null)
      : null
}

function reconcileHost(
  curr: CommittedHostNode | null,
  node: HostNode,
  domParent: ParentNode,
  vParent: VNodeParent,
  context: ReconcileContext,
  svg: boolean,
  anchor: Node | undefined,
  cursor: HydrationCursor | undefined,
): CommittedHostNode {
  let { frame, scheduler } = context
  let reclaimed = false

  if (!curr && node.key != null) {
    let targetHead = isHeadTag(node.type) ? getDocumentHead(domParent) : null
    if (!targetHead) {
      for (let persisted of persistedMixinNodes) {
        if (
          persisted._persistence?.parent === domParent &&
          persisted.type === node.type &&
          persisted.key === node.key &&
          portalRanges?.ownerOf(persisted._parent) === portalRanges?.ownerOf(vParent)
        ) {
          persisted._mixState?.cancelRemoval()
          persisted._persistence = undefined
          persistedMixinNodes.delete(persisted)
          curr = persisted
          reclaimed = true
          break
        }
      }
    }
  }

  let resolved = resolveNodeMixProps(node, vParent, frame, scheduler, curr?._mixState)
  let childInputs = node._children

  if (curr) {
    let dom = curr._dom
    let prevProps = curr._mixedProps
    let mixins = node._mixState
    let dispatchInline = (reclaimed || mixins?.hasSlots) && shouldDispatchInlineMixinLifecycle(dom)
    if (dispatchInline) mixins?.dispatchUpdate('beforeUpdate')

    let committed = node as unknown as CommittedHostNode
    committed._dom = dom
    committed._children = EMPTY_CHILDREN
    committed._directEventState = curr._directEventState
    committed._controlledState = curr._controlledState
    if (reclaimed) {
      patchHostProps(prevProps, resolved, dom)
      syncHostControls(committed, scheduler)
    }
    if (prevProps.innerHTML != resolved.innerHTML) {
      let html = resolved.innerHTML ?? ''
      if (portalRanges?.has(dom)) portalRanges.setInnerHTML(dom, html)
      else dom.innerHTML = html
    }
    committed._children = diffChildren(curr._children, childInputs, dom, committed, context)
    if (!reclaimed) {
      patchHostProps(prevProps, resolved, dom)
      syncHostControls(committed, scheduler)
    }
    bindNodeMixRuntime(committed, context, reclaimed)
    if (reclaimed ? shouldDispatchInlineMixinLifecycle(dom) : dispatchInline) {
      scheduler.enqueueCommitPhase([
        () => (reclaimed ? committed._mixState : mixins)?.dispatchUpdate('commit'),
      ])
    }
    return committed
  }

  let hydrationNode = cursor?.current
  let dom: Element | undefined
  let childCursor: HydrationCursor | undefined
  let shouldInsertDom = false
  let bindParent: ParentNode | undefined

  if (isHeadTag(node.type)) {
    let targetHead = getDocumentHead(domParent)
    if (targetHead) {
      childCursor = cursor ? { current: hydrationNode } : undefined
      if (hydrationNode instanceof Element && hydrationNode.tagName.toLowerCase() === 'head') {
        if (childCursor) childCursor.current = hydrationNode.firstChild
        let nextCursor = hydrationNode.nextSibling
        if (hydrationNode !== targetHead) {
          while (hydrationNode.firstChild) targetHead.appendChild(hydrationNode.firstChild)
          hydrationNode.remove()
        }
        if (cursor) cursor.current = nextCursor
      }
      let committed = node as unknown as CommittedHostNode
      committed._dom = targetHead
      committed._children = diffChildren(null, childInputs, targetHead, committed, context, childCursor)
      patchHostProps({}, resolved, targetHead)
      syncHostControls(committed, scheduler)
      bindNodeMixRuntime(committed, context)
      return committed
    }
  }

  if (hydrationNode instanceof Element) {
    let tagOf = (el: Element) => (svg ? el.tagName : el.tagName.toLowerCase())
    let cursorTag = tagOf(hydrationNode)
    let match: Element | null = cursorTag === node.type ? hydrationNode : null
    if (!match) {
      let nextSibling = nextHydrationNode(hydrationNode.nextSibling, false, anchor)
      if (nextSibling instanceof Element && tagOf(nextSibling) === node.type) match = nextSibling
    }
    if (match) {
      dom = match
      childCursor = { current: match.firstChild }
      if (cursor) cursor.current = match.nextSibling
    } else {
      console.error('Hydration mismatch:', 'tag', cursorTag, node.type)
      if (cursor) cursor.current = undefined
    }
  }

  if (!dom) {
    dom = svg ? document.createElementNS(SVG_NS, node.type) : document.createElement(node.type)
    shouldInsertDom = true
    bindParent = domParent
  }

  let hydratedProps = resolved
  let editedBeforeHydration: 'value' | 'checked' | undefined
  if (childCursor) {
    if (dom instanceof HTMLOptionElement) hydratedProps = { ...resolved, selected: undefined }
    if (dom instanceof HTMLInputElement && (dom.type === 'checkbox' || dom.type === 'radio')) {
      if (dom.checked !== dom.defaultChecked) editedBeforeHydration = 'checked'
    } else if (
      (dom instanceof HTMLInputElement || dom instanceof HTMLTextAreaElement) &&
      dom.value !== dom.defaultValue
    ) {
      let pristine = dom.cloneNode() as HTMLInputElement | HTMLTextAreaElement
      pristine.value = dom.defaultValue
      if (pristine.value !== dom.value) editedBeforeHydration = 'value'
    }
    if (editedBeforeHydration) {
      hydratedProps = { ...hydratedProps, [editedBeforeHydration]: undefined }
    }
  }

  patchHostProps({}, hydratedProps, dom)
  let committed = node as unknown as CommittedHostNode
  committed._dom = dom
  committed._children = EMPTY_CHILDREN
  if (resolved.innerHTML != null) {
    dom.innerHTML = resolved.innerHTML
  } else {
    committed._children = diffChildren(null, childInputs, dom, committed, context, childCursor)
  }

  if (!childCursor) {
    if (dom instanceof HTMLSelectElement) {
      let value = resolved.value ?? resolved.defaultValue
      if (value != null) {
        setSelectDefaultValue(dom, value, !dom.multiple || (resolved.value != null && !Array.isArray(value)))
      }
    } else if (dom instanceof HTMLOptionElement) {
      dom.defaultSelected = resolved.selected === '' || Boolean(resolved.selected)
    }
  }

  syncHostControls(committed, scheduler)
  bindNodeMixRuntime(committed, context, false, bindParent)

  if (editedBeforeHydration) {
    let el = dom
    scheduler.enqueueTasks([
      () => {
        if (!el.isConnected) return
        if (el instanceof HTMLInputElement && el.type === 'radio' && !el.checked) return
        el.dispatchEvent(new Event('input', { bubbles: true }))
        if (
          el.ownerDocument.activeElement !== el ||
          (el instanceof HTMLInputElement && /^(?:checkbox|radio|range|color|file)$/.test(el.type))
        ) {
          el.dispatchEvent(new Event('change', { bubbles: true }))
        }
      },
    ])
  }

  if (shouldInsertDom) insertDomNode(dom, domParent, anchor)
  return committed
}

function reconcileText(
  curr: CommittedTextNode | null,
  node: TextNode,
  domParent: ParentNode,
  anchor: Node | undefined,
  cursor: HydrationCursor | undefined,
): CommittedTextNode {
  let hydrationNode = cursor?.current
  let text = node._text
  let dom: Text
  if (curr) {
    dom = curr._dom
    if (curr._text !== text) dom.data = text
  } else if (hydrationNode instanceof Text) {
    dom = hydrationNode
    if (dom.data !== text) {
      if (dom.data.startsWith(text)) {
        dom.splitText(text.length)
      } else {
        if (text.startsWith(dom.data)) {
          let remainder = text.slice(dom.length)
          let sibling = dom.nextSibling
          while (remainder && sibling !== anchor && sibling instanceof Text) {
            if (!remainder.startsWith(sibling.data)) {
              if (sibling.data.startsWith(remainder)) sibling.deleteData(0, remainder.length)
              break
            }
            remainder = remainder.slice(sibling.length)
            sibling.remove()
            sibling = dom.nextSibling
          }
        } else {
          console.error('Hydration mismatch:', 'text mismatch', dom.data, text)
        }
        dom.data = text
      }
    }
    if (cursor) cursor.current = dom.nextSibling
  } else {
    dom = document.createTextNode(text)
    insertDomNode(dom, domParent, hydrationNode?.parentNode === domParent ? hydrationNode : anchor)
  }
  let committed = node as unknown as CommittedTextNode
  committed._dom = dom
  return committed
}

function removeDomRange(start: Node, end: Node, domParent: ParentNode): void {
  let cursor: Node | null = start
  while (cursor) {
    let next: Node | null = cursor.nextSibling
    if (cursor.parentNode === domParent) domParent.removeChild(cursor)
    if (cursor === end) break
    cursor = next
  }
}

function nextHydrationNode(
  cursor: Node | null,
  preserveClientEntry: boolean,
  anchor?: Node,
): Node | null {
  while (cursor && cursor !== anchor) {
    if (cursor.nodeType === 8) {
      let portalEnd = portalRanges?.ends.get(cursor)
      if (portalEnd) {
        cursor = portalEnd.nextSibling
        continue
      }
      let data = (cursor as Comment).data.trim()
      if (data.startsWith('rmx:f:') || (preserveClientEntry && data.startsWith('rmx:h:'))) {
        return cursor
      }
      cursor = cursor.nextSibling
      continue
    }
    if (cursor.nodeType === 1 && (cursor as Element).hasAttribute('data-rmx-style')) {
      cursor = cursor.nextSibling
      continue
    }
    break
  }
  return cursor === anchor ? null : cursor
}

export function renderComponent(
  currContent: CommittedVNode | null,
  next: MountingComponentNode | CommittedComponentNode,
  domParent: ParentNode,
  context: ReconcileContext,
  anchor?: Node | null,
  cursor?: HydrationCursor,
): CommittedComponentNode {
  let { scheduler } = context
  let handle = next._handle
  if (handle.isRemoved()) {
    invariant('_content' in next, 'Expected removed component to be committed')
    return next
  }
  let [element, tasks] = handle.render(next.props)
  let committed = next as CommittedComponentNode
  committed._content = diffVNodes(currContent, toVNode(element), domParent, next, context, anchor, cursor)
  handle.setScheduleUpdate(scheduler, committed, domParent)
  restoreAncestorSelect(domParent)
  scheduler.enqueueTasks(tasks)
  return committed
}

function renderClientEntryBoundary(
  node: ComponentNode,
  parent: VNodeParent,
  svg: boolean,
  start: Comment,
  end: Comment,
  context: ReconcileContext,
): CommittedClientEntryNode {
  let committed: CommittedClientEntryNode = {
    kind: 'client-entry',
    type: node.type,
    key: node.key,
    props: node.props,
    _parent: parent,
    _svg: svg,
    _rangeStart: start,
    _rangeEnd: end,
  }
  ;(context.frame.$runtime as OptionalFrameRuntime | undefined)?.clientEntries?.render(
    start,
    end,
    jsx(node.type, node.props, node.key),
    parent,
  )
  return committed
}

export function remove(
  node: CommittedVNode,
  domParent: ParentNode | null,
  context: ReconcileContext,
): void {
  switch (node.kind) {
    case 'text':
      if (domParent) node._dom.remove()
      return
    case 'host': {
      if (domParent) {
        if (node._persistence) return
        let persisted = node._mixState?.prepareRemoval()
        if (persisted) {
          let token = ++persistedRemovalToken
          node._persistence = { parent: domParent, token }
          persistedMixinNodes.add(node)
          node._mixState?.bind()
          void persisted
            .catch(() => {})
            .finally(() => {
              if (node._persistence?.token !== token) return
              node._persistence = undefined
              persistedMixinNodes.delete(node)
              performHostNodeRemoval(node, domParent, context)
              portalRanges?.finishRemovals(domParent)
            })
          return
        }
      }
      performHostNodeRemoval(node, domParent, context)
      return
    }
    case 'fragment':
      for (let child of node._children) remove(child, domParent, context)
      return
    case 'component':
      remove(node._content, domParent, context)
      context.scheduler.enqueueTasks(node._handle.remove())
      return
    case 'client-entry': {
      let disposed =
        (context.frame.$runtime as OptionalFrameRuntime | undefined)?.clientEntries?.dispose(
          node._rangeStart,
        ) ?? false
      if (!domParent) return
      if (disposed) {
        node._rangeStart.remove()
        node._rangeEnd.remove()
      } else {
        removeDomRange(node._rangeStart, node._rangeEnd, domParent)
      }
      return
    }
    case 'portal':
      node.type[PORTAL_NODE].dispose(node, context)
      return
    case 'frame':
      node.type[FRAME_NODE].dispose(node)
      if (domParent) removeDomRange(node._rangeStart, node._rangeEnd, domParent)
      return
  }
}

function performHostNodeRemoval(
  node: CommittedHostNode,
  domParent: ParentNode | null,
  context: ReconcileContext,
): void {
  let isHead = domParent !== null && isHeadTag(node.type)
  for (let child of node._children) remove(child, isHead ? node._dom : null, context)
  node._mixState?.teardown()
  syncDirectEventListeners(node, undefined, isHead)
  node._controlledState?.dispose(isHead)
  if (domParent && !isHead) node._dom.remove()
}

export function diffChildren(
  curr: CommittedVNode[] | null,
  next: VNodeInput[],
  domParent: ParentNode,
  vParent: VNodeParent,
  context: ReconcileContext,
  cursor?: HydrationCursor,
  anchor?: Node,
): CommittedVNode[] {
  if (
    !next.length &&
    curr?.length &&
    anchor === undefined &&
    vParent.kind !== 'fragment' &&
    !portalRanges?.has(domParent) &&
    !(vParent.kind === 'host' && vParent._mixedProps.innerHTML != null) &&
    curr.every(canBulkClearNode)
  ) {
    for (let child of curr) remove(child, null, context)
    domParent.textContent = ''
    return EMPTY_CHILDREN
  }

  let hasKeys = next.some((child) => child.key != null)
  if (hasKeys) {
    if (curr) {
      let inOrder = curr.length === next.length
      for (let i = 0; inOrder && i < next.length; i++) {
        if (next[i].key == null || curr[i].key !== next[i].key || curr[i].type !== next[i].type) {
          inOrder = false
        }
      }
      if (!inOrder) return patchKeyedChildren(curr, next, domParent, vParent, context, cursor, anchor)
    } else if (vParent.kind !== 'fragment') {
      warnDuplicateKeys(next)
    }
  }

  curr ??= EMPTY_CHILDREN
  let committed: Array<VNodeInput | CommittedVNode> = next
  for (let i = 0; i < next.length; i++) {
    committed[i] = reconcileVNodes(
      curr[i] ?? null,
      next[i],
      domParent,
      vParent,
      context,
      anchor ?? null,
      cursor,
    )
  }
  for (let i = next.length; i < curr.length; i++) remove(curr[i], domParent, context)
  return committed as CommittedVNode[]
}

function canBulkClearNode(node: CommittedVNode): boolean {
  if (node.kind === 'component') return canBulkClearNode(node._content)
  if (node.kind === 'host' || node.kind === 'fragment') {
    return (node.kind !== 'host' || !node._mixState) && node._children.every(canBulkClearNode)
  }
  return node.kind === 'text'
}

function warnDuplicateKeys(children: Array<{ key?: Key }>): void {
  let seen = new Set<Key>()
  let dups: Set<Key> | undefined
  for (let node of children) {
    if (node.key == null) continue
    if (seen.has(node.key)) (dups ??= new Set()).add(node.key)
    else seen.add(node.key)
  }
  if (dups?.size) {
    console.warn(
      `Duplicate keys detected in siblings: ${Array.from(dups, (k) => `"${String(k)}"`).join(', ')}. Keys should be unique.`,
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
  warnDuplicateKeys(next)

  let oldKeys = new Map<Key, number>()
  let lastUnkeyed = new Map<CommittedVNode['type'], number>()
  for (let i = 0; i < curr.length; i++) {
    let key = curr[i].key
    if (key != null) oldKeys.set(key, i)
    else lastUnkeyed.set(curr[i].type, i)
  }

  let nextUnkeyed = 0
  let inserted = 0
  let lastOldIndex = -1
  let needsPlacement = false
  let usedOld = new Uint8Array(curr.length)
  let matches: number[] = []

  for (let i = 0; i < next.length; i++) {
    let { key, type } = next[i]
    let oldIndex = -1
    if (key != null) {
      let candidate = oldKeys.get(key)
      if (candidate !== undefined && curr[candidate].type === type) {
        oldKeys.delete(key)
        oldIndex = candidate
      }
    } else if ((lastUnkeyed.get(type) ?? -1) >= nextUnkeyed) {
      for (let j = nextUnkeyed; j < curr.length; j++) {
        if (curr[j].key == null && curr[j].type === type) {
          nextUnkeyed = j + 1
          oldIndex = j
          break
        }
      }
    }
    matches[i] = oldIndex
    if (oldIndex < 0) {
      inserted++
    } else {
      usedOld[oldIndex] = 1
      if (inserted > 0 || oldIndex < lastOldIndex) needsPlacement = true
      lastOldIndex = oldIndex
    }
  }

  if (matches.length - inserted < curr.length) {
    for (let i = 0; i < curr.length; i++) {
      if (!usedOld[i]) remove(curr[i], domParent, context)
    }
  }

  let stableIndexes = needsPlacement
    ? getStableIndexes(matches, (oldIndex) => !!findEdgeDomNode(curr[oldIndex], false))
    : null
  let stableCursor = 0
  let cachedStableIndex = -1
  let stableAnchor: Node | undefined
  let committed: Array<VNodeInput | CommittedVNode> = next

  for (let i = 0; i < next.length; i++) {
    let oldIndex = matches[i]
    let oldNode = oldIndex < 0 ? null : curr[oldIndex]
    let insertAnchor = anchor
    if (stableIndexes) {
      let nextStable = stableIndexes[stableCursor]
      if (i === nextStable) {
        stableCursor++
      } else if (!oldNode && !cursor && nextStable !== undefined) {
        if (cachedStableIndex !== nextStable) {
          cachedStableIndex = nextStable
          stableAnchor = findEdgeDomNode(curr[matches[nextStable]], false) ?? anchor
        }
        insertAnchor = stableAnchor
      }
    }
    committed[i] = reconcileVNodes(
      oldNode,
      next[i],
      domParent,
      vParent,
      context,
      insertAnchor ?? null,
      cursor,
    )
  }

  let result = committed as CommittedVNode[]
  if (!stableIndexes) return result

  stableCursor = stableIndexes.length - 1
  let placementAnchor: Node | null = anchor ?? null
  for (let i = next.length - 1; i >= 0; i--) {
    let nextNode = result[i]
    if (stableIndexes[stableCursor] === i) stableCursor--
    else placeVNode(nextNode, domParent, placementAnchor)
    placementAnchor = findEdgeDomNode(nextNode, false) ?? placementAnchor
  }
  return result
}

// Return positions of the longest increasing subsequence of reusable old indexes.
export function getStableIndexes(
  matches: readonly number[],
  hasAnchor?: (oldIndex: number) => boolean,
): number[] {
  let predecessors: number[] = []
  let tails: number[] = []
  for (let i = 0; i < matches.length; i++) {
    let value = matches[i]
    if (value < 0 || (hasAnchor && !hasAnchor(value))) continue
    let high = tails.length
    let low = high > 1 && matches[tails[high - 1]] < value ? high : 0
    while (low < high) {
      let mid = (low + high) >> 1
      if (matches[tails[mid]] < value) low = mid + 1
      else high = mid
    }
    if (low) predecessors[i] = tails[low - 1]
    tails[low] = i
  }
  let cursor = tails[tails.length - 1]
  for (let i = tails.length - 1; i >= 0; i--) {
    tails[i] = cursor
    cursor = predecessors[cursor]
  }
  return tails
}

function placeVNode(node: CommittedVNode, domParent: ParentNode, anchor: Node | null): void {
  let first = findEdgeDomNode(node, false)
  let last = first && first.parentNode === domParent ? findEdgeDomNode(node, true) : null
  if (!first || !last || last.nextSibling === anchor) return
  if (anchor) {
    for (let cur: Node | null = first; cur; cur = cur.nextSibling) {
      if (cur === anchor) return
      if (cur === last) break
    }
  }
  let ends = portalRanges?.has(domParent) ? portalRanges.ends : undefined
  for (let cur: Node | null = first; cur; ) {
    let portalEnd: Comment | undefined = ends?.get(cur)
    if (portalEnd) {
      cur = portalEnd.nextSibling
      continue
    }
    let next: Node | null = cur === last ? null : cur.nextSibling
    domParent.insertBefore(cur, anchor)
    if (cur === last) break
    cur = next
  }
}

function findEdgeDomNode(node: CommittedVNode | null | undefined, last: boolean): Node | null {
  if (!node) return null
  if (node.kind === 'text' || node.kind === 'host') return node._dom
  if (node.kind === 'component' && '_content' in node) return findEdgeDomNode(node._content, last)
  if (node.kind === 'client-entry' || node.kind === 'frame') {
    return last ? node._rangeEnd : node._rangeStart
  }
  if (node.kind === 'fragment') {
    let children = node._children
    for (let i = 0; i < children.length; i++) {
      let dom = findEdgeDomNode(children[last ? children.length - 1 - i : i], last)
      if (dom) return dom
    }
  }
  return null
}

function shouldDispatchInlineMixinLifecycle(node: Node): boolean {
  let parents = activeSchedulerUpdateParents
  if (!parents?.length) return true
  for (let parent of parents) {
    if (parent instanceof Node && parent.contains(node)) return false
  }
  return true
}

function findNextSiblingDomAnchor(
  curr: CommittedVNode | MountingComponentNode,
  fragmentEnd?: Node | null,
): Node | null {
  let vParent = curr._parent
  if (vParent.kind === 'component') return findNextSiblingDomAnchor(vParent, fragmentEnd)
  let children = vParent._children
  let idx = children.indexOf(curr as CommittedVNode)
  if (idx === -1 && children.length > 0) return fragmentEnd ?? null
  for (let i = idx + 1; i < children.length; i++) {
    let dom = findEdgeDomNode(children[i], false)
    if (dom?.parentNode) return dom
  }
  if (vParent.kind === 'fragment') {
    return fragmentEnd === undefined ? findNextSiblingDomAnchor(vParent) : fragmentEnd
  }
  if (vParent.kind === 'root' || vParent.kind === 'portal') {
    return vParent._rangeEnd ?? fragmentEnd ?? null
  }
  return fragmentEnd ?? null
}
