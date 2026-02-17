import {
  RECONCILER_FRAGMENT,
  RECONCILER_NODE_CHILDREN,
  RECONCILER_PROP_KEYS,
} from '../testing/jsx.ts'
import { createScheduler } from './scheduler.ts'
import type {
  CommittedComponentNode,
  CommittedHostNode,
  CommittedNode,
  CommittedTextNode,
  Component,
  ComponentRenderNode,
  HostInput,
  HostRenderNode,
  NodePolicy,
  Plugin,
  PluginHostContext,
  PreparedPlugin,
  ReconcilerElement,
  ReconcilerRoot,
  RenderNode,
  RenderValue,
  RootTask,
  TextRenderNode,
  UpdateHandle,
} from './types.ts'

type RootState<parent, node, text extends node, element extends node> = {
  container: parent
  current: CommittedNode<parent, node, text, element>[]
  renderValue: null | RenderValue
  pendingTasks: RootTask[]
  renderController: null | AbortController
  disposed: boolean
  enqueue(): void
}

type ReconcilerOptions<parent, node, text extends node, element extends node> = {
  policy: NodePolicy<parent, node, text, element>
  plugins?: Array<Plugin<parent, node, text, element>>
}

type PreparedPlugins<parent, node, text extends node, element extends node> = {
  orderedSpecial: PreparedPlugin<parent, node, text, element>[]
  orderedTerminal: PreparedPlugin<parent, node, text, element>[]
  routedSpecialByKey: Map<string, number[]>
  unroutedSpecialIds: number[]
  all: PreparedPlugin<parent, node, text, element>[]
}

