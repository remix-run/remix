import type { Component, ComponentHandle, FrameContent, FrameHandle } from './component.ts'
import { createComponent, Frame } from './component.ts'
import type { Frame as FrameInstance, FrameRuntime } from './frame.ts'
import { createFrame } from './frame.ts'
import { createRangeRoot } from './vdom.ts'
import type {
  ComponentNode,
  CommittedComponentNode,
  CommittedHostNode,
  CommittedTextNode,
  FragmentNode,
  HostNode,
  TextNode,
  VNode,
  VNodeType,
} from './vnode.ts'
import {
  isCommittedComponentNode,
  isComponentNode,
  isCommittedHostNode,
  isCommittedTextNode,
  isFragmentNode,
  isHostNode,
  isTextNode,
  findContextFromAncestry,
} from './vnode.ts'
import { invariant } from './invariant.ts'
import { diffHostProps } from './diff-props.ts'
import type { StyleManager } from './style/index.ts'
import type { ElementProps } from './jsx.ts'
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
  type MixinRuntimeState,
} from './mixin.ts'

const SVG_NS = 'http://www.w3.org/2000/svg'

// Internal diffing flags (modeled after Preact)
const INSERT_VNODE = 1 << 0
const MATCHED = 1 << 1

let idCounter = 0
let persistedRemovalToken = 0
let persistedMixinNodes = new Set<CommittedHostNode>()
let activeSchedulerUpdateParents: ParentNode[] | undefined

// Compute SVG context for a node based on its parent and type.
// Returns true if the node is within an SVG subtree, false otherwise.
function getSvgContext(vParent: VNode, nodeType: VNodeType): boolean {
  // Only host elements (strings) can affect SVG context
  if (typeof nodeType === 'string') {
    // svg element creates SVG context
    if (nodeType === 'svg') return true
    // foreignObject switches back to HTML context
    if (nodeType === 'foreignObject') return false
  }
  // Otherwise inherit from parent
  return vParent._svg ?? false
}

function getHostProps(node: HostNode | CommittedHostNode): ElementProps {
  return node._mixedProps ?? node.props
}

function markNodePersistedByMixins(node: CommittedHostNode, domParent: ParentNode, token: number) {
  node._persistedByMixins = true
  node._persistedParentByMixins = domParent
  node._persistedRemovalToken = token
  persistedMixinNodes.add(node)
  bindMixinRuntime(node._mixState as MixinRuntimeState | undefined, undefined)
}

function unmarkNodePersistedByMixins(node: CommittedHostNode) {
  node._persistedByMixins = false
  node._persistedParentByMixins = undefined
  node._persistedRemovalToken = undefined
  persistedMixinNodes.delete(node)
}

function findMatchingPersistedMixinNode(
  type: string,
  key: string | undefined,
  domParent: ParentNode,
): CommittedHostNode | null {
  if (key == null) return null
  for (let node of persistedMixinNodes) {
    if (node._persistedParentByMixins !== domParent) continue
    if (node.type !== type) continue
    if (node.key !== key) continue
    return node
  }
  return null
}

type ControlledReflectionState = {
  disposed: boolean
  listenersAttached: boolean
  pendingRestoreVersion: number
  managesValue: boolean
  managesChecked: boolean
  hasControlledValue: boolean
  controlledValue: unknown
  hasControlledChecked: boolean
  controlledChecked: unknown
  onInput: () => void
  onChange: () => void
}

