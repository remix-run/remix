import type { Component, ComponentHandle, FrameContent, FrameHandle } from './component.ts'
import { createComponent } from './component.ts'
import type { FrameRuntime } from './frame.ts'
import { createFrame, isFrameRuntime } from './frame.ts'
import { unwrapFrameResolution } from './frame-resolution.ts'
import { createRangeRoot } from './vdom.ts'
import type {
  CommittedFragmentNode,
  CommittedFrameNode,
  CommittedNonRenderNode,
  ComponentNode,
  CommittedComponentNode,
  CommittedHostNode,
  CommittedTextNode,
  ControlledReflectionState,
  DirectEventBinding,
  DirectEventState,
  FrameNode,
  HostNode,
  MountingComponentNode,
  ReconcileContext,
  RuntimeHostProps,
  TextNode,
  VNodeInput,
  VNodeParent,
  CommittedVNode,
} from './vnode.ts'
import {
  isCommittedComponentNode,
  isCommittedHostNode,
  isCommittedTextNode,
  isFragmentNode,
  isHostNode,
  findContextFromAncestry,
} from './vnode.ts'
import { invariant } from './invariant.ts'
import { patchHostProps } from './core/props.ts'
import type { StyleManager } from '../style/index.ts'
import type { ElementFunction } from './element-function.ts'
import type { Key } from './key.ts'
import { skipComments, logHydrationMismatch } from './client-entries.ts'
import type { Scheduler } from './scheduler.ts'
import { toVNode } from './to-vnode.ts'
import {
  bindMixinRuntime,
  cancelPendingMixinRemoval,
  dispatchMixinBeforeUpdate,
  dispatchMixinCommit,
  getMixinRuntimeSignal,
  prepareMixinRemoval,
  resolveMixedProps,
  teardownMixins,
  type MixinRuntimeBinding,
  type MixinRuntimeState,
} from './mixins/mixin.ts'
import { isOnMixinDescriptor, type OnMixinDescriptor } from './mixins/on-mixin.ts'
import { createComponentErrorEvent } from './error-event.ts'
import { componentStalenessCheck } from './refresh.ts'

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

function getHostProps(node: HostNode | CommittedHostNode): RuntimeHostProps {
  return '_mixedProps' in node ? node._mixedProps : node.props
}

function markNodePersistedByMixins(node: CommittedHostNode, domParent: ParentNode, token: number) {
  node._persistence = { parent: domParent, token }
  persistedMixinNodes.add(node)
  bindMixinRuntime(node._mixState, undefined)
}

function unmarkNodePersistedByMixins(node: CommittedHostNode) {
  node._persistence = undefined
  persistedMixinNodes.delete(node)
}

function findMatchingPersistedMixinNode(
  type: string,
  key: Key | undefined,
  domParent: ParentNode,
): CommittedHostNode | null {
  if (key == null) return null
  for (let node of persistedMixinNodes) {
    if (node._persistence?.parent !== domParent) continue
    if (node.type !== type) continue
    if (node.key !== key) continue
    return node
  }
  return null
}

const EMPTY_DIRECT_EVENT_DESCRIPTORS: OnMixinDescriptor[] = []
const EMPTY_COMMITTED_CHILDREN: CommittedVNode[] = []

type HydrationCursor = { current: Node | null | undefined }

function shouldRestoreControlledReflectionOnInput(
  node: CommittedHostNode,
  state: ControlledReflectionState,
): boolean {
  // Some controls dispatch `input` before `change` for the same interaction.
  // When checked/value state is typically handled on `change`, restoring on the
  // earlier `input` can race and clobber the value observed by app handlers.
  if (state.hasControlledChecked) return false
  if (node.type === 'select') return false
  return true
}

function ensureControlledReflection(
  node: CommittedHostNode,
  scheduler: Scheduler,
): ControlledReflectionState {
  let existing = node._controlledState
  if (existing) return existing

  let state: ControlledReflectionState = {
    disposed: false,
    listenersAttached: false,
    pendingRestoreVersion: 0,
    managesValue: false,
    managesChecked: false,
    hasControlledValue: false,
    controlledValue: undefined,
    hasControlledChecked: false,
    controlledChecked: undefined,
    onInput: () => {
      if (!shouldRestoreControlledReflectionOnInput(node, state)) return
      scheduleControlledRestore(node, state)
    },
    onChange: () => {
      scheduleControlledRestore(node, state)
    },
  }

  node._controlledState = state
  scheduler.enqueueTasks([
    () => {
      if (state.disposed) return
      node._dom.addEventListener('input', state.onInput)
      node._dom.addEventListener('change', state.onChange)
      state.listenersAttached = true
    },
  ])
  return state
}

function syncControlledReflection(node: CommittedHostNode, props: RuntimeHostProps): void {
  let state = node._controlledState
  if (!state || state.disposed) return

  state.managesValue = canManageValue(node.type, node._dom)
  state.managesChecked = canReflectProperty(node._dom, 'checked')
  state.hasControlledValue = state.managesValue && hasControlledValueProp(props)
  state.controlledValue = props.value
  state.hasControlledChecked = state.managesChecked && hasControlledCheckedProp(props)
  state.controlledChecked = props.checked
  state.pendingRestoreVersion++
}

function shouldTrackControlledReflection(props: RuntimeHostProps): boolean {
  return hasControlledValueProp(props) || hasControlledCheckedProp(props)
}

function scheduleControlledRestore(
  node: CommittedHostNode,
  state: ControlledReflectionState,
): void {
  if (state.disposed) return
  let version = ++state.pendingRestoreVersion
  queueMicrotask(() => {
    if (state.disposed) return
    if (state.pendingRestoreVersion !== version) return
    restoreControlledReflections(node, state)
  })
}

function restoreControlledReflections(
  node: CommittedHostNode,
  state: ControlledReflectionState,
): void {
  let element = node._dom
  if (state.hasControlledValue && readDomProp(element, 'value') !== state.controlledValue) {
    setPropertyReflection(element, 'value', state.controlledValue)
  }
  if (state.hasControlledChecked && readDomProp(element, 'checked') !== state.controlledChecked) {
    setPropertyReflection(element, 'checked', state.controlledChecked)
  }
}

