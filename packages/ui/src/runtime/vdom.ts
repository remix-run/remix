import type { FrameHandle } from './component.ts'
import { createFrameHandle } from './component.ts'
import { invariant } from './invariant.ts'
import type { RemixNode } from './jsx.ts'
import { createFrameRuntime, type ResolveFrame } from './frame.ts'
import {
  createComponentErrorEvent,
  getComponentError,
  type ComponentErrorEvent,
} from './error-event.ts'
import { createScheduler, type Scheduler } from './scheduler.ts'
import { diffVNodes, remove as removeVNode } from './reconcile.ts'
import { toVNode } from './to-vnode.ts'
import { TypedEventTarget } from './typed-event-target.ts'
import { ROOT_VNODE, type CommittedVNode, type ReconcileContext, type RootVNode } from './vnode.ts'
import { resetStyleState, defaultStyleManager } from './diff-props.ts'
import { registerRoot, unregisterRoot } from './refresh.ts'
import { parseHydrationMarkerId } from './core/markers.ts'
import type { StyleManager } from '../style/index.ts'

/**
 * Events emitted by virtual roots.
 */
export type VirtualRootEventMap = {
  error: ComponentErrorEvent
}

/**
 * Root controller returned by {@link createRoot} and {@link createRangeRoot}.
 */
export type VirtualRoot = TypedEventTarget<VirtualRootEventMap> & {
  render: (element: RemixNode) => void
  reconcile: () => void
  dispose: () => void
  flush: () => void
}

/**
 * Options for creating a virtual DOM root with {@link createRoot} or {@link createRangeRoot}.
 */
export type VirtualRootOptions = {
  frame?: FrameHandle
  scheduler?: Scheduler
  styleManager?: StyleManager
  frameInit?: {
    src?: string
    resolveFrame: ResolveFrame
    loadModule?: (moduleUrl: string, exportName: string) => Promise<Function> | Function
  }
}

export { createScheduler, type Scheduler }
export { diffVNodes, toVNode }
export { resetStyleState }

function getHydrationComponentIdFromRangeStart(start: Node): string | undefined {
  let id = parseHydrationMarkerId(start)
  return id || undefined
}

/**
 * Creates a virtual root bounded by two DOM nodes.
 *
 * @param boundaries Start and end marker nodes that define the render region.
 * @param options Root configuration.
 * @returns A virtual root controller.
 */
export function createRangeRoot(
  boundaries: [Node, Node],
  options: VirtualRootOptions = {},
): VirtualRoot {
  let [start, end] = boundaries
  let vroot: CommittedVNode | null = null
  let currentElement: RemixNode | undefined
  let styles = options.styleManager ?? defaultStyleManager

  let container = end.parentNode
  invariant(container, 'Expected parent node')
  invariant(start.parentNode === container, 'Boundaries must share parent')
  let parent = container

  let hydrationCursor = start.nextSibling

  let eventTarget = new TypedEventTarget<VirtualRootEventMap>()
  let scheduler =
    options.scheduler ?? createScheduler(parent.ownerDocument ?? document, eventTarget, styles)
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
        _rangeStart: start,
        _rangeEnd: end,
        _pendingHydrationComponentId: getHydrationComponentIdFromRangeStart(start),
      }
      scheduler.enqueueWork([
        () => {
          let cursor = hydrationCursor === null ? undefined : { current: hydrationCursor }
          let committed = diffVNodes(vroot, vnode, parent, vParent, context, end, cursor)
          vParent._children = [committed]
          vroot = committed
          hydrationCursor = null
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
      scheduler.enqueueWork([() => removeVNode(current, parent, context)])
      scheduler.dequeue()
    },

    flush() {
      scheduler.dequeue()
    },
  })

  registerRoot(root)
  return root
}

/**
 * Creates a virtual root for a host container element.
 *
 * @param container Host element to render into.
 * @param options Root configuration.
 * @returns A virtual root controller.
 */
export function createRoot(container: HTMLElement, options: VirtualRootOptions = {}): VirtualRoot {
  let vroot: CommittedVNode | null = null
  let currentElement: RemixNode | undefined
  let styles = options.styleManager ?? defaultStyleManager
  if (container.innerHTML.trim() !== '') {
    // Adopt additively: multiple roots hydrating separate islands may share
    // the default style manager, and adopting a later island must not release
    // the server styles an earlier island still depends on.
    styles.adoptServerStyles(container)
  }
  let hydrationCursor = container.innerHTML.trim() !== '' ? container.firstChild : undefined

  let eventTarget = new TypedEventTarget<VirtualRootEventMap>()
  let scheduler =
    options.scheduler ?? createScheduler(container.ownerDocument ?? document, eventTarget, styles)
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
    container.addEventListener('error', forwardDomError)
    isErrorForwardingAttached = true
  }
  function detachDomErrorForwarding() {
    if (!isErrorForwardingAttached) return
    container.removeEventListener('error', forwardDomError)
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
      }
      scheduler.enqueueWork([
        () => {
          let cursor = hydrationCursor === undefined ? undefined : { current: hydrationCursor }
          let committed = diffVNodes(vroot, vnode, container, vParent, context, undefined, cursor)
          vParent._children = [committed]
          vroot = committed
          hydrationCursor = undefined
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
      scheduler.enqueueWork([() => removeVNode(current, container, context)])
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
    namedFrames: new Map(),
  })
  runtime.canResolveFrames = !!init.resolveFrame
  let frame = createFrameHandle({ src: init.src ?? '/', $runtime: runtime })
  runtime.topFrame = frame
  return frame
}
