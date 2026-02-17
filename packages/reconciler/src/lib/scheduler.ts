export type ScheduledRoot = {
  flushWork(): void
}

export function createScheduler() {
  let scheduled = false
  let roots = new Set<ScheduledRoot>()

  return {
    enqueue(root: ScheduledRoot) {
      roots.add(root)
      if (scheduled) return
      scheduled = true
      queueMicrotask(() => {
        flush()
      })
    },
    flush,
    dispose() {
      roots.clear()
      scheduled = false
    },
  }

  function flush() {
    scheduled = false
    while (roots.size > 0) {
      let pending = Array.from(roots)
      roots.clear()
      for (let root of pending) {
        root.flushWork()
      }
    }
  }
}
