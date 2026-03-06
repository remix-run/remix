import { createDocumentState } from './document-state.ts'
import type { CommittedComponentNode, VNode } from './vnode.ts'
import { isCommittedComponentNode } from './vnode.ts'
import {
  findNextSiblingDomAnchor,
  renderComponent,
  setActiveSchedulerUpdateParents,
} from './reconcile.ts'
import { defaultStyleManager } from './diff-props.ts'
import type { StyleManager } from './style/index.ts'

type EmptyFn = () => void
type SchedulerPhaseType = 'beforeUpdate' | 'commit'
type SchedulerPhaseListener = EventListenerOrEventListenerObject | null

export type Scheduler = ReturnType<typeof createScheduler>

// Protect against infinite cascading updates (e.g. handle.update() during render)
const MAX_CASCADING_UPDATES = 50

export type SchedulerPhaseEvent = Event & {
  parents: ParentNode[]
}

export function createScheduler(
  doc: Document,
  rootTarget: EventTarget,
  styles: StyleManager = defaultStyleManager,
) {
  let documentState = createDocumentState(doc)
  let scheduled = new Map<CommittedComponentNode, ParentNode>()
  let commitTasks: EmptyFn[] = []
  let flushScheduled = false
  let cascadingUpdateCount = 0
  let resetScheduled = false
  let phaseEvents = new EventTarget()
  let scheduler: {
    enqueue(vnode: CommittedComponentNode, domParent: ParentNode): void
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

  function dispatchError(error: unknown) {
    console.error(error)
    rootTarget.dispatchEvent(new ErrorEvent('error', { error }))
  }

  function scheduleCounterReset() {
    if (resetScheduled) return
    resetScheduled = true
    // Reset when control returns to the event loop while still allowing
    // microtask-driven flushes in the same turn to count as cascading.
    setTimeout(() => {
      cascadingUpdateCount = 0
      resetScheduled = false
    }, 0)
  }

  function flush() {
    flushScheduled = false

    let batch = new Map(scheduled)
    scheduled.clear()

    let hasWork = batch.size > 0 || commitTasks.length > 0
    if (!hasWork) return

    cascadingUpdateCount++
    scheduleCounterReset()

    if (cascadingUpdateCount > MAX_CASCADING_UPDATES) {
      let error = new Error('handle.update() infinite loop detected')
      dispatchError(error)
      return
    }

    documentState.capture()

    let updateParents = batch.size > 0 ? Array.from(new Set(batch.values())) : []
    setActiveSchedulerUpdateParents(updateParents)
    dispatchPhaseEvent('beforeUpdate', updateParents)

    if (batch.size > 0) {
      let vnodes = Array.from(batch)
      let noScheduledAncestor = new Set<VNode>()

      for (let [vnode, domParent] of vnodes) {
        if (ancestorIsScheduled(vnode, batch, noScheduledAncestor)) continue
        let handle = vnode._handle
        let curr = vnode._content
        let vParent = vnode._parent!
        // Calculate anchor at render time from current vdom position (never stale).
        // Needed for fragment self-updates that add children - without this, new children
        // would be appended after siblings. The keyed diff has placement logic, but unkeyed
        // diff relies on anchor for correct positioning.
        let anchor = findNextSiblingDomAnchor(vnode, vParent) || undefined
        try {
          renderComponent(
            handle,
            curr,
            vnode,
            domParent,
            handle.frame,
            scheduler,
            styles,
            rootTarget,
            vParent,
            anchor,
          )
        } catch (error) {
          dispatchError(error)
        }
      }
    }
    setActiveSchedulerUpdateParents(undefined)

    // restore before user tasks so users can move focus/selection etc.
    documentState.restore()

    dispatchPhaseEvent('commit', updateParents)

    flushTaskQueue(commitTasks)
  }

  function dispatchPhaseEvent(type: SchedulerPhaseType, parents: ParentNode[]) {
    let event = new Event(type) as SchedulerPhaseEvent
    event.parents = parents
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
    if (flushScheduled) return
    flushScheduled = true
    queueMicrotask(flush)
  }

  function ancestorIsScheduled(
    vnode: VNode,
    batch: Map<CommittedComponentNode, ParentNode>,
    safe: Set<VNode>,
  ): boolean {
    let path: VNode[] = []
    let current = vnode._parent

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

      current = current._parent
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

    enqueueTasks(newTasks: EmptyFn[]): void {
      commitTasks.push(...newTasks)
      scheduleFlush()
    },

    addEventListener(type, listener, options) {
      phaseEvents.addEventListener(type, listener, options)
    },

    removeEventListener(type, listener, options) {
      phaseEvents.removeEventListener(type, listener, options)
    },

    dequeue() {
      flush()
    },
  }

  return scheduler
}
