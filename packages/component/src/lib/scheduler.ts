import { createDocumentState } from './document-state.ts'
import { createComponentErrorEvent } from './error-event.ts'
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

/**
 * Scheduler API used by the reconciler and frame runtime.
 */
export type Scheduler = ReturnType<typeof createScheduler>

// Protect against infinite cascading updates (e.g. handle.update() during render)
const MAX_CASCADING_UPDATES = 50

export type SchedulerPhaseEvent = Event & {
  parents: ParentNode[]
}

/**
 * Creates the DOM update scheduler used by the component runtime.
 *
 * @param doc Document associated with the rendered tree.
 * @param rootTarget Event target that receives runtime errors.
 * @param styles Style manager used during reconciliation.
 * @returns A scheduler instance.
 */
export function createScheduler(
  doc: Document,
  rootTarget: EventTarget,
  styles: StyleManager = defaultStyleManager,
) {
  let documentState = createDocumentState(doc)
  let scheduled = new Map<CommittedComponentNode, ParentNode>()
  let workTasks: EmptyFn[] = []
  let commitPhaseTasks: EmptyFn[] = []
  let postCommitTasks: EmptyFn[] = []
  let flushScheduled = false
  let flushing = false
  let cascadingUpdateCount = 0
  let resetScheduled = false
  let phaseEvents = new EventTarget()
  let scheduler: {
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

  function dispatchError(error: unknown) {
    console.error(error)
    rootTarget.dispatchEvent(createComponentErrorEvent(error))
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

  function getFrameStyleManager(vnode: CommittedComponentNode): StyleManager {
    let runtime = vnode._handle?.frame.$runtime as { styleManager?: StyleManager } | undefined
    return runtime?.styleManager ?? styles
  }

  function flush() {
    if (flushing) return
    flushing = true
    try {
      while (true) {
        flushScheduled = false

        let batch = new Map(scheduled)
        scheduled.clear()

        let hasWork =
          batch.size > 0 ||
          workTasks.length > 0 ||
          commitPhaseTasks.length > 0 ||
          postCommitTasks.length > 0
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
          let noAncestorInBatch = new Set<VNode>()
          let ancestorInBatch = new Set<VNode>()

          for (let [vnode, domParent] of vnodes) {
            if (ancestorIsScheduled(vnode, batch, noAncestorInBatch, ancestorInBatch)) continue
            let handle = vnode._handle
            let curr = vnode._content
            let vParent = vnode._parent!
            // Calculate anchor at render time from current vdom position (never stale).
            // Needed for fragment self-updates that add children - without this, new children
            // would be appended after siblings. The keyed diff has placement logic, but unkeyed
            // diff relies on anchor for correct positioning.
            let anchor = findNextSiblingDomAnchor(vnode, vParent) || undefined
            try {
              let updateStyles = getFrameStyleManager(vnode)
              renderComponent(
                handle,
                curr,
                vnode,
                domParent,
                handle.frame,
                scheduler,
                updateStyles,
                rootTarget,
                vParent,
                anchor,
              )
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
      flushing = false
    }
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
    if (flushScheduled || flushing) return
    flushScheduled = true
    queueMicrotask(flush)
  }

  function ancestorIsScheduled(
    vnode: VNode,
    batch: Map<CommittedComponentNode, ParentNode>,
    noAncestorInBatch: Set<VNode>,
    ancestorInBatch: Set<VNode>,
  ): boolean {
    let path: VNode[] = []
    let current = vnode._parent

    while (current) {
      // Already verified this node has **no** scheduled ancestor above it
      if (noAncestorInBatch.has(current)) {
        for (let node of path) noAncestorInBatch.add(node)
        return false
      }

      if (
        // Already verified this node has a scheduled ancestor above it
        ancestorInBatch.has(current) ||
        (isCommittedComponentNode(current) && batch.has(current))
      ) {
        for (let node of path) ancestorInBatch.add(node)
        return true
      }

      path.push(current)
      current = current._parent
    }

    // Reached root - mark entire path as safe for future lookups
    for (let node of path) noAncestorInBatch.add(node)
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