function teardownControlledReflection(node: CommittedHostNode): void {
  let state = node._controlledState
  if (!state) return
  state.disposed = true
  state.pendingRestoreVersion++
  if (state.listenersAttached) {
    node._dom.removeEventListener('input', state.onInput)
    node._dom.removeEventListener('change', state.onChange)
    state.listenersAttached = false
  }
}

// See abandonDirectEventListeners: skips removeEventListener for discarded subtrees.
function abandonControlledReflection(node: CommittedHostNode): void {
  let state = node._controlledState
  if (!state) return
  state.disposed = true
  state.pendingRestoreVersion++
  state.listenersAttached = false
}

function canManageValue(type: string, element: Element): boolean {
  if (type === 'progress') return false
  return canReflectProperty(element, 'value')
}

function hasControlledValueProp(props: RuntimeHostProps): boolean {
  return 'value' in props && props.value !== undefined
}

function hasControlledCheckedProp(props: RuntimeHostProps): boolean {
  return 'checked' in props && props.checked !== undefined
}

function canReflectProperty(
  element: Element,
  key: string,
): element is Element & Record<string, unknown> {
  return key in element && !key.includes('-')
}

function readDomProp(element: Element, key: string): unknown {
  if (!canReflectProperty(element, key)) return undefined
  return element[key]
}

function setPropertyReflection(element: Element, key: string, value: unknown): void {
  if (!canReflectProperty(element, key)) return
  element[key] = value == null ? '' : value
}

type ResolvedHostProps = {
  props: RuntimeHostProps
  mixState?: MixinRuntimeState
  directEventDescriptors?: OnMixinDescriptor[]
}

function resolveNodeMixProps(
  node: HostNode | CommittedHostNode,
  parent: VNodeParent,
  frame: FrameHandle,
  scheduler: Scheduler,
  state?: MixinRuntimeState,
): ResolvedHostProps {
  let mix = node.props.mix
  let directEventDescriptors = resolveDirectEventDescriptors(mix)
  if (directEventDescriptors) {
    if (state) teardownMixins(state)
    return { props: node.props, directEventDescriptors }
  }

  if (state == null && (mix == null || (Array.isArray(mix) && mix.length === 0))) {
    return { props: node.props }
  }

  let resolved = resolveMixedProps({
    hostType: node.type,
    frame,
    scheduler,
    getContext: (type: Component | string | symbol) => {
      if (typeof type !== 'function') {
        return undefined
      }

      return findContextFromAncestry(parent, type)
    },
    props: node.props,
    state,
  })
  return { props: resolved.props, mixState: resolved.state }
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

  return areOnMixinDescriptors(mix) ? mix : null
}

function areOnMixinDescriptors(descriptors: unknown[]): descriptors is OnMixinDescriptor[] {
  for (let i = 0; i < descriptors.length; i++) {
    if (!isOnMixinDescriptor(descriptors[i])) return false
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
      if (state?.aborted) {
        done(getMixinRuntimeSignal(state))
        return
      }

      dispatchMixinBeforeUpdate(state)
      let prevProps = getHostProps(node)
      let resolved = resolveNodeMixProps(node, node._parent, this.frame, this.scheduler, state)
      applyResolvedHostProps(node, resolved)
      patchHostProps(prevProps, resolved.props, this.node)
      if (node._controlledState || shouldTrackControlledReflection(resolved.props)) {
        ensureControlledReflection(node, this.scheduler)
        syncControlledReflection(node, resolved.props)
      }

      dispatchMixinCommit(state)
      done(state ? getMixinRuntimeSignal(state) : AbortSignal.abort())
    },
  ])
}

function bindNodeMixRuntime(
  node: CommittedHostNode,
  frame: FrameHandle,
  scheduler: Scheduler,
  styles: StyleManager,
  reclaimed: boolean = false,
  parent?: ParentNode,
) {
  let state = node._mixState
  bindMixinRuntime(
    state,
    {
      node: node._dom,
      parent: parent ?? getRequiredDomParent(node._dom),
      key: node.key,
      target: node,
      frame,
      scheduler,
      enqueueUpdate: enqueueMixinBindingUpdate,
    },
    { dispatchReclaimed: reclaimed },
  )
}