function ensureControlledReflection(
  node: CommittedHostNode,
  scheduler: Scheduler,
): ControlledReflectionState {
  let existing = node._controlledState as ControlledReflectionState | undefined
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

function syncControlledReflection(node: CommittedHostNode, props: ElementProps): void {
  let state = node._controlledState as ControlledReflectionState | undefined
  if (!state || state.disposed) return

  state.managesValue = canManageValue(node.type, node._dom)
  state.managesChecked = canReflectProperty(node._dom, 'checked')
  state.hasControlledValue = state.managesValue && hasControlledValueProp(props)
  state.controlledValue = props.value
  state.hasControlledChecked = state.managesChecked && hasControlledCheckedProp(props)
  state.controlledChecked = props.checked
  state.pendingRestoreVersion++
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
  let state = node._controlledState as ControlledReflectionState | undefined
  if (!state) return
  state.disposed = true
  state.pendingRestoreVersion++
  if (state.listenersAttached) {
    node._dom.removeEventListener('input', state.onInput)
    node._dom.removeEventListener('change', state.onChange)
    state.listenersAttached = false
  }
}

function canManageValue(type: string, element: Element): boolean {
  if (type === 'progress') return false
  return canReflectProperty(element, 'value')
}

function hasControlledValueProp(props: ElementProps): boolean {
  return 'value' in props && props.value !== undefined
}

function hasControlledCheckedProp(props: ElementProps): boolean {
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

function resolveNodeMixProps(
  node: HostNode,
  frame: FrameHandle,
  scheduler: Scheduler,
  state?: MixinRuntimeState,
): ElementProps {
  let resolved = resolveMixedProps({
    hostType: node.type,
    frame,
    scheduler,
    props: node.props,
    state,
  })
  node._mixState = resolved.state
  node._mixedProps = resolved.props
  return resolved.props
}

function bindNodeMixRuntime(
  node: CommittedHostNode,
  frame: FrameHandle,
  scheduler: Scheduler,
  styles: StyleManager,
  reclaimed: boolean = false,
  parent?: ParentNode,
) {
  let state = node._mixState as MixinRuntimeState | undefined
  bindMixinRuntime(
    state,
    {
      node: node._dom,
      parent: parent ?? (node._dom.parentNode as ParentNode),
      key: node.key,
      enqueueUpdate(done) {
        scheduler.enqueueTasks([
          () => {
            if (state?.aborted) {
              done(getMixinRuntimeSignal(state))
              return
            }

            dispatchMixinBeforeUpdate(state)
            let prevProps = getHostProps(node)
            let nextProps = resolveNodeMixProps(node, frame, scheduler, state)
            diffHostProps(prevProps, nextProps, node._dom)

            dispatchMixinCommit(state)
            done(state ? getMixinRuntimeSignal(state) : AbortSignal.abort())
          },
        ])
      },
    },
    { dispatchReclaimed: reclaimed },
  )
}

function isHeadHostNode(node: HostNode): boolean {
  return node.type.toLowerCase() === 'head'
}

function isHeadManagedHostNode(node: HostNode): boolean {
  let tag = node.type.toLowerCase()
  if (tag === 'title' || tag === 'meta' || tag === 'link' || tag === 'style') {
    return true
  }
  if (tag === 'script') {
    let props = getHostProps(node)
    return props.type === 'application/ld+json'
  }
  return false
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

export function diffVNodes(
  curr: VNode | null,
  next: VNode,
  domParent: ParentNode,
  frame: FrameHandle,
  scheduler: Scheduler,
  styles: StyleManager,
  vParent: VNode,
  rootTarget: EventTarget,
  anchor?: Node,
  rootCursor?: Node | null,
): Node | null | undefined {
  next._parent = vParent // set parent for initial render context lookups
  next._svg = getSvgContext(vParent, next.type)

  // new
  if (curr === null) {
    return insert(
      next,
      domParent,
      frame,
      scheduler,
      styles,
      vParent,
      rootTarget,
      anchor,
      rootCursor,
    )
  }

  if (curr.type !== next.type) {
    replace(curr, next, domParent, frame, scheduler, styles, vParent, rootTarget, anchor)
    return rootCursor
  }

  if (isCommittedTextNode(curr) && isTextNode(next)) {
    diffText(curr, next, vParent)
    return rootCursor
  }

  if (isCommittedHostNode(curr) && isHostNode(next)) {
    diffHost(curr, next, frame, scheduler, styles, vParent, rootTarget)
    return rootCursor
  }

  if (isCommittedComponentNode(curr) && isComponentNode(next)) {
    diffComponent(curr, next, frame, scheduler, styles, domParent, vParent, rootTarget)
    return rootCursor
  }

  if (isFragmentNode(curr) && isFragmentNode(next)) {
    diffChildren(
      curr._children,
      next._children,
      domParent,
      frame,
      scheduler,
      styles,
      vParent,
      rootTarget,
      undefined,
      anchor,
    )
    return rootCursor
  }

  if (curr.type === Frame && next.type === Frame) {
    diffFrame(curr, next, domParent, frame, scheduler, styles, vParent, rootTarget, anchor)
    return rootCursor
  }

  invariant(false, 'Unexpected diff case')
}

function replace(
  curr: VNode,
  next: VNode,
  domParent: ParentNode,
  frame: FrameHandle,
  scheduler: Scheduler,
  styles: StyleManager,
  vParent: VNode,
  rootTarget: EventTarget,
  anchor?: Node,
) {
  // Use curr's DOM position (most accurate) when it belongs to this parent.
  // Hoisted head nodes live under document.head and cannot be used as anchors
  // for body/range insertions.
  let currAnchor = findFirstDomAnchor(curr)
  if (currAnchor && currAnchor.parentNode === domParent) {
    anchor = currAnchor
  }
  insert(next, domParent, frame, scheduler, styles, vParent, rootTarget, anchor)
  remove(curr, domParent, scheduler, styles)
}

function diffHost(
  curr: CommittedHostNode,
  next: HostNode,
  frame: FrameHandle,
  scheduler: Scheduler,
  styles: StyleManager,
  vParent: VNode,
  rootTarget: EventTarget,
) {
  let mixState = curr._mixState as MixinRuntimeState | undefined
  let currProps = getHostProps(curr)
  let nextProps = resolveNodeMixProps(next, frame, scheduler, mixState)
  if (shouldDispatchInlineMixinLifecycle(curr._dom)) {
    dispatchMixinBeforeUpdate(next._mixState as MixinRuntimeState | undefined)
  }

  // Handle innerHTML prop BEFORE diffChildren to avoid clearing children
  if (nextProps.innerHTML != null) {
    // innerHTML is set, update it if changed
    if (currProps.innerHTML !== nextProps.innerHTML) {
      curr._dom.innerHTML = nextProps.innerHTML as string
    }
  } else if (currProps.innerHTML != null) {
    // innerHTML was removed, clear it before adding children
    curr._dom.innerHTML = ''
  }

  diffChildren(
    curr._children,
    next._children,
    curr._dom,
    frame,
    scheduler,
    styles,
    next,
    rootTarget,
  )
  diffHostProps(currProps, nextProps, curr._dom)

  next._dom = curr._dom
  next._parent = vParent
  next._controller = curr._controller
  next._controlledState = curr._controlledState

  ensureControlledReflection(next as CommittedHostNode, scheduler)
  syncControlledReflection(next as CommittedHostNode, nextProps)

  bindNodeMixRuntime(next as CommittedHostNode, frame, scheduler, styles)
  if (shouldDispatchInlineMixinLifecycle(curr._dom)) {
    scheduler.enqueueTasks([
      () => dispatchMixinCommit(next._mixState as MixinRuntimeState | undefined),
    ])
  }

  return
}

function setupHostNode(node: HostNode, dom: Element, scheduler: Scheduler): void {
  node._dom = dom
  let props = getHostProps(node)
  let committedNode = node as CommittedHostNode

  ensureControlledReflection(committedNode, scheduler)
  syncControlledReflection(committedNode, props)
}

function diffText(curr: CommittedTextNode, next: TextNode, vParent: VNode) {
  if (curr._text !== next._text) {
    curr._dom.textContent = next._text
  }
  next._dom = curr._dom
  next._parent = vParent
}

function insert(
  node: VNode,
  domParent: ParentNode,
  frame: FrameHandle,
  scheduler: Scheduler,
  styles: StyleManager,
  vParent: VNode,
  rootTarget: EventTarget,
  anchor?: Node,
  cursor?: Node | null,
): Node | null | undefined {
  node._parent = vParent // set parent for initial render context lookups
  node._svg = getSvgContext(vParent, node.type)

  // Stop hydration if cursor has reached the anchor (end boundary)
  // Check BEFORE skipComments to prevent escaping range root markers
  if (cursor && anchor && cursor === anchor) {
    cursor = null
  }

  cursor =
    node.type === Frame
      ? skipCommentsExceptFrameStart(cursor ?? null)
      : skipComments(cursor ?? null)

  // Also check after skipComments in case we skipped past the anchor
  if (cursor && anchor && cursor === anchor) {
    cursor = null
  }

  let doInsert = anchor
    ? (dom: Node) => domParent.insertBefore(dom, anchor)
    : (dom: Node) => domParent.appendChild(dom)

  if (isTextNode(node)) {
    if (cursor instanceof Text) {
      node._parent = vParent
      // Handle text node consolidation: server renders adjacent text as single node
      // e.g., <span>Hello {world}</span> → server: "Hello world", client: ["Hello ", "world"]
      if (cursor.data !== node._text) {
        if (cursor.data.startsWith(node._text) && node._text.length < cursor.data.length) {
          // Consolidation case: split the text node at the boundary
          // cursor becomes the first part (node._text), remainder is returned for next vnode
          let remainder = cursor.splitText(node._text.length)
          node._dom = cursor
          return remainder
        }
        // Genuine mismatch - correct it
        logHydrationMismatch('text mismatch', cursor.data, node._text)
        cursor.data = node._text
      }
      node._dom = cursor
      return cursor.nextSibling
    }
    let dom = document.createTextNode(node._text)
    node._dom = dom
    node._parent = vParent
    doInsert(dom)
    return cursor
  }

  if (isHostNode(node)) {
    let hostProps = resolveNodeMixProps(node, frame, scheduler)

    if (isHeadHostNode(node)) {
      let targetHead = getDocumentHead(domParent)
      if (targetHead) {
        let childCursor = cursor
        if (cursor instanceof Element && cursor.tagName.toLowerCase() === 'head') {
          childCursor = cursor.firstChild
          let nextCursor = cursor.nextSibling
          if (cursor !== targetHead) {
            while (cursor.firstChild) {
              targetHead.appendChild(cursor.firstChild)
            }
            cursor.remove()
          }
          cursor = nextCursor
        }

        // Render explicit <head> children directly into document.head.
        diffChildren(
          null,
          node._children,
          targetHead,
          frame,
          scheduler,
          styles,
          node,
          rootTarget,
          childCursor,
        )
        diffHostProps({}, hostProps, targetHead)
        setupHostNode(node, targetHead, scheduler)
        bindNodeMixRuntime(node as CommittedHostNode, frame, scheduler, styles)
        return cursor
      }
    }

    // Check for matching mixin-persisted node that can be reclaimed
    let persistedNode = findMatchingPersistedMixinNode(node.type, node.key, domParent)
    if (persistedNode) {
      reclaimPersistedMixinNode(persistedNode, node, frame, scheduler, styles, vParent, rootTarget)
      return cursor
    }

    if (cursor instanceof Element) {
      // SVG elements have case-sensitive tag names (e.g. linearGradient, clipPath)
      // HTML elements are case-insensitive, so we lowercase for comparison
      let cursorTag = node._svg ? cursor.tagName : cursor.tagName.toLowerCase()
      if (cursorTag === node.type) {
        let nextCursor = cursor.nextSibling
        diffHostProps({}, hostProps, cursor)

        // Handle innerHTML prop
        if (hostProps.innerHTML != null) {
          cursor.innerHTML = hostProps.innerHTML as string
        } else {
          let childCursor = cursor.firstChild
          // Ignore excess nodes - browser extensions may inject content
          diffChildren(
            null,
            node._children,
            cursor,
            frame,
            scheduler,
            styles,
            node,
            rootTarget,
            childCursor,
          )
        }

        setupHostNode(node, cursor, scheduler)
        bindNodeMixRuntime(node as CommittedHostNode, frame, scheduler, styles)
        if (isHeadManagedHostNode(node)) {
          let targetHead = getDocumentHead(domParent)
          if (targetHead && cursor.parentNode !== targetHead) {
            targetHead.appendChild(cursor)
          }
        }
        return nextCursor
      } else {
        // Type mismatch - try single-advance retry to handle browser extension injections
        // at the start of containers. Skip this node and try the next sibling once.
        let nextSibling = skipComments(cursor.nextSibling)
        if (nextSibling instanceof Element) {
          let nextTag = node._svg ? nextSibling.tagName : nextSibling.tagName.toLowerCase()
          if (nextTag === node.type) {
            let nextCursor = nextSibling.nextSibling
            // Found a match after skipping - adopt it and leave skipped node in place
            diffHostProps({}, hostProps, nextSibling)

            if (hostProps.innerHTML != null) {
              nextSibling.innerHTML = hostProps.innerHTML as string
            } else {
              let childCursor = nextSibling.firstChild
              diffChildren(
                null,
                node._children,
                nextSibling,
                frame,
                scheduler,
                styles,
                node,
                rootTarget,
                childCursor,
              )
            }

            setupHostNode(node, nextSibling, scheduler)
            bindNodeMixRuntime(node as CommittedHostNode, frame, scheduler, styles)
            if (isHeadManagedHostNode(node)) {
              let targetHead = getDocumentHead(domParent)
              if (targetHead && nextSibling.parentNode !== targetHead) {
                targetHead.appendChild(nextSibling)
              }
            }
            return nextCursor
          }
        }
        // Retry failed - log mismatch and create new element (don't remove mismatched nodes)
        logHydrationMismatch('tag', cursorTag, node.type)
        cursor = undefined // stop hydration for this tree
      }
    }
    let dom = node._svg
      ? document.createElementNS(SVG_NS, node.type)
      : document.createElement(node.type)
    diffHostProps({}, hostProps, dom)

    // Handle innerHTML prop
    if (hostProps.innerHTML != null) {
      dom.innerHTML = hostProps.innerHTML as string
    } else {
      diffChildren(null, node._children, dom, frame, scheduler, styles, node, rootTarget)
    }

    setupHostNode(node, dom, scheduler)
    bindNodeMixRuntime(node as CommittedHostNode, frame, scheduler, styles, false, domParent)
    if (isHeadManagedHostNode(node)) {
      let targetHead = getDocumentHead(domParent)
      if (targetHead) {
        targetHead.appendChild(dom)
      } else {
        doInsert(dom)
      }
    } else {
      doInsert(dom)
    }
    return cursor
  }

  if (isFragmentNode(node)) {
    // Insert fragment children in order before the same anchor
    for (let child of node._children) {
      cursor = insert(
        child,
        domParent,
        frame,
        scheduler,
        styles,
        vParent,
        rootTarget,
        anchor,
        cursor,
      )
    }
    return cursor
  }

  if (isComponentNode(node)) {
    return diffComponent(
      null,
      node,
      frame,
      scheduler,
      styles,
      domParent,
      vParent,
      rootTarget,
      anchor,
      cursor,
    )
  }

  if (node.type === Frame) {
    return insertFrame(
      node,
      domParent,
      frame,
      scheduler,
      styles,
      vParent,
      rootTarget,
      anchor,
      cursor,
    )
  }

  invariant(false, 'Unexpected node type')
}

function diffFrame(
  curr: VNode,
  next: VNode,
  domParent: ParentNode,
  frame: FrameHandle,
  scheduler: Scheduler,
  styles: StyleManager,
  vParent: VNode,
  rootTarget: EventTarget,
  anchor?: Node,
): void {
  let currSrc = getFrameSrc(curr)
  let nextSrc = getFrameSrc(next)
  let currName = getFrameName(curr)
  let nextName = getFrameName(next)

  if (currName !== nextName) {
    let replaceAnchor = curr._rangeEnd?.nextSibling ?? anchor
    remove(curr, domParent, scheduler, styles)
    insert(next, domParent, frame, scheduler, styles, vParent, rootTarget, replaceAnchor)
    return
  }

  // If the frame hasn't resolved yet, preserve existing cancel/remount behavior
  // so pending streams from the old src cannot take over the new src.
  if (currSrc !== nextSrc && !curr._frameResolved) {
    let replaceAnchor = curr._rangeEnd?.nextSibling ?? anchor
    remove(curr, domParent, scheduler, styles)
    insert(next, domParent, frame, scheduler, styles, vParent, rootTarget, replaceAnchor)
    return
  }

  next._rangeStart = curr._rangeStart
  next._rangeEnd = curr._rangeEnd
  next._frameInstance = curr._frameInstance
  next._frameFallbackRoot = curr._frameFallbackRoot
  next._frameResolveToken = curr._frameResolveToken
  next._frameResolved = curr._frameResolved
  next._parent = vParent

  if (currSrc !== nextSrc) {
    let frameInstance = next._frameInstance as FrameInstance | undefined
    if (frameInstance) {
      frameInstance.handle.src = nextSrc
    }

    let runtime = getFrameRuntime(frame)
    if (runtime) {
      resolveClientFrame(next, runtime, rootTarget)
    }
  }

  if (!next._frameResolved && next._frameFallbackRoot) {
    next._frameFallbackRoot.render(next.props?.fallback ?? null)
  }
}

function insertFrame(
  node: VNode,
  domParent: ParentNode,
  frame: FrameHandle,
  scheduler: Scheduler,
  styles: StyleManager,
  vParent: VNode,
  rootTarget: EventTarget,
  anchor?: Node,
  cursor?: Node | null,
): Node | null | undefined {
  let runtime = getFrameRuntime(frame)
  if (!runtime || (runtime as { canResolveFrames?: boolean }).canResolveFrames === false) {
    throw new Error(
      'Cannot render <Frame /> without frame runtime. Use run() or pass frameInit to createRoot/createRangeRoot.',
    )
  }

  // Hydration path: adopt server-rendered frame markers and reuse the existing
  // frame instance created during createSubFrames().
  if (isFrameStartComment(cursor)) {
    let start = cursor
    let end = findFrameEndComment(start)
    if (end) {
      node._rangeStart = start
      node._rangeEnd = end
      node._parent = vParent
      node._frameResolveToken = 0
      node._frameResolveController = undefined
      node._frameFallbackRoot = undefined
      node._frameResolved = true

      let frameId = getFrameIdFromComment(start)
      let marker = frameId ? runtime.data.f?.[frameId] : undefined
      let src = marker?.src ?? getFrameSrc(node)
      let instance = runtime.frameInstances.get(start)
      if (!instance) {
        instance = createFrame([start, end], {
          name: getFrameName(node),
          src,
          marker: frameId && marker ? { ...marker, id: frameId } : undefined,
          loadModule: runtime.loadModule,
          resolveFrame: runtime.resolveFrame,
          pendingClientEntries: runtime.pendingClientEntries,
          scheduler: runtime.scheduler,
          styleManager: runtime.styleManager,
          data: runtime.data,
          moduleCache: runtime.moduleCache,
          moduleLoads: runtime.moduleLoads,
          frameInstances: runtime.frameInstances,
          namedFrames: runtime.namedFrames,
        })
        runtime.frameInstances.set(start, instance)
      }

      node._frameInstance = instance

      return end.nextSibling
    }
  }

  let start = document.createComment(` rmx:f:${randomFrameId()} `)
  let end = document.createComment(' /rmx:f ')
  let doInsert = anchor
    ? (dom: Node) => domParent.insertBefore(dom, anchor)
    : (dom: Node) => domParent.appendChild(dom)

  doInsert(start)
  doInsert(end)

  node._rangeStart = start
  node._rangeEnd = end
  node._parent = vParent

  let fallbackRoot = createRangeRoot([start, end], {
    frame,
    styleManager: styles,
  })
  fallbackRoot.render(node.props?.fallback ?? null)
  node._frameFallbackRoot = fallbackRoot
  node._frameResolved = false
  node._frameResolveToken = 0

  let instance = createFrame([start, end], {
    name: getFrameName(node),
    src: getFrameSrc(node),
    loadModule: runtime.loadModule,
    resolveFrame: runtime.resolveFrame,
    pendingClientEntries: runtime.pendingClientEntries,
    scheduler: runtime.scheduler,
    styleManager: runtime.styleManager,
    data: runtime.data,
    moduleCache: runtime.moduleCache,
    moduleLoads: runtime.moduleLoads,
    frameInstances: runtime.frameInstances,
    namedFrames: runtime.namedFrames,
  })
  node._frameInstance = instance
  runtime.frameInstances.set(start, instance)

  resolveClientFrame(node, runtime, rootTarget)

  return cursor
}

function resolveClientFrame(node: VNode, runtime: FrameRuntime, rootTarget: EventTarget): void {
  let frameSrc = getFrameSrc(node)
  let instance = node._frameInstance as FrameInstance | undefined
  if (!instance) return

  let token = (node._frameResolveToken ?? 0) + 1
  node._frameResolveToken = token
  node._frameResolveController?.abort()
  let resolveController = new AbortController()
  node._frameResolveController = resolveController

  Promise.resolve(runtime.resolveFrame(frameSrc, resolveController.signal))
    .then(async (content) => {
      if (node._frameResolveToken !== token || resolveController.signal.aborted) return
      node._frameFallbackRoot?.dispose()
      node._frameFallbackRoot = undefined
      let nextContent = asAbortableFrameContent(content, resolveController.signal)
      await instance.render(nextContent, { signal: resolveController.signal })
      if (node._frameResolveToken !== token || resolveController.signal.aborted) return
      node._frameResolved = true
    })
    .catch(() => {})
    .finally(() => {
      if (node._frameResolveController === resolveController) {
        node._frameResolveController = undefined
      }
    })
}

function disposeFrameResources(node: VNode): void {
  node._frameResolveToken = (node._frameResolveToken ?? 0) + 1
  node._frameResolveController?.abort()
  node._frameResolveController = undefined
  node._frameFallbackRoot?.dispose()
  node._frameFallbackRoot = undefined

  let frameInstance = node._frameInstance as FrameInstance | undefined
  if (frameInstance) {
    frameInstance.dispose()
    node._frameInstance = undefined
  }
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
      let abortRead = new Promise<ReadableStreamReadResult<Uint8Array>>((resolve) => {
        if (signal.aborted) {
          resolve({ done: true, value: undefined as unknown as Uint8Array })
          return
        }
        let onAbortRead = () => {
          resolve({ done: true, value: undefined as unknown as Uint8Array })
        }
        removeAbortReadListener = () => signal.removeEventListener('abort', onAbortRead)
        signal.addEventListener('abort', onAbortRead, { once: true })
      })

      let { done, value } = await Promise.race([reader.read(), abortRead])
      removeAbortReadListener?.()

      if (done) {
        controller.close()
        return
      }
      controller.enqueue(value)
    },
    cancel(reason) {
      signal.removeEventListener('abort', onAbort)
      return reader.cancel(reason)
    },
  })
}

