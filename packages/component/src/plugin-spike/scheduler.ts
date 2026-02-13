import { PluginAfterFlushEvent, PluginBeforeFlushEvent } from './types.ts'
import type { FlushContext, PreparedPlugin, RootState } from './types.ts'

export type Scheduler = ReturnType<typeof createScheduler>

export function createScheduler(
  plugins: PreparedPlugin[],
  reconcileRoot: (root: RootState) => void,
) {
  let flushId = 0
  let queue = new Set<RootState>()
  let flushScheduled = false

  function enqueue(root: RootState) {
    queue.add(root)
    if (flushScheduled) return
    flushScheduled = true
    queueMicrotask(flush)
  }

  function flush() {
    flushScheduled = false
    if (queue.size === 0) return

    let batch = [...queue]
    queue.clear()

    flushId++
    let context: FlushContext = { flushId }

    for (let plugin of plugins) {
      let event = new PluginBeforeFlushEvent(context)
      plugin.handle.dispatchEvent(event)
    }

    for (let root of batch) {
      root.scheduled = false
      reconcileRoot(root)
    }

    for (let plugin of plugins) {
      let event = new PluginAfterFlushEvent(context)
      plugin.handle.dispatchEvent(event)
    }
  }

  function scheduleTask(root: RootState, task: () => void) {
    root.pendingTasks.push(() => task())
    enqueue(root)
  }

  function dispose() {
    queue.clear()
    flushScheduled = false
  }

  return {
    enqueue,
    flush,
    scheduleTask,
    dispose,
  }
}
