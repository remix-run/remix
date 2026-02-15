import { PluginAfterFlushEvent, PluginBeforeFlushEvent, ReconcilerErrorEvent } from './types.ts'
import type { RootState } from './types.ts'

const MAX_CASCADING_FLUSHES = 50

export type Scheduler<parentNode, node, elementNode extends node & parentNode, traversal> = ReturnType<
  typeof createScheduler<parentNode, node, elementNode, traversal>
>

export function createScheduler<parentNode, node, elementNode extends node & parentNode, traversal>(
  reconcileRoot: (root: RootState<parentNode, node, elementNode, traversal>, flushId: number) => void,
) {
  let flushId = 0
  let queue = new Set<RootState<parentNode, node, elementNode, traversal>>()
  let flushScheduled = false
  let cascadingFlushCount = 0
  let resetScheduled = false

  function enqueue(root: RootState<parentNode, node, elementNode, traversal>) {
    queue.add(root)
    if (flushScheduled) return
    flushScheduled = true
    queueMicrotask(flush)
  }

  function flush() {
    flushScheduled = false
    if (queue.size === 0) return

    cascadingFlushCount++
    scheduleCounterReset()
    if (cascadingFlushCount > MAX_CASCADING_FLUSHES) {
      let error = new Error('reconciler flush infinite loop detected')
      for (let root of queue) {
        root.scheduled = false
        root.target.dispatchEvent(new ReconcilerErrorEvent(error, { phase: 'scheduler', rootId: root.id }))
      }
      queue.clear()
      return
    }

    let batch = [...queue]
    queue.clear()

    flushId++
    let context = { flushId }

    for (let root of batch) {
      for (let plugin of root.preparedPlugins) {
        let event = new PluginBeforeFlushEvent(context)
        try {
          plugin.handle.dispatchEvent(event)
        } catch (error) {
          root.target.dispatchEvent(
            new ReconcilerErrorEvent(error, {
              phase: 'beforeFlush',
              flushId,
              rootId: root.id,
              pluginName: plugin.name,
            }),
          )
        }
      }
    }

    for (let root of batch) {
      root.scheduled = false
      try {
        reconcileRoot(root, flushId)
      } catch (error) {
        root.target.dispatchEvent(
          new ReconcilerErrorEvent(error, {
            phase: 'reconcile',
            flushId,
            rootId: root.id,
          }),
        )
      }
    }

    for (let root of batch) {
      for (let plugin of root.preparedPlugins) {
        let event = new PluginAfterFlushEvent(context)
        try {
          plugin.handle.dispatchEvent(event)
        } catch (error) {
          root.target.dispatchEvent(
            new ReconcilerErrorEvent(error, {
              phase: 'afterFlush',
              flushId,
              rootId: root.id,
              pluginName: plugin.name,
            }),
          )
        }
      }
    }
  }

  function scheduleCounterReset() {
    if (resetScheduled) return
    resetScheduled = true
    setTimeout(() => {
      cascadingFlushCount = 0
      resetScheduled = false
    }, 0)
  }

  function dispose() {
    queue.clear()
    flushScheduled = false
  }

  return {
    enqueue,
    flush,
    dispose,
  }
}