export function createReconciler<parent, node, text extends node, element extends node>(
  options: ReconcilerOptions<parent, node, text, element>,
) {
  let policy = options.policy
  let plugins = preparePlugins(options.plugins ?? [])
  let scheduler = createScheduler()

  return {
    createRoot(container: parent): ReconcilerRoot<RenderValue> {
      let root: RootState<parent, node, text, element> = {
        container,
        current: [],
        renderValue: null,
        pendingTasks: [],
        renderController: null,
        disposed: false,
        enqueue() {},
      }

      let scheduledRoot = {
        flushWork,
      }
      root.enqueue = () => scheduler.enqueue(scheduledRoot)

      return {
        render(value) {
          if (root.disposed) return
          root.renderValue = value
          root.enqueue()
        },
        flush() {
          if (root.disposed) return
          scheduler.flush()
        },
        remove() {
          if (root.disposed) return
          root.renderValue = null
          flushWork()
        },
        dispose() {
          if (root.disposed) return
          root.renderValue = null
          flushWork()
          root.disposed = true
        },
      }

      function flushWork() {
        if (root.disposed) return
        root.renderController?.abort()
        root.renderController = new AbortController()

        let nextNodes = normalizeToRenderNodes(root.renderValue)
        root.current = reconcileChildren(root.container, root.current, nextNodes, root)
        runPendingTasks(root)
      }
    },
  }

  function runPendingTasks(root: RootState<parent, node, text, element>) {
    let signal = root.renderController?.signal ?? new AbortController().signal
    let tasks = root.pendingTasks
    root.pendingTasks = []
    for (let task of tasks) {
      task(signal)
    }
  }

  function reconcileChildren(
    parentNode: parent | element,
    currentChildren: CommittedNode<parent, node, text, element>[],
    nextNodes: RenderNode[],
    root: RootState<parent, node, text, element>,
  ) {
    let used: boolean[] = []
    for (let index = 0; index < currentChildren.length; index++) used[index] = false

    let keyed = new Map<unknown, number[]>()
    for (let index = 0; index < currentChildren.length; index++) {
      let current = currentChildren[index]
      if (current.key == null) continue
      let bucket = keyed.get(current.key) ?? []
      bucket.push(index)
      keyed.set(current.key, bucket)
    }

    let nextCommitted: CommittedNode<parent, node, text, element>[] = []
    let scanIndex = 0
    for (let next of nextNodes) {
      let matchIndex = findMatchIndex(
        currentChildren,
        used,
        keyed,
        next,
        scanIndex,
      )
      if (matchIndex >= 0) {
        used[matchIndex] = true
        if (matchIndex === scanIndex) scanIndex++
        let reconciled = reconcileNode(
          currentChildren[matchIndex],
          next,
          parentNode,
          root,
        )
        nextCommitted.push(reconciled)
        continue
      }
      let mounted = mountNode(next, root)
      nextCommitted.push(mounted)
    }

    for (let index = 0; index < currentChildren.length; index++) {
      if (used[index]) continue
      removeNode(parentNode, currentChildren[index], root)
    }

    placeChildren(parentNode, nextCommitted)
    return nextCommitted
  }

  function findMatchIndex(
    currentChildren: CommittedNode<parent, node, text, element>[],
    used: boolean[],
    keyed: Map<unknown, number[]>,
    next: RenderNode,
    scanStart: number,
  ) {
    if (next.key != null) {
      let bucket = keyed.get(next.key) ?? []
      for (let index of bucket) {
        if (used[index]) continue
        let candidate = currentChildren[index]
        if (!isCompatible(candidate, next)) continue
        return index
      }
      return -1
    }

    for (let index = scanStart; index < currentChildren.length; index++) {
      if (used[index]) continue
      let candidate = currentChildren[index]
      if (!isCompatible(candidate, next)) continue
      return index
    }

    for (let index = 0; index < currentChildren.length; index++) {
      if (used[index]) continue
      let candidate = currentChildren[index]
      if (!isCompatible(candidate, next)) continue
      return index
    }

    return -1
  }

  function reconcileNode(
    current: CommittedNode<parent, node, text, element>,
    next: RenderNode,
    parentNode: parent | element,
    root: RootState<parent, node, text, element>,
  ): CommittedNode<parent, node, text, element> {
    if (!isCompatible(current, next)) {
      let mounted = mountNode(next, root)
      removeNode(parentNode, current, root)
      return mounted
    }

    if (next.kind === 'text' && current.kind === 'text') {
      policy.setText(current.node, next.value)
      current.key = next.key
      return current
    }

    if (next.kind === 'host' && current.kind === 'host') {
      current.key = next.key
      current.type = next.type
      current.input = toHostInput(next)
      runHostPlugins(current, root)
      current.children = reconcileChildren(current.node, current.children, normalizeToRenderNodes(next.children), root)
      return current
    }

    if (next.kind === 'component' && current.kind === 'component') {
      current.key = next.key
      let rendered = current.render(next.props)
      let nextChild = normalizeSingle(rendered)
      if (nextChild) {
        if (current.child) {
          current.child = reconcileNode(current.child, nextChild, parentNode, root)
        } else {
          current.child = mountNode(nextChild, root)
        }
      } else if (current.child) {
        removeNode(parentNode, current.child, root)
        current.child = null
      }
      return current
    }

    let mounted = mountNode(next, root)
    removeNode(parentNode, current, root)
    return mounted
  }

  function mountNode(
    next: RenderNode,
    root: RootState<parent, node, text, element>,
  ): CommittedNode<parent, node, text, element> {
    if (next.kind === 'text') {
      let textNode = policy.createText(next.value)
      let committed: CommittedTextNode<text> = {
        kind: 'text',
        key: next.key,
        node: textNode,
      }
      return committed
    }

    if (next.kind === 'host') {
      let node = policy.createElement(next.type)
      let committed: CommittedHostNode<parent, node, text, element> = {
        kind: 'host',
        key: next.key,
        type: next.type,
        input: toHostInput(next),
        node,
        children: [],
        pluginSlots: [],
        activePluginIds: [],
      }
      runHostPlugins(committed, root)
      let children = normalizeToRenderNodes(next.children)
      committed.children = reconcileChildren(node, [], children, root)
      return committed
    }

    let handle = createUpdateHandle(root)
    let render = next.type(handle, next.setup)
    let childValue = render(next.props)
    let committed: CommittedComponentNode<parent, node, text, element> = {
      kind: 'component',
      key: next.key,
      type: next.type,
      render: render as (props: Record<string, unknown>) => RenderValue,
      child: null,
      handle,
    }
    let normalized = normalizeSingle(childValue)
    if (normalized) {
      committed.child = mountNode(normalized, root)
    }
    return committed
  }

  function createUpdateHandle(root: RootState<parent, node, text, element>): UpdateHandle {
    return {
      update() {
        return new Promise((resolve) => {
          root.pendingTasks.push((signal) => resolve(signal))
          root.enqueue()
        })
      },
      queueTask(task) {
        root.pendingTasks.push(task)
        root.enqueue()
      },
    }
  }

  function removeNode(
    parentNode: parent | element,
    nodeToRemove: CommittedNode<parent, node, text, element>,
    root: RootState<parent, node, text, element>,
  ) {
    if (nodeToRemove.kind === 'component') {
      if (nodeToRemove.child) {
        removeNode(parentNode, nodeToRemove.child, root)
      }
      return
    }

    if (nodeToRemove.kind === 'host') {
      for (let child of nodeToRemove.children) {
        removeNode(nodeToRemove.node, child, root)
      }
      teardownHostPlugins(nodeToRemove, root)
    }

    let parent = policy.getParent(nodeToRemove.node)
    if (parent == null) return
    policy.remove(parent, nodeToRemove.node)
  }

  function placeChildren(
    parentNode: parent | element,
    children: CommittedNode<parent, node, text, element>[],
  ) {
    let anchor: null | node = null
    for (let index = children.length - 1; index >= 0; index--) {
      let childNode = firstMaterialNode(children[index])
      if (!childNode) continue
      let existingParent = policy.getParent(childNode)
      if (existingParent == null) {
        policy.insert(parentNode, childNode, anchor)
      } else if (existingParent === parentNode) {
        policy.move(parentNode, childNode, anchor)
      } else {
        throw new Error('illegal cross-parent placement')
      }
      anchor = childNode
    }
  }

  function firstMaterialNode(nodeValue: CommittedNode<parent, node, text, element>): null | node {
    if (nodeValue.kind === 'component') {
      if (!nodeValue.child) return null
      return firstMaterialNode(nodeValue.child)
    }
    return nodeValue.node
  }

  function runHostPlugins(
    host: CommittedHostNode<parent, node, text, element>,
    root: RootState<parent, node, text, element>,
  ) {
    if (plugins.all.length === 0 && host.activePluginIds.length === 0) return

    let consumed: null | Set<string> = null
    let context: PluginHostContext<parent, node, text, element> = {
      root: createRootFacade(root),
      host,
      input: host.input,
      consume(key) {
        if (!consumed) consumed = new Set()
        consumed.add(key)
      },
      isConsumed(key) {
        return consumed?.has(key) ?? false
      },
      remainingPropsView() {
        let output: Record<string, unknown> = {}
        for (let key in host.input.props) {
          if (consumed?.has(key)) continue
          output[key] = host.input.props[key]
        }
        return output
      },
    }

    runPluginPhase(plugins.orderedSpecial, plugins.routedSpecialByKey, plugins.unroutedSpecialIds, context)
    runPluginPhase(plugins.orderedTerminal, new Map(), [], context)
  }

  function teardownHostPlugins(
    host: CommittedHostNode<parent, node, text, element>,
    root: RootState<parent, node, text, element>,
  ) {
    if (host.activePluginIds.length === 0) return
    let context: PluginHostContext<parent, node, text, element> = {
      root: createRootFacade(root),
      host,
      input: host.input,
      consume() {},
      isConsumed() {
        return false
      },
      remainingPropsView() {
        return host.input.props
      },
    }
    let ids = host.activePluginIds.slice()
    for (let pluginId of ids) {
      let prepared = plugins.all[pluginId]
      if (!prepared) continue
      let slot = host.pluginSlots[pluginId]
      if (slot === undefined) continue
      prepared.plugin.unmountHost?.(context, slot)
      host.pluginSlots[pluginId] = undefined
    }
    host.activePluginIds = []
  }

  function runPluginPhase(
    ordered: PreparedPlugin<parent, node, text, element>[],
    routedByKey: Map<string, number[]>,
    unroutedIds: number[],
    context: PluginHostContext<parent, node, text, element>,
  ) {
    if (ordered.length === 0 && context.host.activePluginIds.length === 0) return
    let candidateIds = new Set<number>()
    for (let id of unroutedIds) candidateIds.add(id)
    for (let key of context.input.propKeys) {
      let routed = routedByKey.get(key)
      if (!routed) continue
      for (let id of routed) candidateIds.add(id)
    }
    for (let id of context.host.activePluginIds) candidateIds.add(id)

    if (candidateIds.size === 0) return

    for (let prepared of ordered) {
      if (!candidateIds.has(prepared.id)) continue
      let plugin = prepared.plugin
      let isActive = context.host.pluginSlots[prepared.id] !== undefined
      let shouldActivate = plugin.shouldActivate?.(context) ?? true
      if (!isActive && !shouldActivate) continue
      if (isActive && !shouldActivate) {
        let previousSlot = context.host.pluginSlots[prepared.id]
        if (previousSlot !== undefined) {
          plugin.unmountHost?.(context, previousSlot)
          context.host.pluginSlots[prepared.id] = undefined
          context.host.activePluginIds = context.host.activePluginIds.filter((id) => id !== prepared.id)
        }
        continue
      }
      if (!isActive) {
        let mounted = plugin.mountHost?.(context)
        context.host.pluginSlots[prepared.id] = mounted === undefined ? null : mounted
        context.host.activePluginIds.push(prepared.id)
      }
      let slot = context.host.pluginSlots[prepared.id]
      if (slot !== undefined) {
        plugin.commitHost?.(context, slot)
      }
    }
  }

  function createRootFacade(_root: RootState<parent, node, text, element>): ReconcilerRoot<RenderValue> {
    return {
      render() {},
      flush() {},
      remove() {},
      dispose() {},
    }
  }
}

