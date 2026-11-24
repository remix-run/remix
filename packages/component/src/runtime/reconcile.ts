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
import { isEntry, logHydrationMismatch } from './client-entries.ts'
import type { Scheduler } from './vdom.ts'
import {
  MixinRuntime,
  isMixinDescriptor,
  type MixinRuntimeBinding,
  type MixinRuntimeValue,
} from './mixins/mixin.ts'
import { OnBinding, isOnMixinDescriptor, type OnMixinDescriptor } from './mixins/on-mixin.ts'
import { componentStalenessCheck } from './refresh.ts'
import {
  isCommentNode,
  isFrameEnd,
  isFrameStart,
  isHydrationEnd,
  isHydrationStart,
} from './stream-protocol.ts'
import { createStyleManager } from '../style/stylesheet.ts'
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

export type NonRenderNode = InputNodeBase<'empty', false>

export type TextNode = InputNodeBase<'text', null> & {
  _text: string
}

export type FragmentNode = InputNodeBase<'fragment', typeof Fragment> & {
  _children: VNodeInput[]
}

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

export type CommittedNonRenderNode = CommittedNodeBase<'empty', false>

export type CommittedTextNode = CommittedNodeBase<'text', null> & {
  _text: string
  _dom: Text
}

export type HostPersistenceState = {
  parent: ParentNode
  token: number
}

