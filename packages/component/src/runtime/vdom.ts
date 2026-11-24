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
import { createFrameRuntime, FrameRegistry, type ResolveFrame } from './frame-runtime.ts'
import {
  getDefaultStyleManager,
  diffVNodes,
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
  let start: ChildNode | null = null
  if (hasServerContent(container)) {
    let styles = options.styleManager ?? getDefaultStyleManager()
    styles.adoptServerStyles(container)
    // Adoption can remove or replace the first node.
    if (hasServerContent(container)) start = container.firstChild
  }
  return createVirtualRoot(container, start, options)
}

function hasServerContent(container: HTMLElement): boolean {
  // Templates serialize their content fragment. For ordinary elements, a child tag
  // proves there is markup without serializing the entire subtree.
  if (container.localName !== 'template' && container.firstElementChild) return true
  return container.innerHTML.trim() !== ''
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

  let eventTarget = new TypedEventTarget<VirtualRootEventMap>()
  let scheduler =
    options.scheduler ?? createScheduler(parent.ownerDocument ?? document, eventTarget)
  let frameStub =
    options.frame ?? createRootFrameHandle(options.frameInit, eventTarget, scheduler, styles)
  let context: ReconcileContext = {
    frame: frameStub,
    scheduler,
    styles,
    rootTarget: eventTarget,
  }

  function forwardDomError(event: Event) {
    eventTarget.dispatchEvent(createComponentErrorEvent(getComponentError(event)))
  }
  parent.addEventListener('error', forwardDomError)

  let root = Object.assign(eventTarget, {
    render(element: RemixNode) {
      if (currentElement === undefined) parent.addEventListener('error', forwardDomError)
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
          let cursor = hydrationStart === null ? undefined : { current: hydrationStart }
          let committed = diffVNodes(
            vroot,
            vnode,
            parent,
            vParent,
            context,
            rangeEnd ?? null,
            cursor,
          )
          vParent._children = [committed]
          vroot = committed
          hydrationStart = null
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
      parent.removeEventListener('error', forwardDomError)
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

function createRootFrameHandle(
  init: VirtualRootOptions['frameInit'],
  errorTarget: EventTarget,
  scheduler: Scheduler,
  styleManager: StyleManager,
): FrameHandle {
  let frame = createFrameHandle({ src: init?.src ?? '/' })
  frame.$runtime = init?.resolveFrame
    ? createFrameRuntime({
        loadModule:
          init.loadModule ??
          (() => {
            throw new Error('loadModule is required to hydrate client entries inside <Frame />')
          }),
        resolveFrame: init.resolveFrame,
        errorTarget,
        scheduler,
        styleManager,
        registry: new FrameRegistry(),
        topFrame: frame,
      })
    : { styleManager, resolveFrame: missingFrameRuntime }
  return frame
}

export function missingFrameRuntime(): never {
  throw new Error(
    'Cannot render <Frame /> without frame runtime. Use run() or pass frameInit to createRoot/createRangeRoot.',
  )
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
      }
    | undefined
  let phaseEvents: EventTarget | undefined

  function dispatchError(error: unknown) {
    console.error(error)
    rootTarget.dispatchEvent(createComponentErrorEvent(error))
  }

  function trackCascadingUpdate(vnode: CommittedComponentNode): boolean {
    if (!cascadingUpdates) {
      cascadingUpdates = { total: 0, byComponent: new WeakMap(), byName: new Map() }
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

    if (updates.total === CASCADING_UPDATE_WARN_THRESHOLD) {
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
      while (
        scheduled.size ||
        workTasks.length ||
        commitPhaseTasks.length ||
        postCommitTasks.length
      ) {
        let batch = scheduled
        scheduled = new Map()

        let focused = doc.activeElement || doc.body
        let input =
          focused instanceof HTMLInputElement || focused instanceof HTMLTextAreaElement
            ? focused
            : null
        let start = input?.selectionStart
        let end = input?.selectionEnd

        let updateParents = batch.size > 0 ? Array.from(new Set(batch.values())) : []
        setActiveSchedulerUpdateParents(updateParents)
        dispatchPhaseEvent('beforeUpdate', updateParents)

        if (batch.size > 0) {
          let noScheduledAncestor = new Set<VNodeParent>()

          for (let [vnode, domParent] of batch) {
            if (ancestorIsScheduled(vnode, batch, noScheduledAncestor)) continue
            if (!trackCascadingUpdate(vnode)) return
            let curr = vnode._content
            try {
              renderComponent(curr, vnode, domParent, vnode._context)
            } catch (error) {
              dispatchError(error)
            }
          }
        }

        flushTaskQueue(workTasks)
        setActiveSchedulerUpdateParents(undefined)

        // Restore selection before commit-phase lifecycle work so mixins see
        // the final DOM state but still run before commit listeners and user tasks.
        if (focused && focused !== (doc.activeElement || doc.body) && doc.contains(focused)) {
          restoreFocus(focused, input, start, end)
        }

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
    if (!phaseEvents) return
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
      if (safe.has(current)) break

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

  return {
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
      phaseEvents ??= new EventTarget()
      phaseEvents.addEventListener(type, listener, options)
    },

    removeEventListener(type, listener, options) {
      phaseEvents?.removeEventListener(type, listener, options)
    },

    dequeue: flush,
  }
}

/*
 * Adapted from https://github.com/facebook/react/blob/main/packages/react-dom-bindings/src/client/ReactInputSelection.js
 * Copyright (c) Meta Platforms, Inc. and affiliates. MIT License.
 *
 * Native moveBefore() preserves focus for eligible moves; this remains necessary
 * for browsers without it and for other DOM updates that detach the focused node.
 */
function restoreFocus(
  element: Element,
  control: HTMLInputElement | HTMLTextAreaElement | null,
  start: number | null | undefined,
  end: number | null | undefined,
) {
  let positions: [Element, number, number][] = []
  for (let parent: Element | null = element; parent; parent = parent.parentElement) {
    positions.push([parent, parent.scrollLeft, parent.scrollTop])
  }

  if (control && start != null && end != null) {
    try {
      control.selectionStart = start
      control.selectionEnd = end
    } catch {
      // The input type can change during this render.
    }
  }
  if (element instanceof HTMLElement && typeof element.focus === 'function') element.focus()
  for (let [ancestor, left, top] of positions) {
    ancestor.scrollLeft = left
    ancestor.scrollTop = top
  }
}