function removeFrameDomRange(node: VNode, domParent: ParentNode): void {
  let start = node._rangeStart
  let end = node._rangeEnd
  if (!(start instanceof Comment) || !(end instanceof Comment)) return

  let cursor: Node | null = start
  while (cursor) {
    let nextSibling: Node | null = cursor.nextSibling
    if (cursor.parentNode === domParent) {
      domParent.removeChild(cursor)
    }
    if (cursor === end) break
    cursor = nextSibling
  }

  node._rangeStart = undefined
  node._rangeEnd = undefined
}

function getFrameRuntime(frame: FrameHandle): FrameRuntime | undefined {
  return frame.$runtime as FrameRuntime | undefined
}

function getFrameSrc(node: VNode): string {
  let src = node.props?.src
  invariant(typeof src === 'string' && src.length > 0, '<Frame /> requires a src prop')
  return src
}

function getFrameName(node: VNode): string | undefined {
  let name = node.props?.name
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
  return node instanceof Comment && node.data.trim().startsWith('rmx:f:')
}

function isFrameEndComment(node: Node | null | undefined): node is Comment {
  return node instanceof Comment && node.data.trim() === '/rmx:f'
}

function getFrameIdFromComment(comment: Comment): string | undefined {
  let text = comment.data.trim()
  if (!text.startsWith('rmx:f:')) return undefined
  return text.slice('rmx:f:'.length)
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
  handle: ComponentHandle,
  currContent: VNode | null,
  next: ComponentNode,
  domParent: ParentNode,
  frame: FrameHandle,
  scheduler: Scheduler,
  styles: StyleManager,
  rootTarget: EventTarget,
  vParent?: VNode,
  anchor?: Node,
  cursor?: Node | null,
): Node | null | undefined {
  let [element, tasks] = handle.render(next.props)
  let content = toVNode(element)

  let newCursor = diffVNodes(
    currContent,
    content,
    domParent,
    frame,
    scheduler,
    styles,
    next,
    rootTarget,
    anchor,
    cursor,
  )
  next._content = content
  next._handle = handle
  next._parent = vParent

  let committed = next as CommittedComponentNode

  handle.setScheduleUpdate(() => {
    scheduler.enqueue(committed, domParent)
  })

  scheduler.enqueueTasks(tasks)

  return newCursor
}

