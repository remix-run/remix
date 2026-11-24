import type { ComponentErrorEvent, FrameHandle } from './component.ts'
import {
  createComponentErrorEvent,
  createFrameHandle,
  getComponentError,
  TypedEventTarget,
} from './component.ts'
import { invariant } from './invariant.ts'
import type { RemixNode } from './core/vnode.ts'
import type { ResolveFrame } from './frame-runtime.ts'
import type { NonceManager } from './nonce.ts'
import {
  diffVNodes,
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
} from './reconcile.ts'
import { registerRoot, unregisterRoot } from './refresh.ts'
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
  let markerData = start.nodeType === 8 ? (start as Comment).data.trim() : ''
  let hydrationId = markerData.startsWith('rmx:h:') ? markerData.slice(6) : undefined
  return createVirtualRoot(container, start.nextSibling, options, start, end, hydrationId)
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
  let styleRoot: HTMLElement | undefined
  if (hasServerContent(container)) {
    if (options.styleManager) {
      options.styleManager.adoptServerStyles(container)
      // Adoption can remove or replace the first node.
      if (hasServerContent(container)) start = container.firstChild
    } else {
      start = container.firstChild
      styleRoot = container
    }
  }
  return createVirtualRoot(container, start, options, undefined, undefined, undefined, styleRoot)
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
  pendingHydrationId?: string,
  styleRoot?: HTMLElement,
): VirtualRoot {
  let vroot: CommittedVNode | null = null
  let currentElement: RemixNode | undefined
  let styles = options.styleManager

  let eventTarget = new TypedEventTarget<VirtualRootEventMap>()
  let scheduler =
    options.scheduler ?? createScheduler(parent.ownerDocument ?? document, eventTarget)
  let frameStub =
    options.frame ??
    createRootFrameHandle(options.frameInit, eventTarget, scheduler, styles, styleRoot)
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

      let nonceManager = (frameStub.$runtime as { nonceManager?: NonceManager } | undefined)
        ?.nonceManager
      let vnode = toVNode(element)
      let vParent: RootVNode = {
        kind: 'root',
        type: ROOT_VNODE,
        _children: [],
        _svg: false,
        _resourceNonces: nonceManager?.getRootResourceNonces(root),
        _getContext: options.getContext,
        _rangeStart: rangeStart,
        _rangeEnd: rangeEnd,
        _pendingHydrationComponentId: pendingHydrationId,
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
  styleManager: StyleManager | undefined,
  styleRoot: HTMLElement | undefined,
): FrameHandle {
  let frame = createFrameHandle({ src: init?.src ?? '/' })
  frame.$runtime = {
    styleManager,
    styleRoot,
    frameInit: init,
    errorTarget,
    scheduler,
    resolveFrame: missingFrameRuntime,
  }
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

const CASCADING_UPDATE_LIMIT = 50

export type SchedulerPhaseEvent = Event & {
  parents: ParentNode[]
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
  let flushState = 0 // 0=idle, 1=scheduled, 2=flushing
  let cascading:
    | { total: number; byNode: WeakMap<CommittedComponentNode, number>; byName: Map<string, number> }
    | undefined
  let phaseEvents: EventTarget | undefined

  function dispatchError(error: unknown) {
    console.error(error)
    rootTarget.dispatchEvent(createComponentErrorEvent(error))
  }

  function formatCounts(counts: Map<string, number>) {
    return Array.from(counts, ([name, count]) => `${name} x${count}`).join(', ')
  }

  function trackCascadingUpdate(vnode: CommittedComponentNode): boolean {
    if (!cascading) {
      cascading = { total: 0, byNode: new WeakMap(), byName: new Map() }
      setTimeout(() => {
        cascading = undefined
      }, 0)
    }
    let name = vnode.type.name || 'Anonymous'
    let nodeCount = (cascading.byNode.get(vnode) ?? 0) + 1
    cascading.byNode.set(vnode, nodeCount)
    cascading.byName.set(name, (cascading.byName.get(name) ?? 0) + 1)

    if (++cascading.total === CASCADING_UPDATE_LIMIT) {
      console.warn(
        `${cascading.total} cascading component updates detected in one event loop turn. Consider reducing hydration regions. Components: ${formatCounts(cascading.byName)}`,
      )
    }
    if (nodeCount > CASCADING_UPDATE_LIMIT) {
      dispatchError(
        new Error(
          `handle.update() infinite loop detected in ${name} after ${nodeCount} cascading updates. Components: ${formatCounts(cascading.byName)}`,
        ),
      )
      return false
    }
    return true
  }

  function flushQueue(queue: EmptyFn[]) {
    while (queue.length) {
      try {
        queue.shift()!()
      } catch (error) {
        dispatchError(error)
      }
    }
  }

  function dispatchPhase(type: SchedulerPhaseType, parents: ParentNode[]) {
    phaseEvents?.dispatchEvent(Object.assign(new Event(type), { parents }))
  }

  function flush() {
    if (flushState === 2) return
    flushState = 2
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

        let updateParents = batch.size ? Array.from(new Set(batch.values())) : []
        setActiveSchedulerUpdateParents(updateParents)
        dispatchPhase('beforeUpdate', updateParents)

        for (let [vnode, domParent] of batch) {
          let skipped = false
          for (let p = vnode._parent; p.kind !== 'root'; p = p._parent) {
            if (p.kind === 'component' && batch.has(p as CommittedComponentNode)) {
              skipped = true
              break
            }
          }
          if (skipped) continue
          if (!trackCascadingUpdate(vnode)) return
          try {
            renderComponent(vnode._content, vnode, domParent, vnode._context)
          } catch (error) {
            dispatchError(error)
          }
        }

        flushQueue(workTasks)
        setActiveSchedulerUpdateParents(undefined)

        if (focused && focused !== (doc.activeElement || doc.body) && doc.contains(focused)) {
          restoreFocus(focused, input, start, end)
        }

        flushQueue(commitPhaseTasks)
        dispatchPhase('commit', updateParents)
        flushQueue(postCommitTasks)
      }
    } finally {
      setActiveSchedulerUpdateParents(undefined)
      flushState = 0
    }
  }

  function scheduleFlush() {
    if (flushState) return
    flushState = 1
    queueMicrotask(flush)
  }

  return {
    enqueue(vnode, domParent) {
      scheduled.set(vnode, domParent)
      scheduleFlush()
    },
    enqueueWork(tasks) {
      workTasks.push(...tasks)
      scheduleFlush()
    },
    enqueueCommitPhase(tasks) {
      commitPhaseTasks.push(...tasks)
      scheduleFlush()
    },
    enqueueTasks(tasks) {
      postCommitTasks.push(...tasks)
      scheduleFlush()
    },
    addEventListener(type, listener, options) {
      ;(phaseEvents ??= new EventTarget()).addEventListener(type, listener, options)
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