function preparePlugins<parent, node, text extends node, element extends node>(
  rawPlugins: Array<Plugin<parent, node, text, element>>,
): PreparedPlugins<parent, node, text, element> {
  let all: PreparedPlugin<parent, node, text, element>[] = []
  for (let index = 0; index < rawPlugins.length; index++) {
    let plugin = rawPlugins[index]
    let prepared: PreparedPlugin<parent, node, text, element> = {
      id: index,
      phase: plugin.phase,
      priority: plugin.priority ?? 0,
      routingKeys: plugin.routing?.keys ?? [],
      plugin,
    }
    all.push(prepared)
  }
  let orderedSpecial = all
    .filter((plugin) => plugin.phase === 'special')
    .sort(comparePreparedPlugins)
  let orderedTerminal = all
    .filter((plugin) => plugin.phase === 'terminal')
    .sort(comparePreparedPlugins)
  let routedSpecialByKey = new Map<string, number[]>()
  let unroutedSpecialIds: number[] = []
  for (let plugin of orderedSpecial) {
    if (plugin.routingKeys.length === 0) {
      unroutedSpecialIds.push(plugin.id)
      continue
    }
    for (let key of plugin.routingKeys) {
      let ids = routedSpecialByKey.get(key) ?? []
      ids.push(plugin.id)
      routedSpecialByKey.set(key, ids)
    }
  }
  return {
    orderedSpecial,
    orderedTerminal,
    routedSpecialByKey,
    unroutedSpecialIds,
    all,
  }
}