function diffComponent(
  curr: CommittedComponentNode | null,
  next: ComponentNode,
  frame: FrameHandle,
  scheduler: Scheduler,
  styles: StyleManager,
  domParent: ParentNode,
  vParent: VNode,
  rootTarget: EventTarget,
  anchor?: Node,
  cursor?: Node | null,
): Node | null | undefined {
  if (curr === null) {
    let componentId = vParent._pendingHydrationComponentId
    if (componentId) {
      vParent._pendingHydrationComponentId = undefined
    } else {
      componentId = `c${++idCounter}`
    }
    next._handle = createComponent({
      id: componentId,
      frame,
      type: next.type,
      getContext: (type: Component) => findContextFromAncestry(vParent, type),
      getFrameByName(name: string) {
        let runtime = getFrameRuntime(frame)
        return runtime?.namedFrames.get(name)
      },
      getTopFrame() {
        let runtime = getFrameRuntime(frame)
        return runtime?.topFrame
      },
    })

    return renderComponent(
      next._handle,
      null,
      next,
      domParent,
      frame,
      scheduler,
      styles,
      rootTarget,
      vParent,
      anchor,
      cursor,
    )
  }
  next._handle = curr._handle
  let { _content, _handle } = curr
  return renderComponent(
    _handle,
    _content,
    next,
    domParent,
    frame,
    scheduler,
    styles,
    rootTarget,
    vParent,
    anchor,
    cursor,
  )
}

