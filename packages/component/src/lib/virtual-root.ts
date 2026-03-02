import type { FrameHandle } from './component.ts'
import { defaultStyleManager } from './diff-props.ts'
import { diffVNodes, remove as removeVNode } from './reconcile.ts'
import { createScheduler, type Scheduler } from './scheduler.ts'
import type { StyleManager } from './style/index.ts'
import { toVNode } from './to-vnode.ts'
import { TypedEventTarget } from './typed-event-target.ts'
import type { VNode } from './vnode.ts'
import type { RemixNode } from './jsx.ts'

export type VirtualRootEventMap = {
  error: ErrorEvent
}

export type VirtualRoot = TypedEventTarget<VirtualRootEventMap> & {
  render: (element: RemixNode) => void
  dispose: () => void
  flush: () => void
}

type CreateVirtualRootInit = {
  container: ParentNode
  frame?: FrameHandle
  createFrame?: (scheduler: Scheduler, styleManager: StyleManager) => FrameHandle
  scheduler?: Scheduler
  styleManager?: StyleManager
  anchor?: Node
  hydrationCursor?: Node | null
  nextHydrationCursor?: Node | null
  createParentVNode: () => VNode
}

export function createVirtualRoot(init: CreateVirtualRootInit): VirtualRoot {
  let vroot: VNode | null = null
  let styles = init.styleManager ?? defaultStyleManager
  let hydrationCursor = init.hydrationCursor

  let eventTarget = new TypedEventTarget<VirtualRootEventMap>()
  let scheduler =
    init.scheduler ??
    createScheduler((init.container as Node).ownerDocument ?? document, eventTarget, styles)
  let frame = init.frame ?? init.createFrame?.(scheduler, styles)
  if (!frame) {
    throw new Error('Expected frame handle')
  }

  let isErrorForwardingAttached = false
  function forwardDomError(event: Event) {
    eventTarget.dispatchEvent(new ErrorEvent('error', { error: (event as ErrorEvent).error }))
  }
  function attachDomErrorForwarding() {
    if (isErrorForwardingAttached) return
    init.container.addEventListener('error', forwardDomError)
    isErrorForwardingAttached = true
  }
  function detachDomErrorForwarding() {
    if (!isErrorForwardingAttached) return
    init.container.removeEventListener('error', forwardDomError)
    isErrorForwardingAttached = false
  }
  attachDomErrorForwarding()

  return Object.assign(eventTarget, {
    render(element: RemixNode) {
      attachDomErrorForwarding()

      let vnode = toVNode(element)
      let vParent = init.createParentVNode()
      scheduler.enqueueTasks([
        () => {
          diffVNodes(
            vroot,
            vnode,
            init.container,
            frame,
            scheduler,
            styles,
            vParent,
            eventTarget,
            init.anchor,
            hydrationCursor,
          )
          vroot = vnode
          hydrationCursor = init.nextHydrationCursor
        },
      ])
      scheduler.dequeue()
    },

    dispose() {
      detachDomErrorForwarding()

      if (!vroot) return
      let current = vroot
      vroot = null
      scheduler.enqueueTasks([() => removeVNode(current, init.container, scheduler, styles)])
      scheduler.dequeue()
    },

    flush() {
      scheduler.dequeue()
    },
  })
}
