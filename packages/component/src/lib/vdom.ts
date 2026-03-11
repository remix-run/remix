import type { FrameContent, FrameHandle } from './component.ts'
import { createFrameHandle } from './component.ts'
import { defaultStyleManager, resetStyleState } from './diff-props.ts'
import { invariant } from './invariant.ts'
import type { RendererRuntime } from './runtime.ts'
import type { Scheduler } from './scheduler.ts'
import { ROOT_VNODE, type VNode } from './vnode.ts'
import { createVirtualRoot, type VirtualRoot, type VirtualRootEventMap } from './virtual-root.ts'
import type { StyleManager } from './style/index.ts'

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

export { createScheduler, type Scheduler } from './scheduler.ts'
export { diffVNodes } from './reconcile.ts'
export { toVNode } from './to-vnode.ts'
export type { VirtualRoot, VirtualRootEventMap } from './virtual-root.ts'
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
  let styleManager = options.scheduler?.runtime.styleManager ?? options.styleManager ?? defaultStyleManager
  let container = end.parentNode
  invariant(container, 'Expected parent node')
  invariant(start.parentNode === container, 'Boundaries must share parent')
  let parent = container as ParentNode

  return createVirtualRoot({
    container: parent,
    frame: options.frame,
    scheduler: options.scheduler,
    styleManager,
    anchor: end,
    hydrationCursor: start.nextSibling,
    nextHydrationCursor: null,
    createFrame(scheduler, runtime) {
      return createRootFrameHandle({
        src: options.frameInit?.src,
        resolveFrame: options.frameInit?.resolveFrame,
        loadModule: options.frameInit?.loadModule,
        scheduler,
        runtime,
      })
    },
    createParentVNode() {
      return {
        type: ROOT_VNODE,
        _svg: false,
        _rangeStart: start,
        _rangeEnd: end,
        _pendingHydrationComponentId: getHydrationComponentIdFromRangeStart(start),
      }
    },
  })
}

export function createRoot(container: HTMLElement, options: VirtualRootOptions = {}): VirtualRoot {
  let styleManager = options.scheduler?.runtime.styleManager ?? options.styleManager ?? defaultStyleManager

  return createVirtualRoot({
    container,
    frame: options.frame,
    scheduler: options.scheduler,
    styleManager,
    hydrationCursor: container.innerHTML.trim() !== '' ? container.firstChild : undefined,
    createFrame(scheduler, runtime) {
      return createRootFrameHandle({
        src: options.frameInit?.src,
        resolveFrame: options.frameInit?.resolveFrame,
        loadModule: options.frameInit?.loadModule,
        scheduler,
        runtime,
      })
    },
    createParentVNode() {
      return { type: ROOT_VNODE, _svg: false }
    },
  })
}

function createRootFrameHandle(init: {
  src?: string
  resolveFrame?: (src: string, signal?: AbortSignal) => Promise<FrameContent> | FrameContent
  loadModule?: (moduleUrl: string, exportName: string) => Promise<Function> | Function
  scheduler: Scheduler
  runtime: RendererRuntime
}): FrameHandle {
  let resolveFrame =
    init.resolveFrame ??
    (() => {
      throw new Error(
        'Cannot render <Frame /> without frame runtime. Use run() or pass frameInit to createRoot/createRangeRoot.',
      )
    })

  let frame = createFrameHandle({
    src: init.src ?? '/',
    $runtime: {
      canResolveFrames: !!init.resolveFrame,
      topFrame: undefined,
      loadModule:
        init.loadModule ??
        (() => {
          throw new Error('loadModule is required to hydrate client entries inside <Frame />')
        }),
      resolveFrame,
      pendingClientEntries: new Map(),
      scheduler: init.scheduler,
      styleManager: init.runtime.styleManager,
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
