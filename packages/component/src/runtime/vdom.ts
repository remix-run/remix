import { getNonceManager } from './nonce.ts'
import type { ComponentErrorEvent, FrameHandle } from './component.ts'
import {
  createComponentErrorEvent,
  createFrameHandle,
  getComponentError,
  TypedEventTarget,
} from './component.ts'
import { invariant } from './invariant.ts'
import type { RemixNode } from './core/vnode.ts'
import { createFrameRuntime, NamedFrameRegistry, type ResolveFrame } from './frame-runtime.ts'
import {
  getDefaultStyleManager,
  diffVNodes,
  findNextSiblingDomAnchor,
  isCommittedComponentNode,
  renderComponent,
  restoreAncestorSelect,
  remove as removeVNode,
  ROOT_VNODE,
  setActiveSchedulerUpdateParents,
  toVNode,
  type CommittedComponentNode,
  type CommittedVNode,
  type ReconcileContext,
  type RootVNode,
  type VNodeParent,
} from './reconcile.ts'
import { registerRoot, unregisterRoot } from './refresh.ts'
import { getHydrationId, isHydrationStart } from './stream-protocol.ts'
import type { StyleManager } from '../style/stylesheet.ts'
import type { ElementFunction } from './element-function.ts'

/**
 * Events emitted by virtual roots.
 */
export type VirtualRootEventMap = {
  /** A component render or queued task failed. */
  error: ComponentErrorEvent
}

/**
 * Root controller returned by {@link createRoot} and {@link createRangeRoot}.
 */
export type VirtualRoot = TypedEventTarget<VirtualRootEventMap> & {
  /**
   * Renders a tree, reusing existing DOM and component instances where possible.
   * The first render hydrates existing container or range content.
   *
   * @param element Tree to render, or `null` to remove the current tree.
   */
  render: (element: RemixNode) => void
  /** Renders the most recently supplied tree again, or does nothing before the first render. */
  reconcile: () => void
  /**
   * Removes the rendered tree and releases root listeners and component resources.
   * Host removal can remain pending while mixin teardown callbacks finish.
   */
  dispose: () => void
  /** Synchronously drains pending DOM work and tasks without waiting for asynchronous work. */
  flush: () => void
}

/**
 * Options for creating a virtual DOM root with {@link createRoot} or {@link createRangeRoot}.
 */
export type VirtualRootOptions = {
  /** Existing frame runtime to share with this root instead of creating one from `frameInit`. */
  frame?: FrameHandle
  /** Resolves context from outside this root when no matching provider exists inside it. */
  getContext?: (type: ElementFunction) => unknown
  /** Scheduler to share with related roots (defaults to a new scheduler). */
  scheduler?: Scheduler
  /** Style manager used to adopt server styles and manage generated CSS. */
  styleManager?: StyleManager
  /** Frame resolution for standalone roots that render `<Frame>` without calling `run()`. */
  frameInit?: {
    /** Source URL for the root's frame context (defaults to `'/'`). */
    src?: string
    /** Resolves content for frames rendered inside this root. */
    resolveFrame: ResolveFrame
    /** Loads client entries encountered in resolved frame content. */
    loadModule?: (moduleUrl: string, exportName: string) => Promise<Function> | Function
  }
}

/**
 * Creates a virtual root bounded by two DOM nodes.
 *
 * @param boundaries Start and end nodes sharing a parent. Only the content between them is owned.
 * @param options Root configuration.
 * @returns A virtual root controller.
 */
export function createRangeRoot(
  boundaries: [Node, Node],
  options: VirtualRootOptions = {},
): VirtualRoot {
  let [start, end] = boundaries
  let container = end.parentNode
  invariant(container, 'Expected parent node')
  invariant(start.parentNode === container, 'Boundaries must share parent')
  return createVirtualRoot(container, start.nextSibling, options, start, end)
}

/**
 * Creates a virtual root for a host container element.
 *
 * @param container Host element to render into.
 * @param options Root configuration.
 * @returns A virtual root controller.
 */
export function createRoot(container: HTMLElement, options: VirtualRootOptions = {}): VirtualRoot {
  let styles = options.styleManager ?? getDefaultStyleManager()
  if (container.innerHTML.trim() !== '') {
    // Adopt additively: multiple roots hydrating separate islands may share
    // the default style manager, and adopting a later island must not release
    // the server styles an earlier island still depends on.
    styles.adoptServerStyles(container)
  }
  let hydrationStart = container.innerHTML.trim() !== '' ? container.firstChild : null
  return createVirtualRoot(container, hydrationStart, options)
}

