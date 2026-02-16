import { TypedEventTarget } from '@remix-run/interaction'
import type { FrameContent, FrameHandle } from './component.ts'
import { createFrameHandle } from './component.ts'
import { invariant } from './invariant.ts'
import type { RemixNode } from './jsx.ts'
import { createScheduler, type Scheduler } from './scheduler.ts'
import { diffVNodes, remove as removeVNode } from './reconcile.ts'
import { toVNode } from './to-vnode.ts'
import { ROOT_VNODE, type VNode } from './vnode.ts'
import { resetStyleState, defaultStyleManager } from './diff-props.ts'
import type { StyleManager } from './style/index.ts'

export type VirtualRootEventMap = {
  error: ErrorEvent
}

export type VirtualRoot = TypedEventTarget<VirtualRootEventMap> & {
  render: (element: RemixNode) => void
  dispose: () => void
  flush: () => void
}

export type VirtualRootOptions = {
  frame?: FrameHandle
  scheduler?: Scheduler
  styleManager?: StyleManager
  frameInit?: {
    src?: string
    resolveFrame: (src: string, signal?: AbortSignal) => Promise<FrameContent> | FrameContent
    loadModule?: (moduleUrl: string, exportName: string) => Promise<Function> | Function
  }
}

export { createScheduler, type Scheduler }
export { diffVNodes, toVNode }
export { resetStyleState }

function getHydrationComponentIdFromRangeStart(start: Node): string | undefined {
  if (!(start instanceof Comment)) return undefined
  let marker = start.data.trim()
  if (!marker.startsWith('rmx:h:')) return undefined
  let id = marker.slice('rmx:h:'.length)
  return id.length > 0 ? id : undefined
}

export function createRangeRoot(
  [start, end]: [Node, Node],
  options: VirtualRootOptions = {},
): VirtualRoot {
  let vroot: VNode | null = null
  let styles = options.styleManager ?? defaultStyleManager

  let container = end.parentNode
  invariant(container, 'Expected parent node')
  invariant(end.parentNode === container, 'Boundaries must share parent')

  let hydrationCursor = start.nextSibling

  let eventTarget = new TypedEventTarget<VirtualRootEventMap>()
  let scheduler =
    options.scheduler ?? createScheduler(container.ownerDocument ?? document, eventTarget, styles)
  let frameStub =
    options.frame ??
    createRootFrameHandle({
      src: options.frameInit?.src,
      resolveFrame: options.frameInit?.resolveFrame,
      loadModule: options.frameInit?.loadModule,
      scheduler,
      styleManager: styles,
    })

  // Forward bubbling error events from DOM to root EventTarget
  container.addEventListener('error', (event) => {
    eventTarget.dispatchEvent(new ErrorEvent('error', { error: (event as ErrorEvent).error }))
  })

  return Object.assign(eventTarget, {
    render(element: RemixNode) {
      let vnode = toVNode(element)
      let vParent: VNode = {
        type: ROOT_VNODE,
        _svg: false,
        _rangeStart: start,
        _rangeEnd: end,
        _pendingHydrationComponentId: getHydrationComponentIdFromRangeStart(start),
      }
      scheduler.enqueueTasks([
        () => {
          diffVNodes(
            vroot,
            vnode,
            container,
            frameStub,
            scheduler,
            styles,
            vParent,
            eventTarget,
            end,
            hydrationCursor,
          )
          vroot = vnode
          hydrationCursor = null
        },
      ])
      scheduler.dequeue()
    },

    dispose() {
      if (!vroot) return
      let current = vroot
      vroot = null
      scheduler.enqueueTasks([() => removeVNode(current, container, scheduler, styles)])
      scheduler.dequeue()
    },

    flush() {
      scheduler.dequeue()
    },
  })
}

export function createRoot(container: HTMLElement, options: VirtualRootOptions = {}): VirtualRoot {
  let vroot: VNode | null = null
  let styles = options.styleManager ?? defaultStyleManager
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
      scheduler,
      styleManager: styles,
    })

  // Forward bubbling error events from DOM to root EventTarget
  container.addEventListener('error', (event) => {
    eventTarget.dispatchEvent(new ErrorEvent('error', { error: (event as ErrorEvent).error }))
  })

  return Object.assign(eventTarget, {
    render(element: RemixNode) {
      let vnode = toVNode(element)
      let vParent: VNode = { type: ROOT_VNODE, _svg: false }
      scheduler.enqueueTasks([
        () => {
          diffVNodes(
            vroot,
            vnode,
            container,
            frameStub,
            scheduler,
            styles,
            vParent,
            eventTarget,
            undefined,
            hydrationCursor,
          )
          vroot = vnode
          hydrationCursor = undefined
        },
      ])
      scheduler.dequeue()
    },

    dispose() {
      if (!vroot) return
      let current = vroot
      vroot = null
      scheduler.enqueueTasks([() => removeVNode(current, container, scheduler, styles)])
      scheduler.dequeue()
    },

    flush() {
      scheduler.dequeue()
    },
  })
}

function createRootFrameHandle(init: {
  src?: string
  resolveFrame?: (src: string, signal?: AbortSignal) => Promise<FrameContent> | FrameContent
  loadModule?: (moduleUrl: string, exportName: string) => Promise<Function> | Function
  scheduler: Scheduler
  styleManager: StyleManager
}): FrameHandle {
  if (!init.resolveFrame) {
    return createFrameHandle({ src: init.src ?? '/' })
  }

  let frame = createFrameHandle({
    src: init.src ?? '/',
    $runtime: {
      topFrame: undefined,
      loadModule:
        init.loadModule ??
        (() => {
          throw new Error('loadModule is required to hydrate client entries inside <Frame />')
        }),
      resolveFrame: init.resolveFrame,
      pendingClientEntries: new Map(),
      scheduler: init.scheduler,
      styleManager: init.styleManager,
      data: {},
      moduleCache: new Map(),
      moduleLoads: new Map(),
      frameInstances: new WeakMap(),
      namedFrames: new Map(),
    },
  })
  let runtime = frame.$runtime as { topFrame?: FrameHandle } | undefined
  if (runtime) runtime.topFrame = frame
  return frame
}
