import { TypedEventTarget } from '@remix-run/interaction'
import type { FrameHandle } from './component.ts'
import { createFrameHandle } from './component.ts'
import { invariant } from './invariant.ts'
import type { RemixNode } from './jsx.ts'
import { createScheduler, type Scheduler } from './scheduler.ts'
import { diffVNodes, remove as removeVNode } from './reconcile.ts'
import { toVNode } from './to-vnode.ts'
import { ROOT_VNODE, type VNode } from './vnode.ts'
import { resetStyleState } from './diff-props.ts'

export type VirtualRootEventMap = {
  error: ErrorEvent
}

export type VirtualRoot = TypedEventTarget<VirtualRootEventMap> & {
  render: (element: RemixNode) => void
  remove: () => void
  flush: () => void
}

export type VirtualRootOptions = {
  frame?: FrameHandle
  scheduler?: Scheduler
}

export { createScheduler, type Scheduler }
export { diffVNodes, toVNode }
export { resetStyleState }

export function createRangeRoot(
  [start, end]: [Node, Node],
  options: VirtualRootOptions = {},
): VirtualRoot {
  let vroot: VNode | null = null
  let frameStub = options.frame ?? createFrameHandle()

  let container = end.parentNode
  invariant(container, 'Expected parent node')
  invariant(end.parentNode === container, 'Boundaries must share parent')

  let hydrationCursor = start.nextSibling

  let eventTarget = new TypedEventTarget<VirtualRootEventMap>()
  let scheduler =
    options.scheduler ?? createScheduler(container.ownerDocument ?? document, eventTarget)

  // Forward bubbling error events from DOM to root EventTarget
  container.addEventListener('error', (event) => {
    eventTarget.dispatchEvent(new ErrorEvent('error', { error: (event as ErrorEvent).error }))
  })

  return Object.assign(eventTarget, {
    render(element: RemixNode) {
      let vnode = toVNode(element)
      let vParent: VNode = { type: ROOT_VNODE, _svg: false, _rangeStart: start, _rangeEnd: end }
      scheduler.enqueueTasks([
        () => {
          diffVNodes(
            vroot,
            vnode,
            container,
            frameStub,
            scheduler,
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

    remove() {
      if (!vroot) return
      let current = vroot
      vroot = null
      scheduler.enqueueTasks([() => removeVNode(current, container, scheduler)])
      scheduler.dequeue()
    },

    flush() {
      scheduler.dequeue()
    },
  })
}

export function createRoot(container: HTMLElement, options: VirtualRootOptions = {}): VirtualRoot {
  let vroot: VNode | null = null
  let frameStub = options.frame ?? createFrameHandle()
  let hydrationCursor = container.innerHTML.trim() !== '' ? container.firstChild : undefined

  let eventTarget = new TypedEventTarget<VirtualRootEventMap>()
  let scheduler =
    options.scheduler ?? createScheduler(container.ownerDocument ?? document, eventTarget)

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

    remove() {
      if (!vroot) return
      let current = vroot
      vroot = null
      scheduler.enqueueTasks([() => removeVNode(current, container, scheduler)])
      scheduler.dequeue()
    },

    flush() {
      scheduler.dequeue()
    },
  })
}