function createVirtualRoot(
  parent: ParentNode,
  hydrationStart: Node | null,
  options: VirtualRootOptions,
  rangeStart?: Node,
  rangeEnd?: Node,
): VirtualRoot {
  let nonceManager = getNonceManager()
  let vroot: CommittedVNode | null = null
  let currentElement: RemixNode | undefined
  let styles = options.styleManager ?? getDefaultStyleManager()
  let hydrationCursor = hydrationStart

  let eventTarget = new TypedEventTarget<VirtualRootEventMap>()
  let scheduler =
    options.scheduler ?? createScheduler(parent.ownerDocument ?? document, eventTarget)
  let frameStub =
    options.frame ??
    createRootFrameHandle({
      src: options.frameInit?.src,
      resolveFrame: options.frameInit?.resolveFrame,
      loadModule: options.frameInit?.loadModule,
      errorTarget: eventTarget,
      scheduler,
      styleManager: styles,
    })
  let context: ReconcileContext = {
    frame: frameStub,
    scheduler,
    styles,
    rootTarget: eventTarget,
  }

  let isErrorForwardingAttached = false
  function forwardDomError(event: Event) {
    eventTarget.dispatchEvent(createComponentErrorEvent(getComponentError(event)))
  }
  function attachDomErrorForwarding() {
    if (isErrorForwardingAttached) return
    parent.addEventListener('error', forwardDomError)
    isErrorForwardingAttached = true
  }
  function detachDomErrorForwarding() {
    if (!isErrorForwardingAttached) return
    parent.removeEventListener('error', forwardDomError)
    isErrorForwardingAttached = false
  }
  attachDomErrorForwarding()

  let root = Object.assign(eventTarget, {
    render(element: RemixNode) {
      attachDomErrorForwarding()
      currentElement = element

      let vnode = toVNode(element)
      let vParent: RootVNode = {
        kind: 'root',
        type: ROOT_VNODE,
        _children: [],
        _svg: false,
        _resourceNonces: nonceManager.getRootResourceNonces(root),
        _getContext: options.getContext,
        _rangeStart: rangeStart,
        _rangeEnd: rangeEnd,
        _pendingHydrationComponentId: isHydrationStart(rangeStart)
          ? getHydrationId(rangeStart)
          : undefined,
      }
      scheduler.enqueueWork([
        () => {
          let cursor = hydrationCursor === null ? undefined : { current: hydrationCursor }
          let committed = diffVNodes(vroot, vnode, parent, vParent, context, rangeEnd, cursor)
          vParent._children = [committed]
          vroot = committed
          hydrationCursor = null
          restoreAncestorSelect(parent)
        },
      ])
      scheduler.dequeue()
    },

    reconcile() {
      if (currentElement === undefined) return
      root.render(currentElement)
    },

    dispose() {
      detachDomErrorForwarding()
      unregisterRoot(root)
      currentElement = undefined

      if (!vroot) return
      let current = vroot
      vroot = null
      scheduler.enqueueWork([
        () => {
          removeVNode(current, parent, context)
          restoreAncestorSelect(parent)
        },
      ])
      scheduler.dequeue()
    },

    flush() {
      scheduler.dequeue()
    },
  })

  registerRoot(root)
  return root
}

function createRootFrameHandle(init: {
  src?: string
  resolveFrame?: ResolveFrame
  loadModule?: (moduleUrl: string, exportName: string) => Promise<Function> | Function
  errorTarget: EventTarget
  scheduler: Scheduler
  styleManager: StyleManager
}): FrameHandle {
  let resolveFrame =
    init.resolveFrame ??
    (() => {
      throw new Error(
        'Cannot render <Frame /> without frame runtime. Use run() or pass frameInit to createRoot/createRangeRoot.',
      )
    })

  let runtime = createFrameRuntime({
    topFrame: undefined,
    loadModule:
      init.loadModule ??
      (() => {
        throw new Error('loadModule is required to hydrate client entries inside <Frame />')
      }),
    resolveFrame,
    errorTarget: init.errorTarget,
    pendingClientEntries: new Map(),
    scheduler: init.scheduler,
    styleManager: init.styleManager,
    moduleCache: new Map(),
    moduleLoads: new Map(),
    frameInstances: new WeakMap(),
    namedFrames: new NamedFrameRegistry(),
  })
  runtime.canResolveFrames = !!init.resolveFrame
  let frame = createFrameHandle({ src: init.src ?? '/', $runtime: runtime })
  runtime.topFrame = frame
  return frame
}

