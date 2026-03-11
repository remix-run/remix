import { createDocumentState } from './document-state.ts'
import type { ComponentInstance } from './instance.ts'
import { findNextSiblingDomAnchor, setActiveSchedulerUpdateParents } from './reconcile-anchors.ts'
import { renderComponent } from './reconcile.ts'
import type { RendererRuntime } from './runtime.ts'

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
  runtime: RendererRuntime,
  rootTarget: EventTarget,
) {
  let documentState = createDocumentState(runtime.document)
  let scheduled = new Set<ComponentInstance>()
  let commitTasks: EmptyFn[] = []
  let flushScheduled = false
  let cascadingUpdateCount = 0
  let resetScheduled = false
  let phaseEvents = new EventTarget()
  let scheduler: {
    runtime: RendererRuntime
    enqueue(instance: ComponentInstance): void
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

    let batch = new Set(scheduled)
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

    let updateParents =
      batch.size > 0 ? Array.from(new Set(Array.from(batch, (instance) => instance.domParent))) : []
    setActiveSchedulerUpdateParents(updateParents)
    dispatchPhaseEvent('beforeUpdate', updateParents)

    if (batch.size > 0) {
      let instances = Array.from(batch)
      let safe = new Set<ComponentInstance>()

      for (let instance of instances) {
        if (ancestorIsScheduled(instance, batch, safe)) continue
        let vnode = instance.vnode
        let handle = instance.handle
        let curr = instance.content
        let vParent = instance.parentVNode
        if (!vnode || !vParent) continue
        // Calculate anchor at render time from current vdom position (never stale).
        // Needed for fragment self-updates that add children - without this, new children
        // would be appended after siblings. The keyed diff has placement logic, but unkeyed
        // diff relies on anchor for correct positioning.
        let anchor = findNextSiblingDomAnchor(vnode, vParent) || undefined
        try {
          renderComponent(
            instance,
            handle,
            curr,
            vnode,
            instance.domParent,
            handle.frame,
            scheduler,
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
    instance: ComponentInstance,
    batch: Set<ComponentInstance>,
    safe: Set<ComponentInstance>,
  ): boolean {
    let path: ComponentInstance[] = []
    let current = instance.parentComponent

    while (current) {
      if (safe.has(current)) {
        for (let node of path) safe.add(node)
        return false
      }

      path.push(current)

      if (batch.has(current)) {
        return true
      }

      current = current.parentComponent
    }

    for (let node of path) safe.add(node)
    return false
  }

  scheduler = {
    runtime,
    enqueue(instance: ComponentInstance): void {
      scheduled.add(instance)
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