// Cleanup without DOM removal - used for descendants when parent DOM node is removed
function cleanupDescendants(node: VNode, scheduler: Scheduler, styles: StyleManager): void {
  if (isCommittedTextNode(node)) {
    return
  }

  if (isCommittedHostNode(node)) {
    for (let child of node._children) {
      cleanupDescendants(child, scheduler, styles)
    }

    teardownMixins(node._mixState as MixinRuntimeState | undefined)
    teardownControlledReflection(node)
    if (node._controller) node._controller.abort()
    return
  }

  if (isFragmentNode(node)) {
    for (let child of node._children) {
      cleanupDescendants(child, scheduler, styles)
    }
    return
  }

  if (isCommittedComponentNode(node)) {
    cleanupDescendants(node._content, scheduler, styles)
    let tasks = node._handle.remove()
    scheduler.enqueueTasks(tasks)
    return
  }

  if (node.type === Frame) {
    disposeFrameResources(node)
    return
  }
}

export function remove(
  node: VNode,
  domParent: ParentNode,
  scheduler: Scheduler,
  styles: StyleManager,
) {
  if (isCommittedTextNode(node)) {
    domParent.removeChild(node._dom)
    return
  }

  if (isCommittedHostNode(node)) {
    if (node._persistedByMixins) return

    let persistedRemoval = prepareMixinRemoval(node._mixState as MixinRuntimeState | undefined)
    if (persistedRemoval) {
      let token = ++persistedRemovalToken
      markNodePersistedByMixins(node, domParent, token)
      void persistedRemoval
        .catch(() => {})
        .finally(() => {
          if (!node._persistedByMixins) return
          if (node._persistedRemovalToken !== token) return
          unmarkNodePersistedByMixins(node)
          performHostNodeRemoval(node, domParent, scheduler, styles)
        })
      return
    }
    performHostNodeRemoval(node, domParent, scheduler, styles)
    return
  }

  if (isFragmentNode(node)) {
    for (let child of node._children) {
      remove(child, domParent, scheduler, styles)
    }
    return
  }

  if (isCommittedComponentNode(node)) {
    remove(node._content, domParent, scheduler, styles)
    let tasks = node._handle.remove()
    scheduler.enqueueTasks(tasks)
    return
  }

  if (node.type === Frame) {
    disposeFrameResources(node)
    removeFrameDomRange(node, domParent)
    return
  }
}