type EmptyFn = () => void
type SchedulerPhaseType = 'beforeUpdate' | 'commit'
type SchedulerPhaseListener = EventListenerOrEventListenerObject | null

/**
 * Scheduler API used by the reconciler and frame runtime.
 */
export interface Scheduler {
  enqueue(vnode: CommittedComponentNode, domParent: ParentNode): void
  enqueueWork(newTasks: EmptyFn[]): void
  enqueueCommitPhase(newTasks: EmptyFn[]): void
  enqueueTasks(newTasks: EmptyFn[]): void
  addEventListener(
    type: SchedulerPhaseType,
    listener: SchedulerPhaseListener,
    options?: AddEventListenerOptions | boolean,
  ): void
  removeEventListener(
    type: SchedulerPhaseType,
    listener: SchedulerPhaseListener,
    options?: EventListenerOptions | boolean,
  ): void
  dequeue(): void
}

const CASCADING_UPDATE_WARN_THRESHOLD = 50
const MAX_CASCADING_COMPONENT_UPDATES = 50

export type SchedulerPhaseEvent = Event & {
  parents: ParentNode[]
}

function getComponentName(vnode: CommittedComponentNode): string {
  return vnode.type.name || 'Anonymous'
}

function formatComponentCounts(counts: Map<string, number>): string {
  return Array.from(counts, ([name, count]) => `${name} x${count}`).join(', ')
}

/**
 * Creates the DOM update scheduler used by the component runtime.
 *
 * @param doc Document associated with the rendered tree.
 * @param rootTarget Event target that receives runtime errors.
 * @returns A scheduler instance.
 */