export type CommittedHostNode = CommittedNodeBase<'host', string> &
  HostMixState & {
    props: RuntimeHostProps
    _children: CommittedVNode[]
    _dom: Element
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

export function isCommittedComponentNode(node: VNode): node is CommittedComponentNode {
  return node.kind === 'component' && '_content' in node
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

function childrenToVNodes(children: RemixNode, hostChild = true): VNodeInput[] {
  if (children === undefined) return []
  if (!Array.isArray(children)) return [toVNode(children, hostChild)]
  let result: VNodeInput[] = []
  for (let child of normalizeChildren(children)) result.push(toVNode(child, hostChild))
  return result
}

export function toVNode(node: unknown, hostChild = false): VNodeInput {
  if (isEmptyChild(node)) {
    return { kind: 'empty', type: false }
  }

  if (isPrimitiveChild(node)) {
    return { kind: 'text', type: null, _text: String(node) }
  }

  if (isRemixElement(node)) {
    let { type, props, key } = node
    if (type === Fragment) {
      let hostProps = parseHostProps(props)
      return {
        kind: 'fragment',
        type: Fragment,
        key,
        _children: childrenToVNodes(hostProps.children),
      }
    }

    if (typeof type === 'string') {
      let hostProps = parseHostProps(props)
      let children: VNodeInput[]
      if (hostProps.innerHTML != null) {
        // Raw HTML replaces the children. Validate them without creating unused vnodes.
        invariant(isRemixNode(hostProps.children), 'Invalid host children')
        children = []
      } else {
        children = childrenToVNodes(hostProps.children)
      }
      return {
        kind: 'host',
        type,
        key,
        props: hostProps,
        _children: children,
      }
    }
    invariant(isElementFunction(type), 'Expected component element type')
    if (type === Portal) {
      let hostProps = parseHostProps(props)
      invariant(isRemixNode(hostProps.children), 'Invalid host children')
      let container: PortalProps['container'] = props.container
      // Adoption changes ownerDocument without changing the element's prototype, so avoid
      // instanceof checks against either window's HTMLElement constructor.
      invariant(
        container === undefined ||
          (container?.nodeType === Node.ELEMENT_NODE &&
            container.namespaceURI === 'http://www.w3.org/1999/xhtml'),
        'Portal container must be an HTMLElement',
      )
      return { kind: 'portal', type: Portal, key, props: { ...hostProps, container } }
    }
    if (isFrameComponent(type)) {
      invariant(isFrameProps(props), '<Frame /> requires a src prop')
      return { kind: 'frame', type, key, props }
    }
    return { kind: 'component', type, key, props }
  }

  if (Array.isArray(node)) {
    return { kind: 'fragment', type: Fragment, _children: childrenToVNodes(node, hostChild) }
  }

  invariant(false, hostChild ? 'Invalid host children' : 'Unexpected RemixNode')
}

function isFrameProps(props: RuntimeElementProps): props is RuntimeElementProps & FrameProps {
  return typeof props.src === 'string' && props.src.length > 0
}

function parseHostProps(props: RuntimeElementProps): RuntimeHostProps {
  let normalizedProps = normalizeUnsafeHTMLProps(props)

  let mix = normalizedProps.mix
  invariant(mix === undefined || isRuntimeMixValue(mix), 'Invalid mix prop')
  return normalizedProps
}

function isRuntimeMixValue(value: unknown): value is RuntimeHostProps['mix'] {
  return Array.isArray(value) ? allDescriptors(value, isMixinDescriptor) : isMixinDescriptor(value)
}

function allDescriptors<descriptor>(
  values: unknown[],
  matches: (value: unknown) => value is descriptor,
): values is descriptor[] {
  for (let value of values) {
    if (!matches(value)) return false
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
  // A newer event or render cancels queued work. A removed node cannot attach or restore.
  #version: number | null = 0
  #value: unknown
  #checked: unknown
  #select: boolean

  constructor(node: CommittedHostNode, scheduler: Scheduler) {
    let element = (this.#element = node._dom)
    this.#select = node.type === 'select'
    scheduler.enqueueTasks([
      () => {
        if (this.#version === null) return
        element.addEventListener('input', this)
        element.addEventListener('change', this)
      },
    ])
  }

  update(type: string, props: RuntimeHostProps) {
    if (this.#version === null) return
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
    if (this.#version === null) return
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
    if (detach) {
      element.removeEventListener('input', this)
      element.removeEventListener('change', this)
    }
    this.#version = null
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

function resolveNodeMixProps(
  node: HostNode | CommittedHostNode,
  parent: VNodeParent,
  frame: FrameHandle,
  scheduler: Scheduler,
  state?: MixinRuntime,
): RuntimeHostProps {
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
  node._mixState = state
  node._directEventDescriptors = directEventDescriptors ?? undefined
  return (node._mixedProps = getNonceManager().resolveResourceNonce(node.type, props, parent))
}

function resolveDirectEventDescriptors(mix: RuntimeHostProps['mix']): OnMixinDescriptor[] | null {
  if (!mix) return EMPTY_DIRECT_EVENT_DESCRIPTORS
  if (!Array.isArray(mix)) {
    return isOnMixinDescriptor(mix) ? [mix] : null
  }

  return allDescriptors(mix, isOnMixinDescriptor) ? mix : null
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
      patchHostProps(prevProps, resolved, this.node)
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
  if (domParent instanceof Document) return domParent.head
  return domParent instanceof Node ? (domParent.ownerDocument?.head ?? null) : null
}

// Input vnodes are owned by this render. Link them before their children read the ancestry.
function linkVNode(node: VNodeInput, parent: VNodeParent, svg: boolean): void {
  let mounted: Partial<MountedNodeBase> = node
  mounted._parent = parent
  mounted._svg = svg
}

function commitHostNode(node: HostNode, dom: Element): CommittedHostNode {
  let committed = node as unknown as CommittedHostNode
  committed._dom = dom
  committed._children = EMPTY_COMMITTED_CHILDREN
  return committed
}

function beginComponentNode(
  node: ComponentNode,
  handle: ComponentHandle,
  context: ReconcileContext,
): MountingComponentNode {
  let mounting = node as unknown as MountingComponentNode
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
  anchor?: Node | null,
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

function replace(
  curr: CommittedVNode,
  next: VNodeInput,
  domParent: ParentNode,
  vParent: VNodeParent,
  context: ReconcileContext,
  anchor?: Node | null,
): CommittedVNode {
  let first = findFirstDomAnchor(curr)
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

function diffHost(
  curr: CommittedHostNode,
  next: HostNode,
  vParent: VNodeParent,
  context: ReconcileContext,
  reclaimed = false,
): CommittedHostNode {
  let dom = curr._dom
  let { scheduler } = context
  let previous = curr._mixedProps
  let resolved = resolveNodeMixProps(next, vParent, context.frame, scheduler, curr._mixState)
  let mixins = next._mixState
  let dispatchInline = (reclaimed || mixins?.hasSlots) && shouldDispatchInlineMixinLifecycle(dom)
  if (dispatchInline) mixins?.dispatchUpdate('beforeUpdate')

  let children = next._children
  let committed = commitHostNode(next, dom)
  committed._directEventState = curr._directEventState
  committed._controlledState = curr._controlledState
  if (reclaimed) {
    // Restore listeners and controlled values before reconciling a returning host's children.
    patchHostProps(previous, resolved, dom)
    setupHostNode(committed, scheduler)
  }
  if (previous.innerHTML != resolved.innerHTML) {
    setHostInnerHTML(dom, resolved.innerHTML ?? '')
  }

  committed._children = diffChildren(curr._children, children, dom, committed, context)
  if (!reclaimed) {
    patchHostProps(previous, resolved, dom)
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
  syncDirectEventListeners(node, node._directEventDescriptors)
  syncControlledReflection(node, scheduler)
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
    for (let index = 0; index < descriptors.length; index++) {
      let descriptor = descriptors[index]
      let binding = bindings[index]
      if (binding) binding.update(node._dom, descriptor.args, true)
      else {
        binding = bindings[index] = new OnBinding(descriptor.args)
        binding.attach(node._dom)
      }
    }
  }
  for (let index = count; index < bindings.length; index++) {
    let binding = bindings[index]
    if (detach) binding.detach(node._dom)
    binding.abort()
  }
  if (count) bindings.length = count
  else node._directEventState = undefined
}

function mountHostNode(
  node: HostNode,
  hostProps: RuntimeHostProps,
  vParent: VNodeParent,
  dom: Element,
  context: ReconcileContext,
  childCursor?: HydrationCursor,
  parent?: ParentNode,
): CommittedHostNode {
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
  let committed = commitHostNode(node, dom)

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
  domParent.insertBefore(dom, anchor ?? null)
}

function reconcileVNodes(
  curr: CommittedVNode | null,
  node: VNodeInput,
  domParent: ParentNode,
  vParent: VNodeParent,
  context: ReconcileContext,
  fragmentEnd?: Node | null,
  cursor?: HydrationCursor,
): CommittedVNode {
  let anchor = fragmentEnd ?? undefined
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
      componentStalenessCheck !== null &&
      curr.kind === 'component' &&
      node.kind === 'component' &&
      componentStalenessCheck(curr.type) === true
    ) {
      return replace(curr, node, domParent, vParent, context, fragmentEnd)
    }

    if (curr.kind !== node.kind || curr.type !== node.type) {
      return replace(curr, node, domParent, vParent, context, fragmentEnd)
    }
  }

  let { frame } = context
  let svg = getSvgContext(vParent, node)
  linkVNode(node, vParent, svg)
  if (!curr && cursor) {
    // The anchor ends this hydration range. Leave client entry markers for the next
    // component to claim, including when empty text needs an inserted placeholder.
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
      isCommentNode(hydrationNode)
    ) {
      let runtime = getFrameRuntime(frame)
      let pending = runtime?.registry.entries.get(hydrationNode)
      let owner = getClientEntryBoundaryOwner(hydrationNode)
      let end = pending?.[0] ?? owner?.end
      if (end) {
        let committed = renderClientEntryBoundary(node, vParent, svg, hydrationNode, end, context)
        cursor.current = end.nextSibling
        return committed
      }
    }
  }

  if (node.kind === 'empty') {
    return node as unknown as CommittedNonRenderNode
  }

  if (node.kind === 'text') {
    return reconcileText(curr?.kind === 'text' ? curr : null, node, domParent, anchor, cursor)
  }
  if (node.kind === 'host') {
    if (curr?.kind === 'host') return diffHost(curr, node, vParent, context)
    return insertHost(node, domParent, vParent, context, svg, anchor, cursor)
  }

  if (node.kind === 'fragment') {
    let childInputs = node._children
    let childAnchor = anchor
    if (curr) {
      // Children belong at the end of this fragment, before its next sibling.
      let last = findLastDomAnchor(curr)
      childAnchor =
        last?.parentNode === domParent
          ? (last.nextSibling ?? undefined)
          : (findNextSiblingDomAnchor(curr, fragmentEnd) ?? undefined)
    }
    let committed = node as unknown as CommittedFragmentNode
    committed._children = EMPTY_COMMITTED_CHILDREN
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

  if (node.kind === 'component') {
    return diffComponent(
      curr?.kind === 'component' ? curr : null,
      node,
      domParent,
      vParent,
      context,
      fragmentEnd,
      cursor,
    )
  }

  if (node.kind === 'portal') {
    if (curr?.kind === 'portal')
      return diffPortal(curr, node, domParent, vParent, context, fragmentEnd)
    return insertPortal(node, domParent, vParent, context)
  }

  if (node.kind === 'frame') {
    if (curr?.kind === 'frame') {
      if (fragmentEnd === undefined) anchor = findNextSiblingDomAnchor(curr) ?? undefined
      return node.type[FRAME_NODE].diff(curr, node, domParent, vParent, context, svg, anchor)
    }
    return node.type[FRAME_NODE].insert(node, domParent, vParent, context, svg, anchor, cursor)
  }

  invariant(false, 'Unexpected node type')
}

function insertHost(
  node: HostNode,
  domParent: ParentNode,
  vParent: VNodeParent,
  context: ReconcileContext,
  svg: boolean,
  anchor: Node | undefined,
  cursor: HydrationCursor | undefined,
): CommittedHostNode {
  let hydrationNode = cursor?.current
  let { frame, scheduler } = context
  // A returning host already owns its mixins. Resolving fresh ones here would run setup twice.
  let persistedNode = findMatchingPersistedMixinNode(node.type, node.key, domParent, vParent)
  if (persistedNode && !(isHeadHostNode(node) && getDocumentHead(domParent))) {
    persistedNode._mixState?.cancelRemoval()
    unmarkNodePersistedByMixins(persistedNode)
    return diffHost(persistedNode, node, vParent, context, true)
  }

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

      let committed = commitHostNode(node, targetHead)
      // Render explicit <head> children directly into document.head.
      committed._children = diffChildren(
        null,
        childInputs,
        targetHead,
        committed,
        context,
        childCursor,
      )
      patchHostProps({}, resolved, targetHead)
      setupHostNode(committed, scheduler)
      bindNodeMixRuntime(committed, context)
      return committed
    }
  }

  if (hydrationNode instanceof Element) {
    let cursorTag = getHydrationTagName(hydrationNode, svg)
    let match: Element | null = cursorTag === node.type ? hydrationNode : null
    if (!match) {
      // Type mismatch - try single-advance retry to handle browser extension injections
      // at the start of containers. Skip this node and try the next sibling once, and
      // leave the skipped node in place if the next sibling matches.
      let nextSibling = nextHydrationNode(hydrationNode.nextSibling, false, anchor)
      if (nextSibling instanceof Element && getHydrationTagName(nextSibling, svg) === node.type) {
        match = nextSibling
      }
    }
    if (match) {
      let nextCursor = match.nextSibling
      // Ignore excess child nodes - browser extensions may inject content
      let committed = mountHostNode(node, resolved, vParent, match, context, {
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
  let committed = mountHostNode(node, resolved, vParent, dom, context, undefined, domParent)
  insertDomNode(dom, domParent, anchor)
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
        // Adjacent text children can arrive as a single server text node.
        dom.splitText(text.length)
      } else {
        if (text.startsWith(dom.data)) {
          // The HTML parser can split long text into several nodes. The final
          // node can also contain the start of the next text child.
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
          logHydrationMismatch('text mismatch', dom.data, text)
        }
        dom.data = text
      }
    }
    if (cursor) cursor.current = dom.nextSibling
  } else {
    // The server emits no Text for an empty string. Leave the next sibling for the next child.
    dom = document.createTextNode(text)
    insertDomNode(dom, domParent, hydrationNode?.parentNode === domParent ? hydrationNode : anchor)
  }
  let committed = node as unknown as CommittedTextNode
  committed._dom = dom
  return committed
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
    committed._children.push(reconcileVNodes(null, child, container, committed, context, end))
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
  anchor?: Node | null,
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

function nextHydrationNode(
  cursor: Node | null,
  preserveClientEntry: boolean,
  anchor?: Node,
): Node | null {
  while (cursor && cursor !== anchor && cursor.nodeType === Node.COMMENT_NODE) {
    let portalEnd = getPortalRangeEnd(cursor)
    if (portalEnd) {
      cursor = portalEnd.nextSibling
      continue
    }
    if (isFrameStart(cursor)) return cursor
    if (preserveClientEntry && isHydrationStart(cursor)) return cursor
    cursor = cursor.nextSibling
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
  anchor?: Node | null,
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
      frames: {
        get top() {
          return getFrameRuntime(frame)?.topFrame ?? frame
        },
        get(name) {
          return getFrameRuntime(frame)?.registry.get(name)
        },
      },
    })
  } else {
    handle = curr._handle
  }
  let mounting = beginComponentNode(next, handle, context)
  return renderComponent(curr && curr._content, mounting, domParent, context, anchor, cursor)
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
  let element = jsx(node.type, node.props, node.key)
  let owner = getClientEntryBoundaryOwner(start)
  if (owner) {
    getNonceManager().inheritRootResourceNonces(owner.root, parent)
    owner.root.render(element)
    return committed
  }

  let runtime = getFrameRuntime(context.frame)
  let pending = runtime?.registry.entries.get(start)
  invariant(runtime && pending?.[0] === end, 'Expected pending client entry boundary')
  runtime.registry.entries.set(start, [end, element, getNonceManager().getResourceNonces(parent)])
  return committed
}

function disposeCommittedClientEntryBoundary(
  node: CommittedClientEntryNode,
  context: ReconcileContext,
): boolean {
  getFrameRuntime(context.frame)?.registry.entries.delete(node._rangeStart)
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
  if (node.kind === 'text') {
    if (domParent) node._dom.remove()
    return
  }

  if (node.kind === 'host') {
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

  if (node.kind === 'client-entry') {
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
  syncDirectEventListeners(node, undefined, isHead)
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
  // Only bulk-clear when at least one committed child is being removed. A
  // fragment shares its DOM parent with its siblings, so it can't clear it.
  if (
    next.length === 0 &&
    curr?.length &&
    anchor === undefined &&
    vParent.kind !== 'fragment' &&
    !portalContainers.get(domParent) &&
    !(vParent.kind === 'host' && vParent._mixedProps.innerHTML != null) &&
    curr.every(canBulkClearNode)
  ) {
    for (let i = 0; i < curr.length; i++) {
      remove(curr[i], null, context)
    }
    domParent.textContent = ''
    return EMPTY_COMMITTED_CHILDREN
  }

  if (next.some((child) => child.key != null)) {
    if (curr) return patchKeyedChildren(curr, next, domParent, vParent, context, cursor, anchor)
    if (vParent.kind !== 'fragment') warnDuplicateKeys(next)
  }

  curr ??= EMPTY_COMMITTED_CHILDREN
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

  let inserted = 0
  let lastOldIndex = -1
  let needsPlacement = false
  for (let oldIndex of matches) {
    if (oldIndex < 0) inserted++
    else if (inserted > 0 || oldIndex < lastOldIndex) needsPlacement = true
    lastOldIndex = oldIndex
  }

  if (matches.length - inserted < curr.length) {
    let usedOldIndexes = new Uint8Array(curr.length)
    for (let oldIndex of matches) {
      if (oldIndex >= 0) usedOldIndexes[oldIndex] = 1
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
  let stableIndexes = needsPlacement
    ? getStableIndexes(matches, (oldIndex) => !!findFirstDomAnchor(curr[oldIndex]))
    : null
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
      insertAnchor ?? null,
      cursor,
    )
  }
  let committedChildren = committed as CommittedVNode[]

  if (!stableIndexes) {
    return committedChildren
  }

  stableCursor = stableIndexes.length - 1
  let placement = new SiblingPlacement(domParent, anchor ?? null)

  for (let index = next.length - 1; index >= 0; index--) {
    let nextNode = committedChildren[index]
    let isStable = stableIndexes[stableCursor] === index

    if (isStable) {
      stableCursor--
      placement.retain(findFirstDomAnchor(nextNode), findLastDomAnchor(nextNode))
    } else {
      placeVNode(nextNode, placement)
    }
  }
  return committedChildren
}

// Keyed child matches are arrays of old indexes (-1 = no match / new node),
// parallel to `next`. Each match needs only its old index.
function matchKeyedChildren(curr: CommittedVNode[], next: VNodeInput[]): number[] {
  let oldKeys = new Map<Key, number>()
  let lastUnkeyed = new Map<CommittedVNode['type'], number>()
  for (let i = 0; i < curr.length; i++) {
    let key = curr[i].key
    if (key != null) oldKeys.set(key, i)
    else lastUnkeyed.set(curr[i].type, i)
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
    } else if ((lastUnkeyed.get(type) ?? -1) >= nextUnkeyed) {
      // A miss must leave the cursor available for later children of other types.
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
    let high = tails.length
    // An old index past the last tail extends the sequence without a search.
    let low = high > 1 && matches[tails[high - 1]] < value ? high : 0

    while (low < high) {
      let middle = (low + high) >> 1

      if (matches[tails[middle]] < value) {
        low = middle + 1
      } else {
        high = middle
      }
    }

    if (low) predecessors[index] = tails[low - 1]
    tails[low] = index
  }

  let cursor = tails[tails.length - 1]

  for (let index = tails.length - 1; index >= 0; index--) {
    tails[index] = cursor
    cursor = predecessors[cursor]
  }

  return tails
}

function placeVNode(node: CommittedVNode, placement: SiblingPlacement): void {
  let domParent = placement.parent
  let anchor = placement.anchor
  if (anchor === undefined) return
  let firstDom = findFirstDomAnchor(node)
  if (!firstDom || firstDom.parentNode !== domParent) return

  let lastDom = findLastDomAnchor(node)
  if (!lastDom) return
  if (anchor && domRangeContainsNode(firstDom, lastDom, anchor)) {
    placement.retain(firstDom, lastDom)
    return
  }
  // Re-inserting a node that is already in place still disconnects and
  // reconnects it, which runs custom element callbacks and resets state
  if (lastDom.nextSibling === anchor) {
    placement.retain(firstDom, lastDom)
    return
  }

  if (firstDom === lastDom) {
    placement.move(firstDom)
  } else {
    moveNodesBefore(placement, collectDomRange(domParent, firstDom, lastDom))
  }
}

function findFirstDomAnchor(node: CommittedVNode | null | undefined): Node | null {
  return findEdgeDomNode(node, false)
}

function findLastDomAnchor(node: CommittedVNode | null | undefined): Node | null {
  return findEdgeDomNode(node, true)
}

function findEdgeDomNode(node: CommittedVNode | null | undefined, last: boolean): Node | null {
  if (!node) return null
  if (node.kind === 'text' || node.kind === 'host') return node._dom
  if (isCommittedComponentNode(node)) return findEdgeDomNode(node._content, last)
  if (node.kind === 'client-entry' || node.kind === 'frame') {
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

export function canMoveBefore(parent: ParentNode, node: Node): boolean {
  return (
    typeof parent.moveBefore === 'function' &&
    node.parentNode !== null &&
    // Native moves require the same shadow-including root, even for detached DOM.
    parent.getRootNode({ composed: true }) === node.getRootNode({ composed: true }) &&
    (node.nodeType === Node.ELEMENT_NODE ||
      node.nodeType === Node.TEXT_NODE ||
      node.nodeType === Node.CDATA_SECTION_NODE ||
      node.nodeType === Node.PROCESSING_INSTRUCTION_NODE ||
      node.nodeType === Node.COMMENT_NODE) &&
    // Document element/text placement has stricter rules than insertBefore().
    (parent.nodeType !== Node.DOCUMENT_NODE ||
      (node.nodeType !== Node.ELEMENT_NODE &&
        node.nodeType !== Node.TEXT_NODE &&
        node.nodeType !== Node.CDATA_SECTION_NODE))
  )
}

export function moveNodeBefore(parent: ParentNode, node: Node, before: Node | null): void {
  if (canMoveBefore(parent, node)) parent.moveBefore(node, before)
  else parent.insertBefore(node, before)
}

// Callbacks can remove or reparent nodes during placement. Track the retained right-hand
// suffix and resolve an attached anchor immediately before each move.
export class SiblingPlacement {
  readonly parent: ParentNode
  #end: Node | null
  #anchors: Node[] = []

  constructor(parent: ParentNode, end: Node | null) {
    this.parent = parent
    this.#end = end
  }

  get anchor(): Node | null | undefined {
    // Losing the owning region's boundary must not turn a move into a parent-wide append.
    if (this.#end && this.#end.parentNode !== this.parent) return undefined
    return getRetainedNode(this.parent, this.#anchors) ?? this.#end
  }

  retain(first: Node | null, last = first): void {
    if (first?.parentNode !== this.parent) return
    if (!last || first === last || last.parentNode !== this.parent) {
      this.#anchors.push(first)
      return
    }
    let nodes = collectDomRange(this.parent, first, last)
    for (let i = nodes.length - 1; i >= 0; i--) this.#anchors.push(nodes[i])
  }

  move(node: Node): void {
    let before = this.anchor
    if (before === undefined) return
    if (node !== before && !(node.parentNode === this.parent && node.nextSibling === before)) {
      moveNodeBefore(this.parent, node, before)
    }
    this.retain(node)
  }
}

function getRetainedNode(parent: ParentNode, nodes: Node[]): Node | undefined {
  while (nodes.length) {
    let node = nodes.at(-1)
    if (node?.parentNode === parent) return node
    nodes.pop()
  }
}

export function moveNodesBefore(placement: SiblingPlacement, nodes: Node[]): void {
  let parent = placement.parent
  let before = placement.anchor
  if (before === undefined) return
  let end = nodes.at(-1)
  if (end?.parentNode === parent && (isFrameEnd(end) || isHydrationEnd(end))) {
    // Place the inert ownership marker first so callback-created siblings remain inside it.
    moveNodeBefore(parent, end, before)
    for (let node of nodes) {
      if (node === end || end.parentNode !== parent) break
      if (node.parentNode === parent && node.nextSibling !== end) moveNodeBefore(parent, node, end)
    }
    for (let i = nodes.length - 1; i >= 0; i--) placement.retain(nodes[i])
    return
  }

  // Keep source-order callbacks for unmarked ranges, anchoring after the retained prefix.
  let placed: Node[] = []
  for (let node of nodes) {
    if (node.parentNode !== parent) continue
    let fallback = placement.anchor
    if (fallback === undefined) break
    let previous = getRetainedNode(parent, placed)
    let ref = previous ? previous.nextSibling : fallback
    if (node !== ref && node.nextSibling !== ref) moveNodeBefore(parent, node, ref)
    placed.push(node)
  }
  for (let i = nodes.length - 1; i >= 0; i--) placement.retain(nodes[i])
}

function collectDomRange(domParent: ParentNode, first: Node, last: Node): Node[] {
  let nodes: Node[] = []
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
    nodes.push(current)
    if (current === last) break
    current = next
  }
  return nodes
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

// A child diff knows where its fragment ends (null means the end of the list).
// A component updating itself has no such anchor, so follow its fragment's siblings.
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
    let dom = findFirstDomAnchor(children[i])
    // During a keyed diff `children` is still the old list, so a sibling may
    // already have been removed from the DOM
    if (dom?.parentNode) return dom
  }

  if (isFragmentNode(vParent)) {
    return fragmentEnd === undefined ? findNextSiblingDomAnchor(vParent) : fragmentEnd
  }

  if (vParent.kind === 'root' || vParent.kind === 'portal')
    return vParent._rangeEnd ?? fragmentEnd ?? null
  return fragmentEnd ?? null
}