// Actually remove a host node from DOM and clean up
function performHostNodeRemoval(
  node: CommittedHostNode,
  domParent: ParentNode,
  scheduler: Scheduler,
  styles: StyleManager,
) {
  if (isHeadHostNode(node)) {
    for (let child of node._children) {
      remove(child, node._dom, scheduler, styles)
    }
  } else {
    // Clean up all descendants first (before removing DOM subtree)
    for (let child of node._children) {
      cleanupDescendants(child, scheduler, styles)
    }
  }

  teardownMixins(node._mixState as MixinRuntimeState | undefined)
  teardownControlledReflection(node)
  // Never remove the real document.head node when reconciling a <head> vnode.
  if (!isHeadHostNode(node)) {
    node._dom.parentNode?.removeChild(node._dom)
  }
  if (node._controller) node._controller.abort()
}

function diffChildren(
  curr: VNode[] | null,
  next: VNode[],
  domParent: ParentNode,
  frame: FrameHandle,
  scheduler: Scheduler,
  styles: StyleManager,
  vParent: VNode,
  rootTarget: EventTarget,
  cursor?: Node | null,
  anchor?: Node,
) {
  let nextLength = next.length

  // Warn when duplicate keys are present among siblings. Duplicate keys are
  // still processed (last one wins), but they make keyed diffing ambiguous.
  let hasKeys = false
  let seenKeys = new Set<string>()
  let duplicateKeys = new Set<string>()
  for (let i = 0; i < nextLength; i++) {
    let node = next[i]
    if (node && node.key != null) {
      hasKeys = true
      if (seenKeys.has(node.key)) {
        duplicateKeys.add(node.key)
      } else {
        seenKeys.add(node.key)
      }
    }
  }

  if (duplicateKeys.size > 0) {
    let quotedKeys = Array.from(duplicateKeys, (key) => `"${key}"`)
    console.warn(
      `Duplicate keys detected in siblings: ${quotedKeys.join(', ')}. Keys should be unique.`,
    )
  }

  // Initial mount / hydration: delegate to insert() for each child so that
  // hydration cursors and creation logic remain centralized there.
  if (curr === null) {
    for (let node of next) {
      cursor = insert(
        node,
        domParent,
        frame,
        scheduler,
        styles,
        vParent,
        rootTarget,
        anchor,
        cursor,
      )
    }
    vParent._children = next
    return cursor
  }

  let currLength = curr.length

  // Detect if any keys are present in the new children. If not, we can fall
  // back to the simpler index-based diff which is cheaper and matches
  // pre-existing behavior.
  if (!hasKeys) {
    for (let i = 0; i < nextLength; i++) {
      let currentNode = i < currLength ? curr[i] : null
      diffVNodes(
        currentNode,
        next[i],
        domParent,
        frame,
        scheduler,
        styles,
        vParent,
        rootTarget,
        anchor,
        cursor,
      )
    }

    if (currLength > nextLength) {
      for (let i = nextLength; i < currLength; i++) {
        let node = curr[i]
        if (node) remove(node, domParent, scheduler, styles)
      }
    }

    vParent._children = next
    return
  }

  // --- O(n + m) keyed diff with Map-based lookup ------------------------------

  let oldChildren = curr
  let oldChildrenLength = currLength
  let remainingOldChildren = oldChildrenLength

  // Build key → index map for O(1) lookup: O(m)
  let oldKeyMap = new Map<string, number>()
  for (let i = 0; i < oldChildrenLength; i++) {
    let c = oldChildren[i]
    if (c) {
      c._flags = 0
      if (c.key != null) {
        oldKeyMap.set(c.key, i)
      }
    }
  }

  let skew = 0
  let newChildren: VNode[] = new Array(nextLength)

  // First pass: match new children to old ones using Map lookup: O(n)
  for (let i = 0; i < nextLength; i++) {
    let childVNode = next[i]
    if (!childVNode) {
      newChildren[i] = childVNode
      continue
    }

    newChildren[i] = childVNode
    childVNode._parent = vParent

    let skewedIndex = i + skew
    let matchingIndex = -1

    let key = childVNode.key
    let type = childVNode.type

    if (key != null) {
      // O(1) Map lookup for keyed children
      let mapIndex = oldKeyMap.get(key)
      if (mapIndex !== undefined) {
        let candidate = oldChildren[mapIndex]
        let candidateFlags = candidate?._flags ?? 0
        if (candidate && (candidateFlags & MATCHED) === 0 && candidate.type === type) {
          matchingIndex = mapIndex
        }
      }
    } else {
      // Non-keyed children use positional identity only - no searching
      let searchVNode = oldChildren[skewedIndex]
      let searchFlags = searchVNode?._flags ?? 0
      let available = searchVNode != null && (searchFlags & MATCHED) === 0
      if (available && searchVNode.key == null && type === searchVNode.type) {
        matchingIndex = skewedIndex
      }
    }

    childVNode._index = matchingIndex

    let matchedOldVNode: VNode | null = null
    if (matchingIndex !== -1) {
      matchedOldVNode = oldChildren[matchingIndex]
      remainingOldChildren--
      if (matchedOldVNode) {
        matchedOldVNode._flags = (matchedOldVNode._flags ?? 0) | MATCHED
      }
    }

    // Determine whether this is a mount vs move and mark INSERT_VNODE
    let oldDom = matchedOldVNode && findFirstDomAnchor(matchedOldVNode)
    let isMounting = !matchedOldVNode || !oldDom
    if (isMounting) {
      if (matchingIndex === -1) {
        // Adjust skew similar to Preact when lengths differ
        if (nextLength > oldChildrenLength) {
          skew--
        } else if (nextLength < oldChildrenLength) {
          skew++
        }
      }

      childVNode._flags = (childVNode._flags ?? 0) | INSERT_VNODE
    } else if (matchingIndex !== i + skew) {
      if (matchingIndex === i + skew - 1) {
        skew--
      } else if (matchingIndex === i + skew + 1) {
        skew++
      } else {
        if (matchingIndex! > i + skew) skew--
        else skew++
        childVNode._flags = (childVNode._flags ?? 0) | INSERT_VNODE
      }
    }
  }

  // Unmount any old children that weren't matched
  if (remainingOldChildren) {
    for (let i = 0; i < oldChildrenLength; i++) {
      let oldVNode = oldChildren[i]
      if (oldVNode && ((oldVNode._flags ?? 0) & MATCHED) === 0) {
        remove(oldVNode, domParent, scheduler, styles)
      }
    }
  }

  // Second pass: diff matched pairs and place/move DOM nodes in the correct
  // order, similar to Preact's diffChildren + insert.
  vParent._children = newChildren

  let lastPlaced: Node | null = null

  for (let i = 0; i < nextLength; i++) {
    let childVNode = newChildren[i]
    if (!childVNode) continue

    let idx = childVNode._index ?? -1
    let oldVNode = idx >= 0 ? oldChildren[idx] : null

    diffVNodes(
      oldVNode,
      childVNode,
      domParent,
      frame,
      scheduler,
      styles,
      vParent,
      rootTarget,
      anchor,
      cursor,
    )

    let shouldPlace = (childVNode._flags ?? 0) & INSERT_VNODE
    let firstDom = findFirstDomAnchor(childVNode)
    let lastDom = firstDom ? findLastDomAnchor(childVNode) : null
    if (shouldPlace && firstDom && lastDom && firstDom.parentNode === domParent) {
      let target: Node | null
      if (lastPlaced === null) {
        if (vParent._rangeStart && vParent._rangeStart.parentNode === domParent) {
          target = vParent._rangeStart.nextSibling
        } else {
          target = domParent.firstChild
        }
      } else {
        target = lastPlaced.nextSibling
      }

      if (target === null && anchor) target = anchor

      // If target lies within the range we're moving, skip the move.
      if (target && domRangeContainsNode(firstDom, lastDom, target)) {
        // no-op
      } else if (firstDom !== target) {
        moveDomRange(domParent, firstDom, lastDom, target)
      }
    }

    if (lastDom) lastPlaced = lastDom

    // Clear internal flags for next diff
    childVNode._flags = 0
    childVNode._index = undefined
  }

  return
}