export function createScheduler(doc: Document, rootTarget: EventTarget): Scheduler {
  let documentState = createDocumentState(doc)
  let scheduled = new Map<CommittedComponentNode, ParentNode>()
  let workTasks: EmptyFn[] = []
  let commitPhaseTasks: EmptyFn[] = []
  let postCommitTasks: EmptyFn[] = []
  let flushState: 'idle' | 'scheduled' | 'flushing' = 'idle'
  // Counts for the current event loop turn, or undefined when no component has updated in it yet.
  let cascadingUpdates:
    | {
        total: number
        byComponent: WeakMap<CommittedComponentNode, number>
        byName: Map<string, number>
        warned: boolean
      }
    | undefined
  let phaseEvents = new EventTarget()
  let phaseListenerCounts: Record<SchedulerPhaseType, number> = {
    beforeUpdate: 0,
    commit: 0,
  }
  let scheduler: Scheduler

  function dispatchError(error: unknown) {
    console.error(error)
    rootTarget.dispatchEvent(createComponentErrorEvent(error))
  }

  function trackCascadingUpdate(vnode: CommittedComponentNode): boolean {
    if (!cascadingUpdates) {
      cascadingUpdates = { total: 0, byComponent: new WeakMap(), byName: new Map(), warned: false }
      // Close the window when control returns to the event loop while still allowing
      // microtask-driven flushes in the same turn to count as cascading.
      setTimeout(() => {
        cascadingUpdates = undefined
      }, 0)
    }
    let updates = cascadingUpdates
    updates.total++

    let componentName = getComponentName(vnode)
    updates.byName.set(componentName, (updates.byName.get(componentName) ?? 0) + 1)

    let componentUpdateCount = (updates.byComponent.get(vnode) ?? 0) + 1
    updates.byComponent.set(vnode, componentUpdateCount)

    if (!updates.warned && updates.total >= CASCADING_UPDATE_WARN_THRESHOLD) {
      updates.warned = true
      console.warn(
        `${updates.total} cascading component updates detected in one event loop turn. Consider reducing hydration regions. Components: ${formatComponentCounts(updates.byName)}`,
      )
    }

    if (componentUpdateCount > MAX_CASCADING_COMPONENT_UPDATES) {
      let error = new Error(
        `handle.update() infinite loop detected in ${componentName} after ${componentUpdateCount} cascading updates. Components: ${formatComponentCounts(updates.byName)}`,
      )
      dispatchError(error)
      return false
    }

    return true
  }

  function flush() {
    if (flushState === 'flushing') return
    flushState = 'flushing'
    try {
      while (true) {
        let batch = new Map(scheduled)
        scheduled.clear()

        let hasWork =
          batch.size > 0 ||
          workTasks.length > 0 ||
          commitPhaseTasks.length > 0 ||
          postCommitTasks.length > 0
        if (!hasWork) return

        documentState.capture()

        let updateParents = batch.size > 0 ? Array.from(new Set(batch.values())) : []
        setActiveSchedulerUpdateParents(updateParents)
        dispatchPhaseEvent('beforeUpdate', updateParents)

        if (batch.size > 0) {
          let vnodes = Array.from(batch)
          let noScheduledAncestor = new Set<VNodeParent>()

          for (let [vnode, domParent] of vnodes) {
            if (ancestorIsScheduled(vnode, batch, noScheduledAncestor)) continue
            if (!trackCascadingUpdate(vnode)) return
            let curr = vnode._content
            // Calculate anchor at render time from current vdom position (never stale).
            // Needed for fragment self-updates that add children - without this, new children
            // would be appended after siblings. The keyed diff has placement logic, but unkeyed
            // diff relies on anchor for correct positioning.
            let anchor = findNextSiblingDomAnchor(vnode) || undefined
            try {
              renderComponent(curr, vnode, domParent, vnode._context, anchor)
            } catch (error) {
              dispatchError(error)
            }
          }
        }

        flushTaskQueue(workTasks)
        setActiveSchedulerUpdateParents(undefined)

        // Restore selection before commit-phase lifecycle work so mixins see
        // the final DOM state but still run before commit listeners and user tasks.
        documentState.restore()

        flushTaskQueue(commitPhaseTasks)
        dispatchPhaseEvent('commit', updateParents)
        flushTaskQueue(postCommitTasks)
      }
    } finally {
      setActiveSchedulerUpdateParents(undefined)
      flushState = 'idle'
    }
  }

  function dispatchPhaseEvent(type: SchedulerPhaseType, parents: ParentNode[]) {
    if (phaseListenerCounts[type] === 0) return
    let event: SchedulerPhaseEvent = Object.assign(new Event(type), { parents })
    phaseEvents.dispatchEvent(event)
  }

  function flushTaskQueue(queue: EmptyFn[]) {
    while (queue.length > 0) {
      let task = queue.shift()
      if (!task) continue
      try {
        task()
      } catch (error) {
        dispatchError(error)
      }
    }
  }

  function scheduleFlush() {
    if (flushState !== 'idle') return
    flushState = 'scheduled'
    queueMicrotask(flush)
  }

  function ancestorIsScheduled(
    vnode: CommittedComponentNode,
    batch: Map<CommittedComponentNode, ParentNode>,
    safe: Set<VNodeParent>,
  ): boolean {
    let path: VNodeParent[] = []
    let current: VNodeParent | undefined = vnode._parent

    while (current) {
      // Already verified this node has no scheduled ancestor above it
      if (safe.has(current)) {
        for (let node of path) safe.add(node)
        return false
      }

      path.push(current)

      if (isCommittedComponentNode(current) && batch.has(current)) {
        return true
      }

      current = current.kind === 'root' ? undefined : current._parent
    }

    // Reached root - mark entire path as safe for future lookups
    for (let node of path) safe.add(node)
    return false
  }

  scheduler = {
    enqueue(vnode: CommittedComponentNode, domParent: ParentNode): void {
      scheduled.set(vnode, domParent)
      scheduleFlush()
    },

    enqueueWork(newTasks: EmptyFn[]): void {
      workTasks.push(...newTasks)
      scheduleFlush()
    },

    enqueueCommitPhase(newTasks: EmptyFn[]): void {
      commitPhaseTasks.push(...newTasks)
      scheduleFlush()
    },

    enqueueTasks(newTasks: EmptyFn[]): void {
      postCommitTasks.push(...newTasks)
      scheduleFlush()
    },

    addEventListener(type, listener, options) {
      if (listener) phaseListenerCounts[type]++
      phaseEvents.addEventListener(type, listener, options)
    },

    removeEventListener(type, listener, options) {
      if (listener) phaseListenerCounts[type] = Math.max(0, phaseListenerCounts[type] - 1)
      phaseEvents.removeEventListener(type, listener, options)
    },

    dequeue() {
      flush()
    },
  }

  return scheduler
}