function comparePreparedPlugins<parent, node, text extends node, element extends node>(
  a: PreparedPlugin<parent, node, text, element>,
  b: PreparedPlugin<parent, node, text, element>,
) {
  if (a.priority !== b.priority) return a.priority - b.priority
  return a.id - b.id
}

function isCompatible<parent, node, text extends node, element extends node>(
  current: CommittedNode<parent, node, text, element>,
  next: RenderNode,
) {
  if (current.kind !== next.kind) return false
  if (current.kind === 'text' && next.kind === 'text') return true
  if (current.kind === 'host' && next.kind === 'host') return current.type === next.type
  if (current.kind === 'component' && next.kind === 'component') return current.type === next.type
  return false
}

function toHostInput(next: HostRenderNode): HostInput {
  return {
    type: next.type,
    key: next.key,
    props: next.props,
    children: next.children,
    propKeys: next.propKeys,
  }
}

function normalizeSingle(value: RenderValue): null | RenderNode {
  let nodes = normalizeToRenderNodes(value)
  if (nodes.length === 0) return null
  return nodes[0]
}

function normalizeToRenderNodes(value: null | RenderValue): RenderNode[] {
  let output: RenderNode[] = []
  collectRenderNodes(value, output)
  return output
}

function collectRenderNodes(value: null | RenderValue, output: RenderNode[]) {
  if (value == null || typeof value === 'boolean') return
  if (typeof value === 'string') {
    output.push({ kind: 'text', value, key: null })
    return
  }
  if (typeof value === 'number' || typeof value === 'bigint') {
    output.push({ kind: 'text', value: String(value), key: null })
    return
  }
  if (Array.isArray(value)) {
    for (let child of value) collectRenderNodes(child, output)
    return
  }
  if (!isReconcilerElement(value)) return

  if (value.type === RECONCILER_FRAGMENT) {
    let children = readChildren(value)
    for (let child of children) collectRenderNodes(child, output)
    return
  }

  if (typeof value.type === 'string') {
    let children = readChildren(value)
    let props: Record<string, unknown> = {}
    for (let key in value.props) {
      if (key === 'children') continue
      props[key] = value.props[key]
    }
    let propKeys = readPropKeys(value, props)
    let host: HostRenderNode = {
      kind: 'host',
      type: value.type,
      key: value.key,
      props,
      children,
      propKeys,
    }
    output.push(host)
    return
  }

  if (typeof value.type === 'function') {
    let props = { ...value.props }
    let setup = props.setup
    delete props.setup
    let component: ComponentRenderNode = {
      kind: 'component',
      type: value.type as Component<any, any, RenderValue>,
      key: value.key,
      setup,
      props,
    }
    output.push(component)
  }
}

function readChildren(element: ReconcilerElement): RenderValue[] {
  let cached = (element as ReconcilerElement & { [RECONCILER_NODE_CHILDREN]?: RenderValue[] })[
    RECONCILER_NODE_CHILDREN
  ]
  if (cached) return cached
  let children = element.props.children
  if (children == null) return []
  if (Array.isArray(children)) return children as RenderValue[]
  return [children as RenderValue]
}

function readPropKeys(element: ReconcilerElement, props: Record<string, unknown>) {
  let cached = (element as ReconcilerElement & { [RECONCILER_PROP_KEYS]?: string[] })[
    RECONCILER_PROP_KEYS
  ]
  if (cached) return cached
  let keys: string[] = []
  for (let key in props) keys.push(key)
  return keys
}

function isReconcilerElement(value: unknown): value is ReconcilerElement {
  if (!value || typeof value !== 'object') return false
  return (value as { $rmx?: unknown }).$rmx === true
}