export function findFirstDomAnchor(node: VNode | null | undefined): Node | null {
  if (!node) return null
  if (isCommittedTextNode(node)) return node._dom
  if (isCommittedHostNode(node)) return node._dom
  if (isCommittedComponentNode(node)) return findFirstDomAnchor(node._content)
  if (node.type === Frame) return node._rangeStart ?? null
  if (isFragmentNode(node)) {
    for (let child of node._children) {
      let dom = findFirstDomAnchor(child)
      if (dom) return dom
    }
  }
  return null
}

export function findLastDomAnchor(node: VNode | null | undefined): Node | null {
  if (!node) return null
  if (isCommittedTextNode(node)) return node._dom
  if (isCommittedHostNode(node)) return node._dom
  if (isCommittedComponentNode(node)) return findLastDomAnchor(node._content)
  if (node.type === Frame) return node._rangeEnd ?? null
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
    let parentNode = parent as Node
    if (parentNode === node) return false
    if (parentNode.contains(node)) return false
  }
  return true
}

export function findNextSiblingDomAnchor(curr: VNode, vParent?: VNode): Node | null {
  if (!vParent || !Array.isArray(vParent._children)) return null
  let children = vParent._children
  let idx = children.indexOf(curr)
  if (idx === -1) return null
  for (let i = idx + 1; i < children.length; i++) {
    let dom = findFirstDomAnchor(children[i])
    if (dom) return dom
  }
  return null
}