/**
 * Adapted from https://github.com/facebook/react/blob/main/packages/react-dom-bindings/src/client/ReactInputSelection.js
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 * MIT License
 *
 * Eventually should be able to use moveBefore and won't need this at all.
 */

type SelectionInformation = {
  focusedElem: Element | null
  selectionRange: { start: number; end: number } | null
}

function createDocumentState(doc: Document) {
  function getActiveElement(): Element | null {
    return doc.activeElement || doc.body
  }

  function hasSelectionCapabilities(elem: Element): boolean {
    let nodeName = elem.nodeName.toLowerCase()
    return (
      (nodeName === 'input' &&
        'type' in elem &&
        (elem.type === 'text' ||
          elem.type === 'search' ||
          elem.type === 'tel' ||
          elem.type === 'url' ||
          elem.type === 'password')) ||
      nodeName === 'textarea' ||
      (elem instanceof HTMLElement && elem.contentEditable === 'true')
    )
  }

  function getSelection(input: Element): { start: number; end: number } | null {
    if (
      'selectionStart' in input &&
      typeof input.selectionStart === 'number' &&
      'selectionEnd' in input
    ) {
      let htmlInput = input as HTMLInputElement | HTMLTextAreaElement
      return {
        start: htmlInput.selectionStart ?? 0,
        end: htmlInput.selectionEnd ?? htmlInput.selectionStart ?? 0,
      }
    }
    // For contentEditable, we'd need more complex logic, but for now return null
    return null
  }

  function setSelection(input: Element, offsets: { start: number; end: number }): void {
    if ('selectionStart' in input && 'selectionEnd' in input) {
      try {
        let htmlInput = input as HTMLInputElement | HTMLTextAreaElement
        htmlInput.selectionStart = offsets.start
        htmlInput.selectionEnd = Math.min(offsets.end, htmlInput.value?.length ?? 0)
      } catch {
        // Ignore errors setting selection
      }
    }
  }

  function isInDocument(node: Node): boolean {
    return doc.documentElement.contains(node)
  }

  function getSelectionInformation(): SelectionInformation {
    let focusedElem = getActiveElement()
    return {
      focusedElem,
      selectionRange:
        focusedElem && hasSelectionCapabilities(focusedElem) ? getSelection(focusedElem) : null,
    }
  }

  function restoreSelection(priorSelectionInformation: SelectionInformation): void {
    let curFocusedElem = getActiveElement()
    let priorFocusedElem = priorSelectionInformation.focusedElem
    let priorSelectionRange = priorSelectionInformation.selectionRange

    if (curFocusedElem !== priorFocusedElem && priorFocusedElem && isInDocument(priorFocusedElem)) {
      // Save scroll positions before focusing (focusing can change scroll)
      let ancestors: Array<{ element: Element; left: number; top: number }> = []
      let ancestor: Node | null = priorFocusedElem
      while (ancestor) {
        if (ancestor.nodeType === Node.ELEMENT_NODE) {
          let el = ancestor as Element
          ancestors.push({
            element: el,
            left: el.scrollLeft ?? 0,
            top: el.scrollTop ?? 0,
          })
        }
        ancestor = ancestor.parentNode
      }

      // Restore selection if applicable
      if (priorSelectionRange !== null && hasSelectionCapabilities(priorFocusedElem)) {
        setSelection(priorFocusedElem, priorSelectionRange)
      }

      // Restore focus
      if (priorFocusedElem instanceof HTMLElement && typeof priorFocusedElem.focus === 'function') {
        priorFocusedElem.focus()
      }

      // Restore scroll positions
      for (let info of ancestors) {
        info.element.scrollLeft = info.left
        info.element.scrollTop = info.top
      }
    }
  }

  let selectionInfo: SelectionInformation | null = null

  function capture() {
    selectionInfo = getSelectionInformation()
  }

  function restore() {
    if (selectionInfo !== null) {
      restoreSelection(selectionInfo)
    }
    selectionInfo = null
  }

  return { capture, restore }
}
