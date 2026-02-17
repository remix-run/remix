import { createReconcilerRuntime } from './reconciler.ts'
import { createScheduler } from './scheduler.ts'
import { GuardedEventTarget } from './event-target.ts'
import { ReconcilerErrorEvent } from './types.ts'
import type {
  HostPlugin,
  HostPluginDispatchPlan,
  NodePolicy,
  Plugin,
  PreparedPlugin,
  ReconcilerRoot,
  RenderValue,
  RootState,
  NodeHandle,
  RootTask,
} from './types.ts'

let nextRootId = 1

export function createReconciler<
  parentNode,
  node,
  elementNode extends node & parentNode,
  traversal,
>(
  nodePolicy: NodePolicy<parentNode, node, node, elementNode, traversal>,
  plugins: Plugin<elementNode>[],
) {
  let runtime = createReconcilerRuntime(nodePolicy)
  let scheduler = createScheduler(runtime.reconcileRoot)

  function createRoot(container: parentNode): ReconcilerRoot<parentNode> {
    return createRootState(container, null)
  }

  function createRootState(
    container: parentNode,
    parent: null | RootState<parentNode, node, elementNode, traversal>,
  ): ReconcilerRoot<parentNode> {
    let target = new EventTarget()
    let id = nextRootId++
    let root: RootState<parentNode, node, elementNode, traversal> = {
      id,
      target,
      parent,
      branches: new Set(),
      container,
      current: [],
      render: null,
      enqueue,
      nodePolicy,
      renderController: null,
      pendingTasks: [],
      scheduled: false,
      disposed: false,
      handle: null as never,
      preparedPlugins: [],
      hostPlugins: [],
      hostPluginDispatch: createHostPluginDispatch([]),
    }
    parent?.branches.add(root)

    let handle: NodeHandle = {
      node: runtime.createNode,
      update,
      queueTask,
      get signal() {
        return root.renderController?.signal ?? new AbortController().signal
      },
    }
    root.handle = handle

    let reconcilerRoot = Object.assign(target, {
      render(render: null | RenderValue | ((handle: NodeHandle) => RenderValue)) {
        if (root.disposed) return
        if (typeof render === 'function') {
          root.render = render
        } else {
          root.render = () => render
        }
        enqueue()
      },
      branch(nextContainer: parentNode) {
        return createRootState(nextContainer, root)
      },
      flush() {
        scheduler.flush()
      },
      remove() {
        if (root.disposed) return
        root.render = null
        runtime.removeRoot(root)
      },
      dispose() {
        if (root.disposed) return
        disposeBranches(root)
        parent?.branches.delete(root)
        root.disposed = true
        root.render = null
        runtime.removeRoot(root)
      },
    }) as ReconcilerRoot<parentNode>
    initializePlugins()
    return reconcilerRoot

    function enqueue() {
      if (root.disposed) return
      if (root.scheduled) return
      root.scheduled = true
      scheduler.enqueue(root)
    }

    function queueTask(task: RootTask) {
      if (root.disposed) return
      root.pendingTasks.push(task)
      enqueue()
    }

    function update() {
      return new Promise<AbortSignal>((resolve) => {
        if (root.disposed) {
          let controller = new AbortController()
          controller.abort()
          resolve(controller.signal)
          return
        }
        root.pendingTasks.push((signal) => resolve(signal))
        enqueue()
      })
    }

    function initializePlugins() {
      let preparedPlugins: PreparedPlugin<elementNode>[] = plugins.map((plugin) => {
        let pluginName = plugin.name || 'plugin'
        let pluginHandle = new GuardedEventTarget((error) => {
          root.target.dispatchEvent(
            new ReconcilerErrorEvent(error, {
              phase: 'plugin',
              rootId: root.id,
              pluginName,
            }),
          )
        })
        let createHost = plugin(pluginHandle, reconcilerRoot) ?? null
        return { handle: pluginHandle, hostPlugin: createHost, name: pluginName }
      })
      let hostPlugins: HostPlugin<elementNode>[] = []
      for (let plugin of preparedPlugins) {
        if (plugin.hostPlugin) hostPlugins.push(plugin.hostPlugin)
      }
      root.preparedPlugins = preparedPlugins
      root.hostPlugins = hostPlugins
      root.hostPluginDispatch = createHostPluginDispatch(hostPlugins)
    }
  }

  function disposeBranches(root: RootState<parentNode, node, elementNode, traversal>) {
    for (let branch of root.branches) {
      disposeBranches(branch)
      branch.render = null
      branch.disposed = true
      runtime.removeRoot(branch)
    }
    root.branches.clear()
  }

  return {
    createRoot,
  }
}

function createHostPluginDispatch<elementNode>(
  hostPlugins: HostPlugin<elementNode>[],
): HostPluginDispatchPlan {
  let pre = {
    keyed: new Map<string, number[]>(),
    wildcard: [] as number[],
    byShape: new Map<string, number[]>(),
    seenMarks: createSeenMarks(hostPlugins.length),
    seenEpoch: 0,
  }
  let post = {
    keyed: new Map<string, number[]>(),
    wildcard: [] as number[],
    byShape: new Map<string, number[]>(),
    seenMarks: createSeenMarks(hostPlugins.length),
    seenEpoch: 0,
  }

  for (let index = 0; index < hostPlugins.length; index++) {
    let hostPlugin = hostPlugins[index]
    let phase = hostPlugin.phase ?? 'pre'
    let target = phase === 'post' ? post : pre
    if (hostPlugin.keys === '*') {
      target.wildcard.push(index)
      continue
    }
    for (let key of hostPlugin.keys) {
      let list = target.keyed.get(key)
      if (!list) {
        list = []
        target.keyed.set(key, list)
      }
      list.push(index)
    }
  }

  return { pre, post }
}

function createSeenMarks(size: number) {
  let marks: number[] = []
  for (let index = 0; index < size; index++) {
    marks.push(0)
  }
  return marks
}
