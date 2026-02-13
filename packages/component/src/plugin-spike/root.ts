import { createReconcilerRuntime } from './reconciler.ts'
import { createScheduler } from './scheduler.ts'
import { connect } from './plugins/connect.ts'
import { TypedEventTarget } from '@remix-run/interaction'
import type {
  HostRenderNode,
  Plugin,
  PreparedPlugin,
  RootState,
  SpikeRenderable,
  SpikeHandle,
  Task,
} from './types.ts'

export function createReconciler(plugins: Plugin[]) {
  let allPlugins = [connect, ...plugins]
  let preparedPlugins: PreparedPlugin[] = allPlugins.map((plugin) => {
    let handle: PreparedPlugin['handle'] = new TypedEventTarget()
    let createHost = plugin(handle) ?? null
    return { handle, createHost }
  })
  let runtime = createReconcilerRuntime(preparedPlugins)
  let scheduler = createScheduler(preparedPlugins, runtime.reconcileRoot)

  function createRoot(container: Element) {
    let root: RootState = {
      container,
      current: null,
      render: null,
      enqueue,
      renderController: null,
      pendingTasks: [],
      scheduled: false,
      handle: null as never,
    }

    let handle: SpikeHandle = {
      host: runtime.createHost,
      update,
      queueTask,
      get signal() {
        return root.renderController?.signal ?? new AbortController().signal
      },
    }
    root.handle = handle

    return {
      render(render: null | SpikeRenderable | ((handle: SpikeHandle) => SpikeRenderable)) {
        if (typeof render === 'function') {
          root.render = render
        } else {
          root.render = () => render
        }
        enqueue()
      },
      flush() {
        scheduler.flush()
      },
      remove() {
        root.render = null
        runtime.removeRoot(root)
      },
      dispose() {
        root.render = null
        runtime.removeRoot(root)
        scheduler.dispose()
      },
    }

    function enqueue() {
      if (root.scheduled) return
      root.scheduled = true
      scheduler.enqueue(root)
    }

    function queueTask(task: Task) {
      root.pendingTasks.push(task)
      enqueue()
    }

    function update() {
      return new Promise<AbortSignal>((resolve) => {
        root.pendingTasks.push((signal) => resolve(signal))
        enqueue()
      })
    }
  }

  return {
    createRoot,
  }
}