function isHeadHostNode(node: HostNode | CommittedHostNode): boolean {
  if (node.type === 'head') return true
  if (node.type.length !== 4) return false
  return node.type.toLowerCase() === 'head'
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
  children: CommittedVNode[] = EMPTY_COMMITTED_CHILDREN,
): CommittedHostNode {
  let committed = node as unknown as CommittedHostNode
  committed._parent = parent
  committed._svg = svg
  committed._dom = dom
  committed._children = children
  committed._mixedProps = resolved.props
  committed._mixState = resolved.mixState
  committed._directEventDescriptors = resolved.directEventDescriptors
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
  if (curr === null) {
    return insert(next, domParent, vParent, context, anchor, cursor)
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

  switch (next.kind) {
    case 'host': {
      return diffHost(curr as CommittedHostNode, next, vParent, context)
    }
    case 'text': {
      return diffText(curr as CommittedTextNode, next, vParent, getSvgContext(vParent, next))
    }
    case 'empty': {
      return commitNonRenderNode(next, vParent, getSvgContext(vParent, next))
    }
    case 'fragment': {
      let childInputs = next._children
      let committed = beginFragmentNode(next, vParent, getSvgContext(vParent, next))
      committed._children = diffChildren(
        (curr as CommittedFragmentNode)._children,
        childInputs,
        domParent,
        committed,
        context,
        undefined,
        anchor,
      )
      return committed
    }
    case 'frame': {
      return diffFrame(
        curr as CommittedFrameNode,
        next,
        domParent,
        vParent,
        context,
        getSvgContext(vParent, next),
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
        getSvgContext(vParent, next),
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

  let replacementAnchor = findNextSiblingDomAnchor(curr) ?? anchor
  remove(curr, domParent, context)
  return insert(next, domParent, vParent, context, replacementAnchor)
}

function diffHost(
  curr: CommittedHostNode,
  next: HostNode,
  vParent: VNodeParent,
  context: ReconcileContext,
): CommittedHostNode {
  let { frame, scheduler, styles } = context
  let mixState = curr._mixState
  let currProps = getHostProps(curr)
  let resolved = resolveNodeMixProps(next, vParent, frame, scheduler, mixState)
  let childInputs = next._children
  let nextProps = resolved.props
  let nextMixState = resolved.mixState
  let shouldDispatchMixinLifecycle =
    (nextMixState?.runners.length ?? 0) > 0 && shouldDispatchInlineMixinLifecycle(curr._dom)
  if (shouldDispatchMixinLifecycle) {
    dispatchMixinBeforeUpdate(nextMixState)
  }

  // Handle innerHTML prop BEFORE diffChildren to avoid clearing children
  if (nextProps.innerHTML != null) {
    // innerHTML is set, update it if changed
    if (currProps.innerHTML !== nextProps.innerHTML) {
      curr._dom.innerHTML = nextProps.innerHTML
    }
  } else if (currProps.innerHTML != null) {
    // innerHTML was removed, clear it before adding children
    curr._dom.innerHTML = ''
  }

  let committed = commitHostNode(next, vParent, getSvgContext(vParent, next), curr._dom, resolved)
  committed._directEventState = curr._directEventState
  committed._controlledState = curr._controlledState
  committed._children = diffChildren(curr._children, childInputs, curr._dom, committed, context)
  patchHostProps(currProps, nextProps, curr._dom)

  syncDirectEventListeners(committed)

  if (committed._controlledState || shouldTrackControlledReflection(nextProps)) {
    ensureControlledReflection(committed, scheduler)
    syncControlledReflection(committed, nextProps)
  }

  if (committed._mixState) {
    bindNodeMixRuntime(committed, frame, scheduler, styles)
  }
  if (shouldDispatchMixinLifecycle) {
    scheduler.enqueueCommitPhase([() => dispatchMixinCommit(nextMixState)])
  }

  return committed
}

function setupHostNode(node: CommittedHostNode, scheduler: Scheduler): void {
  let props = getHostProps(node)

  syncDirectEventListeners(node)

  if (shouldTrackControlledReflection(props)) {
    ensureControlledReflection(node, scheduler)
    syncControlledReflection(node, props)
  }
}

function syncDirectEventListeners(node: CommittedHostNode): void {
  let descriptors = node._directEventDescriptors
  if (!descriptors) {
    teardownDirectEventListeners(node)
    return
  }
  if (descriptors.length === 0) {
    teardownDirectEventListeners(node)
    return
  }

  let state = node._directEventState
  if (!state) {
    state = { bindings: [] }
    node._directEventState = state
  }

  let bindings = state.bindings
  for (let index = 0; index < descriptors.length; index++) {
    // Indexed access instead of array destructuring: destructuring goes through
    // the iterator protocol and allocates on every host-node update.
    let args = descriptors[index].args
    let type = args[0]
    let handler = args[1]
    let captureBoolean = args[2] ?? false
    let binding = bindings[index]

    if (!binding) {
      binding = createDirectEventBinding(type, handler, captureBoolean)
      bindings[index] = binding
      attachDirectEventBinding(node._dom, binding)
      continue
    }

    if (binding.type !== type || binding.capture !== captureBoolean) {
      removeDirectEventBinding(node._dom, binding)
      binding.type = type
      binding.capture = captureBoolean
      attachDirectEventBinding(node._dom, binding)
    }

    binding.handler = handler
  }

  for (let index = descriptors.length; index < bindings.length; index++) {
    removeDirectEventBinding(node._dom, bindings[index])
  }
  bindings.length = descriptors.length
}

function createDirectEventBinding(
  type: string,
  handler: DirectEventBinding['handler'],
  capture: boolean,
): DirectEventBinding {
  let binding: DirectEventBinding = {
    type,
    handler,
    capture,
    reentry: null,
    stableHandler: null,
  }

  return binding
}

function getStableDirectEventHandler(binding: DirectEventBinding): (event: Event) => void {
  if (binding.stableHandler) return binding.stableHandler

  binding.stableHandler = (event) => {
    invokeDirectEventBinding(binding, event)
  }
  return binding.stableHandler
}

function attachDirectEventBinding(dom: Element, binding: DirectEventBinding): void {
  dom.addEventListener(binding.type, getStableDirectEventHandler(binding), binding.capture)
}

function removeDirectEventBinding(dom: Element, binding: DirectEventBinding): void {
  if (binding.stableHandler) {
    dom.removeEventListener(binding.type, binding.stableHandler, binding.capture)
  }
  binding.reentry?.abort(new DOMException('', 'AbortError'))
  binding.reentry = null
}

function teardownDirectEventListeners(node: CommittedHostNode): void {
  let state = node._directEventState
  if (!state) return

  for (let binding of state.bindings) {
    removeDirectEventBinding(node._dom, binding)
  }

  state.bindings.length = 0
  node._directEventState = undefined
}

// Teardown for a node whose DOM subtree is being discarded wholesale: abort
// pending handler work but skip removeEventListener — the listeners die with
// the detached node, and removing them one-by-one dominates large teardowns.
function abandonDirectEventListeners(node: CommittedHostNode): void {
  let state = node._directEventState
  if (!state) return

  for (let binding of state.bindings) {
    binding.reentry?.abort(new DOMException('', 'AbortError'))
    binding.reentry = null
  }

  state.bindings.length = 0
  node._directEventState = undefined
}

function invokeDirectEventBinding(binding: DirectEventBinding, event: Event): void {
  binding.reentry?.abort(new DOMException('', 'EventReentry'))
  binding.reentry = new AbortController()
  void binding.handler(event, binding.reentry.signal)
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

  // Preserve frame-start markers for non-Frame nodes too, so a following <Frame>
  // (e.g. the first child of a bare Fragment at a clientEntry boundary) can still
  // claim its rmx:f marker during hydration instead of being re-inserted fresh.
  // A rmx:f marker always belongs to a <Frame>, so no non-Frame node should
  // consume one.
  hydrationNode = skipCommentsExceptFrameStart(hydrationNode ?? null)

  // Also check after skipComments in case we skipped past the anchor
  if (hydrationNode && anchor && hydrationNode === anchor) {
    hydrationNode = null
  }
  if (cursor) cursor.current = hydrationNode

  let doInsert = anchor
    ? (dom: Node) => domParent.insertBefore(dom, anchor)
    : (dom: Node) => domParent.appendChild(dom)

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
    doInsert(dom)
    return commitTextNode(node, vParent, svg, dom)
  }

  if (node.kind === 'host') {
    let resolved = resolveNodeMixProps(node, vParent, frame, scheduler)
    let hostProps = resolved.props
    let childInputs = node._children

    if (isHeadHostNode(node)) {
      let targetHead = getDocumentHead(domParent)
      if (targetHead) {
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
        patchHostProps({}, hostProps, targetHead)
        setupHostNode(committed, scheduler)
        if (committed._mixState) {
          bindNodeMixRuntime(committed, frame, scheduler, styles)
        }
        return committed
      }
    }

    // Check for matching mixin-persisted node that can be reclaimed
    let persistedNode = findMatchingPersistedMixinNode(node.type, node.key, domParent)
    if (persistedNode) {
      return reclaimPersistedMixinNode(persistedNode, node, vParent, context)
    }

    if (hydrationNode instanceof Element) {
      // SVG elements have case-sensitive tag names (e.g. linearGradient, clipPath)
      // HTML elements are case-insensitive, so we lowercase for comparison
      let cursorTag = svg ? hydrationNode.tagName : hydrationNode.tagName.toLowerCase()
      if (cursorTag === node.type) {
        let nextCursor = hydrationNode.nextSibling
        patchHostProps({}, hostProps, hydrationNode)
        let committed = commitHostNode(node, vParent, svg, hydrationNode, resolved)

        // Handle innerHTML prop
        if (hostProps.innerHTML != null) {
          hydrationNode.innerHTML = hostProps.innerHTML
        } else {
          let childCursor = { current: hydrationNode.firstChild }
          // Ignore excess nodes - browser extensions may inject content
          committed._children = diffChildren(
            null,
            childInputs,
            hydrationNode,
            committed,
            context,
            childCursor,
          )
        }

        setupHostNode(committed, scheduler)
        if (committed._mixState) {
          bindNodeMixRuntime(committed, frame, scheduler, styles)
        }
        if (cursor) cursor.current = nextCursor
        return committed
      } else {
        // Type mismatch - try single-advance retry to handle browser extension injections
        // at the start of containers. Skip this node and try the next sibling once.
        let nextSibling = skipComments(hydrationNode.nextSibling)
        if (nextSibling instanceof Element) {
          let nextTag = svg ? nextSibling.tagName : nextSibling.tagName.toLowerCase()
          if (nextTag === node.type) {
            let nextCursor = nextSibling.nextSibling
            // Found a match after skipping - adopt it and leave skipped node in place
            patchHostProps({}, hostProps, nextSibling)
            let committed = commitHostNode(node, vParent, svg, nextSibling, resolved)

            if (hostProps.innerHTML != null) {
              nextSibling.innerHTML = hostProps.innerHTML
            } else {
              let childCursor = { current: nextSibling.firstChild }
              committed._children = diffChildren(
                null,
                childInputs,
                nextSibling,
                committed,
                context,
                childCursor,
              )
            }

            setupHostNode(committed, scheduler)
            if (committed._mixState) {
              bindNodeMixRuntime(committed, frame, scheduler, styles)
            }
            if (cursor) cursor.current = nextCursor
            return committed
          }
        }
        // Retry failed - log mismatch and create new element (don't remove mismatched nodes)
        logHydrationMismatch('tag', cursorTag, node.type)
        if (cursor) cursor.current = undefined // stop hydration for this tree
      }
    }
    let dom = svg ? document.createElementNS(SVG_NS, node.type) : document.createElement(node.type)
    patchHostProps({}, hostProps, dom)
    let committed = commitHostNode(node, vParent, svg, dom, resolved)

    // Handle innerHTML prop
    if (hostProps.innerHTML != null) {
      dom.innerHTML = hostProps.innerHTML
    } else {
      committed._children = diffChildren(null, childInputs, dom, committed, context)
    }

    setupHostNode(committed, scheduler)
    if (committed._mixState) {
      bindNodeMixRuntime(committed, frame, scheduler, styles, false, domParent)
    }
    doInsert(dom)
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

  if (node.kind === 'frame') {
    return insertFrame(node, domParent, vParent, context, svg, anchor, cursor)
  }

  invariant(false, 'Unexpected node type')
}

function diffFrame(
  curr: CommittedFrameNode,
  next: FrameNode,
  domParent: ParentNode,
  vParent: VNodeParent,
  context: ReconcileContext,
  svg: boolean,
  anchor?: Node,
): CommittedFrameNode {
  let { frame } = context
  let currSrc = getFrameSrc(curr)
  let nextSrc = getFrameSrc(next)
  let currName = getFrameName(curr)
  let nextName = getFrameName(next)

  if (currName !== nextName) {
    let replaceAnchor = curr._rangeEnd.nextSibling ?? anchor
    remove(curr, domParent, context)
    return insertFrame(next, domParent, vParent, context, svg, replaceAnchor)
  }

  // If the frame hasn't resolved yet, preserve existing cancel/remount behavior
  // so pending streams from the old src cannot take over the new src.
  if (currSrc !== nextSrc && !curr._state.resolved) {
    let replaceAnchor = curr._rangeEnd.nextSibling ?? anchor
    remove(curr, domParent, context)
    return insertFrame(next, domParent, vParent, context, svg, replaceAnchor)
  }

  let committed = next as unknown as CommittedFrameNode
  Object.assign(committed, {
    _rangeStart: curr._rangeStart,
    _rangeEnd: curr._rangeEnd,
    _state: curr._state,
    _parent: vParent,
    _svg: svg,
  })

  let frameRuntime = getFrameRuntime(frame)
  let frameInstance = committed._state.instance
  let serverFrameReload = frameRuntime?.serverFrameReload

  if (currSrc !== nextSrc) {
    if (frameInstance) {
      frameInstance.handle.src = nextSrc
    }

    if (frameRuntime) {
      resolveClientFrame(committed, frameRuntime, serverFrameReload)
    }
  } else if (frameRuntime && frameInstance && serverFrameReload) {
    // Reload client frames that have the same src during a render triggered by an ancestor frame reload
    resolveClientFrame(committed, frameRuntime, serverFrameReload)
  }

  if (!committed._state.resolved && committed._state.fallbackRoot) {
    committed._state.fallbackRoot.render(committed.props.fallback ?? null)
  }
  return committed
}

function insertFrame(
  node: FrameNode,
  domParent: ParentNode,
  vParent: VNodeParent,
  context: ReconcileContext,
  svg: boolean,
  anchor?: Node,
  cursor?: HydrationCursor,
): CommittedFrameNode {
  let { frame, styles } = context
  let runtime = getFrameRuntime(frame)
  if (!runtime || runtime.canResolveFrames === false) {
    throw new Error(
      'Cannot render <Frame /> without frame runtime. Use run() or pass frameInit to createRoot/createRangeRoot.',
    )
  }

  // Hydration path: adopt server-rendered frame markers and reuse the existing
  // frame instance created during createSubFrames().
  if (isFrameStartComment(cursor?.current)) {
    let start = cursor.current
    let end = findFrameEndComment(start)
    if (end) {
      let instance = runtime.frameInstances.get(start)
      let src = instance?.handle.src ?? getFrameSrc(node)
      if (!instance) {
        instance = createFrame([start, end], {
          name: getFrameName(node),
          src,
          errorTarget: runtime.errorTarget,
          loadModule: runtime.loadModule,
          resolveFrame: runtime.resolveFrame,
          pendingClientEntries: runtime.pendingClientEntries,
          scheduler: runtime.scheduler,
          styleManager: runtime.styleManager,
          data: {},
          moduleCache: runtime.moduleCache,
          moduleLoads: runtime.moduleLoads,
          frameInstances: runtime.frameInstances,
          namedFrames: runtime.namedFrames,
        })
        runtime.frameInstances.set(start, instance)
      }

      cursor.current = end.nextSibling
      return Object.assign(node as unknown as CommittedFrameNode, {
        _rangeStart: start,
        _rangeEnd: end,
        _parent: vParent,
        _svg: svg,
        _state: {
          instance,
          resolveToken: 0,
          resolveController: undefined,
          fallbackRoot: undefined,
          resolved: true,
        },
      })
    }
  }

  let start = document.createComment(` rmx:f:${randomFrameId()} `)
  let end = document.createComment(' /rmx:f ')
  let doInsert = anchor
    ? (dom: Node) => domParent.insertBefore(dom, anchor)
    : (dom: Node) => domParent.appendChild(dom)

  doInsert(start)
  doInsert(end)

  let fallbackRoot = createRangeRoot([start, end], {
    frame,
    styleManager: styles,
  })
  fallbackRoot.render(node.props.fallback ?? null)

  let instance = createFrame([start, end], {
    name: getFrameName(node),
    src: getFrameSrc(node),
    errorTarget: runtime.errorTarget,
    loadModule: runtime.loadModule,
    resolveFrame: runtime.resolveFrame,
    pendingClientEntries: runtime.pendingClientEntries,
    scheduler: runtime.scheduler,
    styleManager: runtime.styleManager,
    data: {},
    moduleCache: runtime.moduleCache,
    moduleLoads: runtime.moduleLoads,
    frameInstances: runtime.frameInstances,
    namedFrames: runtime.namedFrames,
  })
  runtime.frameInstances.set(start, instance)

  let committed = Object.assign(node as unknown as CommittedFrameNode, {
    _rangeStart: start,
    _rangeEnd: end,
    _parent: vParent,
    _svg: svg,
    _state: {
      instance,
      fallbackRoot,
      resolved: false,
      resolveToken: 0,
      resolveController: undefined,
    },
  })
  resolveClientFrame(committed, runtime, runtime.serverFrameReload)

  return committed
}

function resolveClientFrame(
  node: CommittedFrameNode,
  runtime: FrameRuntime,
  serverFrameReload?: NonNullable<FrameRuntime['serverFrameReload']>,
): void {
  let frameSrc = getFrameSrc(node)
  let state = node._state
  let instance = state.instance

  let token = state.resolveToken + 1
  state.resolveToken = token
  state.resolveController?.abort()
  let reload = serverFrameReload
    ? instance.beginClientFrameReloadForAncestorReload(serverFrameReload.signal)
    : undefined
  if (!reload) {
    instance.cancelReload()
  }
  let resolveController = reload?.controller ?? new AbortController()
  state.resolveController = resolveController
  let frameCommitted = Promise.withResolvers<void>()

  let resolve = Promise.resolve()
    .then(() =>
      runtime.resolveFrame(frameSrc, {
        signal: resolveController.signal,
        target: getFrameName(node),
      }),
    )
    .then(async (resolution) => {
      if (state.resolveToken !== token || resolveController.signal.aborted) return
      let { content } = await unwrapFrameResolution(resolution)
      if (state.resolveToken !== token || resolveController.signal.aborted) return
      state.fallbackRoot?.dispose()
      state.fallbackRoot = undefined
      let nextContent = asAbortableFrameContent(content, resolveController.signal)
      await instance.render(nextContent, {
        signal: resolveController.signal,
        reconciliationTracker: serverFrameReload?.reconciliationTracker,
        blockingFrameTracker: serverFrameReload?.blockingFrameTracker,
        onCommit: frameCommitted.resolve,
      })
      if (state.resolveToken !== token || resolveController.signal.aborted) return
      state.resolved = true
    })
    .catch((error) => {
      if (reload && state.resolveToken === token && !resolveController.signal.aborted) {
        runtime.errorTarget.dispatchEvent(createComponentErrorEvent(error))
      }
    })
    .finally(() => {
      frameCommitted.resolve()
      reload?.complete()
      if (state.resolveController === resolveController) {
        state.resolveController = undefined
      }
    })

  if (serverFrameReload?.reconciliationTracker && !node.props.fallback) {
    serverFrameReload.reconciliationTracker.waitFor(resolve)
  }
  if (serverFrameReload?.blockingFrameTracker && !node.props.fallback) {
    serverFrameReload.blockingFrameTracker.waitFor(frameCommitted.promise)
  }
}

function disposeFrameResources(node: CommittedFrameNode): void {
  let state = node._state
  state.resolveToken++
  state.resolveController?.abort()
  state.resolveController = undefined
  state.fallbackRoot?.dispose()
  state.fallbackRoot = undefined

  state.instance.dispose()
}

function asAbortableFrameContent(content: FrameContent, signal: AbortSignal): FrameContent {
  if (!(content instanceof ReadableStream)) return content
  return createAbortableReadableStream(content, signal)
}

function createAbortableReadableStream(
  source: ReadableStream<Uint8Array>,
  signal: AbortSignal,
): ReadableStream<Uint8Array> {
  let reader = source.getReader()
  let aborted = false

  let onAbort = () => {
    aborted = true
    void reader.cancel(signal.reason)
  }

  if (signal.aborted) onAbort()
  else signal.addEventListener('abort', onAbort, { once: true })

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (aborted) {
        controller.close()
        return
      }

      let removeAbortReadListener: undefined | (() => void)
      let abortRead = new Promise<{ done: true; value: undefined }>((resolve) => {
        if (signal.aborted) {
          resolve({ done: true, value: undefined })
          return
        }
        let onAbortRead = () => {
          resolve({ done: true, value: undefined })
        }
        removeAbortReadListener = () => signal.removeEventListener('abort', onAbortRead)
        signal.addEventListener('abort', onAbortRead, { once: true })
      })

      let result = await Promise.race([reader.read(), abortRead])
      removeAbortReadListener?.()

      if (result.done) {
        controller.close()
        return
      }
      controller.enqueue(result.value)
    },
    cancel(reason) {
      signal.removeEventListener('abort', onAbort)
      return reader.cancel(reason)
    },
  })
}

function removeFrameDomRange(node: CommittedFrameNode, domParent: ParentNode): void {
  let start = node._rangeStart
  let end = node._rangeEnd
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

function getFrameRuntime(frame: FrameHandle): FrameRuntime | undefined {
  let runtime = frame.$runtime
  return isFrameRuntime(runtime) ? runtime : undefined
}

function getFrameSrc(node: FrameNode | CommittedFrameNode): string {
  return node.props.src
}

function getFrameName(node: FrameNode | CommittedFrameNode): string | undefined {
  let name = node.props.name
  return typeof name === 'string' && name.length > 0 ? name : undefined
}

function randomFrameId(): string {
  return `f${crypto.randomUUID().slice(0, 8)}`
}

function skipCommentsExceptFrameStart(cursor: Node | null): Node | null {
  while (cursor && cursor.nodeType === Node.COMMENT_NODE) {
    if (isFrameStartComment(cursor)) return cursor
    cursor = cursor.nextSibling
  }
  return cursor
}

function isFrameStartComment(node: Node | null | undefined): node is Comment {
  return isCommentNode(node) && node.data.trim().startsWith('rmx:f:')
}

function isFrameEndComment(node: Node | null | undefined): node is Comment {
  return isCommentNode(node) && node.data.trim() === '/rmx:f'
}

function isCommentNode(node: Node | null | undefined): node is Comment {
  return node?.nodeType === Node.COMMENT_NODE
}

function findFrameEndComment(start: Comment): Comment | null {
  let depth = 1
  let node: Node | null = start.nextSibling

  while (node) {
    if (isFrameStartComment(node)) depth++
    else if (isFrameEndComment(node)) {
      depth--
      if (depth === 0) return node
    }
    node = node.nextSibling
  }

  return null
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
  if (curr === null) {
    let componentId = vParent.kind === 'root' ? vParent._pendingHydrationComponentId : undefined
    if (componentId) {
      if (vParent.kind === 'root') vParent._pendingHydrationComponentId = undefined
    } else {
      componentId = `c${++idCounter}`
    }
    let handle = createComponent({
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
    let mounting = beginComponentNode(next, vParent, svg, handle, context)

    return renderComponent(null, mounting, domParent, context, anchor, cursor)
  }
  let mounting = beginComponentNode(next, vParent, svg, curr._handle, context)
  return renderComponent(curr._content, mounting, domParent, context, anchor, cursor)
}

// Cleanup without DOM removal - used for descendants when parent DOM node is removed
function cleanupDescendants(node: CommittedVNode, context: ReconcileContext): void {
  let { scheduler } = context
  if (isCommittedTextNode(node)) {
    return
  }

  if (isCommittedHostNode(node)) {
    let children = node._children
    for (let i = 0; i < children.length; i++) {
      cleanupDescendants(children[i], context)
    }

    teardownMixins(node._mixState)
    abandonDirectEventListeners(node)
    abandonControlledReflection(node)
    return
  }

  if (isFragmentNode(node)) {
    let children = node._children
    for (let i = 0; i < children.length; i++) {
      cleanupDescendants(children[i], context)
    }
    return
  }

  if (isCommittedComponentNode(node)) {
    cleanupDescendants(node._content, context)
    let tasks = node._handle.remove()
    scheduler.enqueueTasks(tasks)
    return
  }

  if (node.kind === 'frame') {
    disposeFrameResources(node)
    return
  }
}

export function remove(
  node: CommittedVNode,
  domParent: ParentNode,
  context: ReconcileContext,
): void {
  let { scheduler } = context
  if (isCommittedTextNode(node)) {
    node._dom.parentNode?.removeChild(node._dom)
    return
  }

  if (isCommittedHostNode(node)) {
    if (node._persistence) return

    let persistedRemoval = prepareMixinRemoval(node._mixState)
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
        })
      return
    }
    performHostNodeRemoval(node, domParent, context)
    return
  }

  if (isFragmentNode(node)) {
    let children = node._children
    for (let i = 0; i < children.length; i++) {
      remove(children[i], domParent, context)
    }
    return
  }

  if (isCommittedComponentNode(node)) {
    remove(node._content, domParent, context)
    let tasks = node._handle.remove()
    scheduler.enqueueTasks(tasks)
    return
  }

  if (node.kind === 'frame') {
    disposeFrameResources(node)
    removeFrameDomRange(node, domParent)
    return
  }
}

// Actually remove a host node from DOM and clean up
function performHostNodeRemoval(
  node: CommittedHostNode,
  domParent: ParentNode,
  context: ReconcileContext,
): void {
  let children = node._children
  if (isHeadHostNode(node)) {
    for (let i = 0; i < children.length; i++) {
      remove(children[i], node._dom, context)
    }
  } else {
    // Clean up all descendants first (before removing DOM subtree)
    for (let i = 0; i < children.length; i++) {
      cleanupDescendants(children[i], context)
    }
  }

  teardownMixins(node._mixState)
  // Never remove the real document.head node when reconciling a <head> vnode,
  // and since it stays alive, detach its listeners for real.
  if (isHeadHostNode(node)) {
    teardownDirectEventListeners(node)
    teardownControlledReflection(node)
  } else {
    abandonDirectEventListeners(node)
    abandonControlledReflection(node)
    node._dom.parentNode?.removeChild(node._dom)
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

  if (
    next.length === 0 &&
    anchor === undefined &&
    !parentUsesInnerHTML(vParent) &&
    canBulkClearChildren(curr)
  ) {
    for (let i = 0; i < curr.length; i++) {
      cleanupDescendants(curr[i], context)
    }
    domParent.textContent = ''
    return EMPTY_COMMITTED_CHILDREN
  }

  if (!hasKeys) {
    for (let i = 0; i < next.length; i++) {
      let currentNode = i < curr.length ? curr[i] : null
      committed[i] = diffVNodes(currentNode, next[i], domParent, vParent, context, anchor, cursor)
    }

    if (curr.length > next.length) {
      for (let i = next.length; i < curr.length; i++) {
        let node = curr[i]
        if (node) remove(node, domParent, context)
      }
    }

    return committed as CommittedVNode[]
  }

  return patchKeyedChildren(curr, next, domParent, vParent, context, cursor, anchor)
}

function parentUsesInnerHTML(parent: VNodeParent): boolean {
  return isHostNode(parent) && getHostProps(parent).innerHTML != null
}

function canBulkClearChildren(children: CommittedVNode[]): boolean {
  for (let i = 0; i < children.length; i++) {
    if (!canBulkClearNode(children[i])) return false
  }
  return true
}

function canBulkClearNode(node: CommittedVNode): boolean {
  if (isCommittedTextNode(node)) return true

  if (isCommittedHostNode(node)) {
    if (node._mixState) return false
    return canBulkClearChildren(node._children)
  }

  if (isFragmentNode(node)) {
    return canBulkClearChildren(node._children)
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
  let seenKeys: Set<Key> | undefined
  let duplicateKeys: Set<Key> | undefined

  for (let node of children) {
    if (node.key == null) continue

    if (!seenKeys) {
      seenKeys = new Set([node.key])
      continue
    }

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
  let matches =
    matchKeyedChildrenInOrder(curr, next) ??
    matchKeyedChildrenAfterSingleRemoval(curr, next) ??
    matchKeyedChildrenAfterPairSwap(curr, next)
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

  for (let index = 0; index < next.length; index++) {
    let oldIndex = matches[index]
    let oldNode = oldIndex >= 0 ? curr[oldIndex] : null

    committed[index] = diffVNodes(oldNode, next[index], domParent, vParent, context, anchor, cursor)
  }
  let committedChildren = committed as CommittedVNode[]

  if (matchAnalysis.canSkipPlacement) {
    return committedChildren
  }

  let stableIndexes = lisMatches(matches)
  let stableCursor = stableIndexes.length - 1
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
  let oldKeyMap = new Map<Key, number>()
  let usedOldIndexes = new Set<number>()
  let unkeyedSearchStart = 0

  for (let index = 0; index < curr.length; index++) {
    let key = curr[index].key
    if (key != null) oldKeyMap.set(key, index)
  }

  let matches: number[] = []
  for (let nextIndex = 0; nextIndex < next.length; nextIndex++) {
    let nextNode = next[nextIndex]
    let oldIndex = -1

    if (nextNode.key != null) {
      let keyedOldIndex = oldKeyMap.get(nextNode.key)
      if (keyedOldIndex !== undefined) {
        let oldNode = curr[keyedOldIndex]
        if (!usedOldIndexes.has(keyedOldIndex) && oldNode.type === nextNode.type) {
          oldIndex = keyedOldIndex
        }
      }
    } else {
      for (let index = unkeyedSearchStart; index < curr.length; index++) {
        let oldNode = curr[index]
        if (usedOldIndexes.has(index) || oldNode.key != null || oldNode.type !== nextNode.type) {
          continue
        }

        oldIndex = index
        unkeyedSearchStart = index + 1
        break
      }
    }

    if (oldIndex >= 0) usedOldIndexes.add(oldIndex)
    matches.push(oldIndex)
  }

  return matches
}

function matchKeyedChildrenInOrder(curr: CommittedVNode[], next: VNodeInput[]): number[] | null {
  let length = Math.min(curr.length, next.length)
  let matches: number[] = []

  for (let index = 0; index < length; index++) {
    let nextNode = next[index]
    if (nextNode.key == null) return null

    let oldNode = curr[index]
    if (oldNode.key !== nextNode.key || oldNode.type !== nextNode.type) {
      return null
    }

    matches.push(index)
  }

  for (let index = length; index < next.length; index++) {
    if (next[index].key == null) return null
    matches.push(-1)
  }

  return matches
}

function matchKeyedChildrenAfterSingleRemoval(
  curr: CommittedVNode[],
  next: VNodeInput[],
): number[] | null {
  if (curr.length !== next.length + 1) return null

  let matches: number[] = []
  let oldIndex = 0
  let skippedOldNode = false

  for (let nextIndex = 0; nextIndex < next.length; nextIndex++) {
    let nextNode = next[nextIndex]
    if (nextNode.key == null) return null

    let oldNode = curr[oldIndex]
    if (oldNode.key === nextNode.key && oldNode.type === nextNode.type) {
      matches.push(oldIndex)
      oldIndex++
      continue
    }

    if (skippedOldNode) return null
    skippedOldNode = true
    oldIndex++

    oldNode = curr[oldIndex]
    if (oldNode.key !== nextNode.key || oldNode.type !== nextNode.type) {
      return null
    }

    matches.push(oldIndex)
    oldIndex++
  }

  return matches
}

function matchKeyedChildrenAfterPairSwap(
  curr: CommittedVNode[],
  next: VNodeInput[],
): number[] | null {
  if (curr.length !== next.length) return null

  let matches: number[] = []
  let firstMismatch = -1
  let secondMismatch = -1

  for (let index = 0; index < next.length; index++) {
    let nextNode = next[index]
    if (nextNode.key == null) return null

    let oldNode = curr[index]
    if (oldNode.key === nextNode.key && oldNode.type === nextNode.type) {
      matches.push(index)
      continue
    }

    if (firstMismatch === -1) {
      firstMismatch = index
    } else if (secondMismatch === -1) {
      secondMismatch = index
    } else {
      return null
    }
    matches.push(-1)
  }

  if (firstMismatch === -1) return matches
  if (secondMismatch === -1) return null

  let firstOldNode = curr[firstMismatch]
  let secondOldNode = curr[secondMismatch]
  let firstNextNode = next[firstMismatch]
  let secondNextNode = next[secondMismatch]

  if (
    firstOldNode.key !== secondNextNode.key ||
    firstOldNode.type !== secondNextNode.type ||
    secondOldNode.key !== firstNextNode.key ||
    secondOldNode.type !== firstNextNode.type
  ) {
    return null
  }

  matches[firstMismatch] = secondMismatch
  matches[secondMismatch] = firstMismatch
  return matches
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

function lisMatches(matches: readonly number[]): number[] {
  let predecessors = Array.from<number>({ length: matches.length })
  let tails: number[] = []

  for (let index = 0; index < matches.length; index++) {
    let value = matches[index] + 1
    if (value === 0) continue

    let low = 0
    let high = tails.length

    while (low < high) {
      let middle = (low + high) >> 1

      if (matches[tails[middle]] + 1 < value) {
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
  if (firstDom === anchor) return

  moveDomRange(domParent, firstDom, lastDom, anchor)
}

export function findFirstDomAnchor(node: CommittedVNode | null | undefined): Node | null {
  if (!node) return null
  if (isCommittedTextNode(node)) return node._dom
  if (isCommittedHostNode(node)) return node._dom
  if (isCommittedComponentNode(node)) return findFirstDomAnchor(node._content)
  if (node.kind === 'frame') return node._rangeStart
  if (isFragmentNode(node)) {
    let children = node._children
    for (let i = 0; i < children.length; i++) {
      let dom = findFirstDomAnchor(children[i])
      if (dom) return dom
    }
  }
  return null
}

export function findLastDomAnchor(node: CommittedVNode | null | undefined): Node | null {
  if (!node) return null
  if (isCommittedTextNode(node)) return node._dom
  if (isCommittedHostNode(node)) return node._dom
  if (isCommittedComponentNode(node)) return findLastDomAnchor(node._content)
  if (node.kind === 'frame') return node._rangeEnd
  if (isFragmentNode(node)) {
    for (let i = node._children.length - 1; i >= 0; i--) {
      let dom = findLastDomAnchor(node._children[i])
      if (dom) return dom
    }
  }
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
  let current: Node | null = first
  while (current) {
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
    if (!(parent instanceof Node)) continue
    let parentNode = parent
    if (parentNode === node) return false
    if (parentNode.contains(node)) return false
  }
  return true
}

export function findNextSiblingDomAnchor(
  curr: CommittedVNode | MountingComponentNode,
): Node | null {
  let vParent = curr._parent
  if (vParent.kind === 'component') return findNextSiblingDomAnchor(vParent)
  let children = vParent._children
  if (children.length === 0) {
    if (vParent.kind === 'root') return vParent._rangeEnd ?? null
    if (vParent.kind === 'fragment') return findNextSiblingDomAnchor(vParent)
    return null
  }

  let idx = children.indexOf(curr as CommittedVNode)
  if (idx === -1) return null
  for (let i = idx + 1; i < children.length; i++) {
    let dom = findFirstDomAnchor(children[i])
    if (dom) return dom
  }

  if (isFragmentNode(vParent)) {
    return findNextSiblingDomAnchor(vParent)
  }

  return vParent.kind === 'root' ? (vParent._rangeEnd ?? null) : null
}

function reclaimPersistedMixinNode(
  persistedNode: CommittedHostNode,
  newNode: HostNode,
  vParent: VNodeParent,
  context: ReconcileContext,
): CommittedHostNode {
  let { frame, scheduler, styles } = context
  cancelPendingMixinRemoval(persistedNode._mixState)
  unmarkNodePersistedByMixins(persistedNode)

  let prevProps = getHostProps(persistedNode)
  let childInputs = newNode._children
  let resolved = resolveNodeMixProps(newNode, vParent, frame, scheduler, persistedNode._mixState)
  let nextProps = resolved.props
  let committed = commitHostNode(
    newNode,
    vParent,
    getSvgContext(vParent, newNode),
    persistedNode._dom,
    resolved,
  )
  committed._directEventState = persistedNode._directEventState
  committed._controlledState = persistedNode._controlledState
  if (shouldDispatchInlineMixinLifecycle(persistedNode._dom)) {
    dispatchMixinBeforeUpdate(committed._mixState)
  }
  patchHostProps(prevProps, nextProps, persistedNode._dom)
  syncDirectEventListeners(committed)
  ensureControlledReflection(committed, scheduler)
  syncControlledReflection(committed, nextProps)

  committed._children = diffChildren(
    persistedNode._children,
    childInputs,
    persistedNode._dom,
    committed,
    context,
  )

  if (committed._mixState) {
    bindNodeMixRuntime(committed, frame, scheduler, styles, true)
  }
  if (shouldDispatchInlineMixinLifecycle(persistedNode._dom)) {
    scheduler.enqueueCommitPhase([() => dispatchMixinCommit(committed._mixState)])
  }
  return committed
}
