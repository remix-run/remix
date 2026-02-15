import { createReconcilerRuntime } from './reconciler.ts'
import { createScheduler } from './scheduler.ts'
import { SimpleEventTarget } from './simple-event-target.ts'
import type {
  NodePolicy,
  Plugin,
  PreparedPlugin,
  ReconcilerRoot,
  RenderValue,
  RootState,
  NodeHandle,
} from './types.ts'

let nextRootId = 1

export type ReconcilerOptions<
  parentNode,
  node,
  elementNode extends node & parentNode,
  traversal,
> = {
  nodePolicy: NodePolicy<parentNode, node, node, elementNode, traversal>
}

export function createReconciler<
  parentNode,
  node,
  elementNode extends node & parentNode,
  traversal,
>(
  plugins: Plugin<elementNode>[],
  options: ReconcilerOptions<parentNode, node, elementNode, traversal>,
) {
  let preparedPlugins: PreparedPlugin<elementNode>[] = plugins.map((plugin) => {
    let handle = new SimpleEventTarget()
    let createNode = plugin(handle) ?? null
    return { handle, createNode, name: plugin.name || 'plugin' }
  })
  let runtime = createReconcilerRuntime(options.nodePolicy, preparedPlugins)
  let scheduler = createScheduler(preparedPlugins, runtime.reconcileRoot)

  function createRoot(container: parentNode): ReconcilerRoot {
    let target = new EventTarget()
    let id = nextRootId++
    let root: RootState<parentNode, node, elementNode, traversal> = {
      id,
      target,
      container,
      current: [],
      render: null,
      enqueue,
      nodePolicy: options.nodePolicy,
      renderController: null,
      pendingTasks: [],
      scheduled: false,
      handle: null as never,
    }

    let handle: NodeHandle = {
      node: runtime.createNode,
      update,
      queueTask,
      get signal() {
        return root.renderController?.signal ?? new AbortController().signal
      },
    }
    root.handle = handle

    return Object.assign(target, {
      render(render: null | RenderValue | ((handle: NodeHandle) => RenderValue)) {
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
    }) as ReconcilerRoot

    function enqueue() {
      if (root.scheduled) return
      root.scheduled = true
      scheduler.enqueue(root)
    }

    function queueTask(task: (signal: AbortSignal) => void) {
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