function reclaimPersistedMixinNode(
  persistedNode: CommittedHostNode,
  newNode: HostNode,
  frame: FrameHandle,
  scheduler: Scheduler,
  styles: StyleManager,
  vParent: VNode,
  rootTarget: EventTarget,
): void {
  cancelPendingMixinRemoval(persistedNode._mixState as MixinRuntimeState | undefined)
  unmarkNodePersistedByMixins(persistedNode)

  newNode._dom = persistedNode._dom
  newNode._parent = vParent
  newNode._controller = persistedNode._controller
  newNode._mixState = persistedNode._mixState
  newNode._controlledState = persistedNode._controlledState

  let prevProps = getHostProps(persistedNode)
  let nextProps = resolveNodeMixProps(
    newNode,
    frame,
    scheduler,
    newNode._mixState as MixinRuntimeState | undefined,
  )
  if (shouldDispatchInlineMixinLifecycle(persistedNode._dom)) {
    dispatchMixinBeforeUpdate(newNode._mixState as MixinRuntimeState | undefined)
  }
  diffHostProps(prevProps, nextProps, persistedNode._dom)
  ensureControlledReflection(newNode as CommittedHostNode, scheduler)
  syncControlledReflection(newNode as CommittedHostNode, nextProps)

  diffChildren(
    persistedNode._children,
    newNode._children,
    persistedNode._dom,
    frame,
    scheduler,
    styles,
    newNode,
    rootTarget,
  )

  bindNodeMixRuntime(newNode as CommittedHostNode, frame, scheduler, styles, true)
  if (shouldDispatchInlineMixinLifecycle(persistedNode._dom)) {
    scheduler.enqueueTasks([
      () => dispatchMixinCommit(newNode._mixState as MixinRuntimeState | undefined),
    ])
  }
}
