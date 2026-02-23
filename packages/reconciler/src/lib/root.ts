import {
  RECONCILER_FRAGMENT,
  RECONCILER_NODE_CHILDREN,
  RECONCILER_PROP_KEYS,
} from '../testing/jsx.ts'
import {
  isPhasePluginAhead,
  isSetupSlot,
  removeActivePluginId,
  teardownPlugin,
} from './root-helpers.ts'
import { createScheduler } from './scheduler.ts'
import {
  PluginAfterCommitEvent,
  PluginBeforeCommitEvent,
  PluginCommitEvent,
  ReconcilerErrorEvent,
} from './types.ts'
import type {
  CommittedComponentNode,
  CommittedHostNode,
  CommittedNode,
  CommittedTextNode,
  Component,
  ComponentRenderNode,
  HostPropDelta,
  HostRenderNode,
  NodePolicy,
  Plugin,
  PluginDefinition,
  PluginHostContext,
  PluginRootHandle,
  PluginSetupHandle,
  PreparedPlugin,
  ReconcilerElement,
  ReconcilerRoot,
  RenderNode,
  RenderValue,
  RootTask,
  UpdateHandle,
} from './types.ts'

type RootState<parent, node, text extends node, element extends node> = {
  container: parent
  api: ReconcilerRoot<RenderValue>
  current: CommittedNode<parent, node, text, element>[]
  renderValue: null | RenderValue
  pendingTasks: RootTask[]
  renderController: null | AbortController
  disposed: boolean
  dirtyNodeIds: Set<number>
  hasPendingComponentUpdate: boolean
  isFlushing: boolean
  pendingHostCommits: PendingHostCommit<parent, node, text, element>[]
  enqueue(): void
}

type ReconcilerOptions<parent, node, text extends node, element extends node> = {
  policy: NodePolicy<parent, node, text, element>
  plugins?: Array<PluginDefinition<any>>
}

type PreparedPlugins = {
  orderedSpecial: PreparedPlugin<any>[]
  orderedTerminal: PreparedPlugin<any>[]
  terminalIds: number[]
  routedSpecialByKey: Map<string, number[]>
  unroutedSpecialIds: number[]
  all: PreparedPlugin<any>[]
}

type PendingHostCommit<parent, node, text extends node, element extends node> = {
  host: CommittedHostNode<parent, node, text, element>
  delta: HostPropDelta
}

type NodeResult<parent, node, text extends node, element extends node> = {
  node: CommittedNode<parent, node, text, element>
  changed: boolean
}

export function createReconciler<parent, node, text extends node, element extends node>(
  options: ReconcilerOptions<parent, node, text, element>,
) {
  let policy = options.policy
  let pluginRootHandle = new EventTarget() as PluginRootHandle
  pluginRootHandle.root = createEmptyRootFacade()
  let plugins = preparePlugins(materializePlugins(options.plugins ?? [], pluginRootHandle))
  let scheduler = createScheduler()
  let nextNodeId = 1
  let candidateMarks = new Uint32Array(Math.max(plugins.all.length, 1))
  let candidateVersion = 1

  return {
    createRoot(container: parent): ReconcilerRoot<RenderValue> {
      let root: RootState<parent, node, text, element> = {
        container,
        api: createEmptyRootFacade(),
        current: [],
        renderValue: null,
        pendingTasks: [],
        renderController: null,
        disposed: false,
        dirtyNodeIds: new Set(),
        hasPendingComponentUpdate: false,
        isFlushing: false,
        pendingHostCommits: [],
        enqueue() {},
      }

      let scheduledRoot = {
        flushWork,
      }
      root.enqueue = () => scheduler.enqueue(scheduledRoot)
      let rootApi = Object.assign(new EventTarget(), {
        render(value: null | RenderValue) {
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
      }) as ReconcilerRoot<RenderValue>
      root.api = rootApi
      pluginRootHandle.root = rootApi
      return rootApi

      function flushWork() {
        if (root.disposed) return
        root.isFlushing = true
        try {
          pluginRootHandle.dispatchEvent(new PluginBeforeCommitEvent(rootApi))
          root.renderController?.abort()
          root.renderController = new AbortController()
          root.dirtyNodeIds.clear()
          root.pendingHostCommits.length = 0

          let nextNodes = normalizeToRenderNodes(root.renderValue)
          let { children } = reconcileChildren(root.container, root.current, nextNodes, root)
          root.current = children
          flushPendingHostCommits(root)
          runPendingTasks(root)
          root.hasPendingComponentUpdate = false
          pluginRootHandle.dispatchEvent(new PluginAfterCommitEvent(rootApi))
        } catch (cause) {
          rootApi.dispatchEvent(new ReconcilerErrorEvent(cause))
        } finally {
          root.isFlushing = false
        }
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

  function flushPendingHostCommits(root: RootState<parent, node, text, element>) {
    for (let commit of root.pendingHostCommits) {
      runHostPlugins(commit.host, commit.delta, root)
    }
    root.pendingHostCommits.length = 0
  }

  function reconcileChildren(
    parentNode: parent | element,
    currentChildren: CommittedNode<parent, node, text, element>[],
    nextNodes: RenderNode[],
    root: RootState<parent, node, text, element>,
  ) {
    let requiresPlacement = false
    let changed = false
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
    let sourceIndices: number[] = []
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
        if (matchIndex !== nextCommitted.length) {
          requiresPlacement = true
          changed = true
        }
        let previousMaterial = firstMaterialNode(currentChildren[matchIndex])
        let reconciled = reconcileNode(
          currentChildren[matchIndex],
          next,
          parentNode,
          root,
        )
        let nextMaterial = firstMaterialNode(reconciled.node)
        if (previousMaterial !== nextMaterial) {
          requiresPlacement = true
          changed = true
        }
        changed = changed || reconciled.changed
        nextCommitted.push(reconciled.node)
        sourceIndices.push(matchIndex)
        continue
      }
      let mounted = mountNode(parentNode, next, root)
      requiresPlacement = true
      changed = true
      nextCommitted.push(mounted.node)
      sourceIndices.push(-1)
    }

    for (let index = 0; index < currentChildren.length; index++) {
      if (used[index]) continue
      requiresPlacement = true
      changed = true
      removeNode(parentNode, currentChildren[index], root)
    }

    if (requiresPlacement) {
      if (canUseMinimalMovePlacement(currentChildren, nextNodes, sourceIndices)) {
        placeChildrenWithMinimalMoves(parentNode, nextCommitted, sourceIndices)
      } else {
        placeChildren(parentNode, nextCommitted)
      }
    }
    return {
      children: nextCommitted,
      changed,
    }
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
  ): NodeResult<parent, node, text, element> {
    if (!isCompatible(current, next)) {
      let mounted = mountNode(parentNode, next, root)
      removeNode(parentNode, current, root)
      return {
        node: mounted.node,
        changed: true,
      }
    }

    if (next.kind === 'text' && current.kind === 'text') {
      let changed = current.value !== next.value
      if (changed) {
        policy.setText(current.node, next.value)
        current.value = next.value
        root.dirtyNodeIds.add(current.id)
      }
      current.key = next.key
      return {
        node: current,
        changed,
      }
    }

    if (next.kind === 'host' && current.kind === 'host') {
      let previousProps = current.props
      let propsChangedKeys = listChangedPropKeys(previousProps, next.props)
      let propsChanged = propsChangedKeys.length > 0
      current.key = next.key
      current.props = next.props
      current.childrenInput = next.children
      if (propsChanged) {
        root.dirtyNodeIds.add(current.id)
        root.pendingHostCommits.push({
          host: current,
          delta: {
            kind: 'update',
            previousProps,
            nextProps: next.props,
            changedKeys: propsChangedKeys,
          },
        })
      }
      let childrenResult = reconcileChildren(
        current.node,
        current.children,
        normalizeToRenderNodes(next.children),
        root,
      )
      current.children = childrenResult.children
      return {
        node: current,
        changed: propsChanged || childrenResult.changed,
      }
    }

    if (next.kind === 'component' && current.kind === 'component') {
      current.key = next.key
      let propsChanged = !shallowEqualProps(current.props, next.props)
      current.props = next.props
      if (!propsChanged && !current.pendingUpdate && !root.hasPendingComponentUpdate) {
        return {
          node: current,
          changed: false,
        }
      }
      current.pendingUpdate = false
      root.dirtyNodeIds.add(current.id)
      let rendered = current.render(current.props)
      let nextChild = normalizeSingle(rendered)
      if (nextChild) {
        if (current.child) {
          let childResult = reconcileNode(current.child, nextChild, parentNode, root)
          current.child = childResult.node
          return {
            node: current,
            changed: propsChanged || childResult.changed,
          }
        } else {
          let mounted = mountNode(parentNode, nextChild, root)
          current.child = mounted.node
          return {
            node: current,
            changed: true,
          }
        }
      } else if (current.child) {
        removeNode(parentNode, current.child, root)
        current.child = null
        return {
          node: current,
          changed: true,
        }
      }
      return {
        node: current,
        changed: propsChanged,
      }
    }

    let mounted = mountNode(parentNode, next, root)
    removeNode(parentNode, current, root)
    return {
      node: mounted.node,
      changed: true,
    }
  }

  function mountNode(
    parentNode: parent | element,
    next: RenderNode,
    root: RootState<parent, node, text, element>,
  ): NodeResult<parent, node, text, element> {
    if (next.kind === 'text') {
      let textNode = policy.createText(next.value)
      let committed: CommittedTextNode<text> = {
        id: nextNodeId++,
        kind: 'text',
        key: next.key,
        node: textNode,
        value: next.value,
      }
      root.dirtyNodeIds.add(committed.id)
      return {
        node: committed,
        changed: true,
      }
    }

    if (next.kind === 'host') {
      policy.prepareHostMount?.(parentNode, {
        type: next.type,
        key: next.key,
        props: next.props,
        children: next.children,
      })
      let node = policy.createElement(parentNode, next.type)
      let committed: CommittedHostNode<parent, node, text, element> = {
        id: nextNodeId++,
        kind: 'host',
        key: next.key,
        type: next.type,
        props: next.props,
        childrenInput: next.children,
        node,
        children: [],
        pluginSlots: [],
        activePluginIds: [],
      }
      let children = normalizeToRenderNodes(next.children)
      let childrenResult = reconcileChildren(node, [], children, root)
      committed.children = childrenResult.children
      root.pendingHostCommits.push({
        host: committed,
        delta: {
          kind: 'mount',
          previousProps: {},
          nextProps: committed.props,
          changedKeys: listOwnPropKeys(committed.props),
        },
      })
      root.dirtyNodeIds.add(committed.id)
      return {
        node: committed,
        changed: true,
      }
    }

    let committed: CommittedComponentNode<parent, node, text, element>
    let handle = createUpdateHandle(root, () => {
      committed.pendingUpdate = true
      root.dirtyNodeIds.add(committed.id)
      root.hasPendingComponentUpdate = true
    })
    let render = next.type(handle, next.setup)
    let childValue = render(next.props)
    committed = {
      id: nextNodeId++,
      kind: 'component',
      key: next.key,
      type: next.type,
      render: render as (props: Record<string, unknown>) => RenderValue,
      props: next.props,
      pendingUpdate: false,
      child: null,
      handle,
    }
    let normalized = normalizeSingle(childValue)
    if (normalized) {
      let mounted = mountNode(parentNode, normalized, root)
      committed.child = mounted.node
    }
    root.dirtyNodeIds.add(committed.id)
    return {
      node: committed,
      changed: true,
    }
  }

  function createUpdateHandle(
    root: RootState<parent, node, text, element>,
    markDirty: () => void,
  ): UpdateHandle {
    return {
      update() {
        return new Promise((resolve) => {
          markDirty()
          root.pendingTasks.push((signal) => resolve(signal))
          root.enqueue()
        })
      },
      queueTask(task) {
        root.pendingTasks.push(task)
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
        if (policy.nextSibling(childNode) !== anchor) {
          policy.move(parentNode, childNode, anchor)
        }
      } else {
        throw new Error('illegal cross-parent placement')
      }
      anchor = childNode
    }
  }

  function placeChildrenWithMinimalMoves(
    parentNode: parent | element,
    children: CommittedNode<parent, node, text, element>[],
    sourceIndices: number[],
  ) {
    let stableIndices = longestIncreasingSubsequenceIndices(sourceIndices)
    let stableMarks = new Uint8Array(children.length)
    for (let index of stableIndices) stableMarks[index] = 1

    let anchor: null | node = null
    for (let index = children.length - 1; index >= 0; index--) {
      let childNode = firstMaterialNode(children[index])
      if (!childNode) continue
      let sourceIndex = sourceIndices[index]
      if (sourceIndex === -1) {
        policy.insert(parentNode, childNode, anchor)
      } else if (!stableMarks[index]) {
        let existingParent = policy.getParent(childNode)
        if (existingParent == null) {
          policy.insert(parentNode, childNode, anchor)
        } else if (existingParent === parentNode) {
          if (policy.nextSibling(childNode) !== anchor) {
            policy.move(parentNode, childNode, anchor)
          }
        } else {
          throw new Error('illegal cross-parent placement')
        }
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
    delta: HostPropDelta,
    root: RootState<parent, node, text, element>,
  ) {
    if (plugins.all.length === 0 && host.activePluginIds.length === 0) return
    if (delta.kind === 'update' && delta.changedKeys.length === 0) return

    let consumed: null | Set<string> = null
    let effectiveDelta: HostPropDelta = {
      kind: delta.kind,
      previousProps: delta.previousProps,
      nextProps: { ...delta.nextProps },
      changedKeys: delta.changedKeys.slice(),
    }
    let phaseRoutedByKey: null | Map<string, number[]> = null
    let phaseCandidateMarks: null | Uint32Array = null
    let phaseCandidateVersion = 0
    let phaseOrdered: null | PreparedPlugin<any>[] = null
    let phaseCursor = -1
    let markKeysForLaterPhasePlugins = (keys: string[]) => {
      if (!phaseRoutedByKey || !phaseCandidateMarks || !phaseOrdered) return
      for (let key of keys) {
        let routed = phaseRoutedByKey.get(key)
        if (!routed) continue
        for (let id of routed) {
          if (!isPhasePluginAhead(phaseOrdered, id, phaseCursor)) continue
          phaseCandidateMarks[id] = phaseCandidateVersion
        }
      }
    }
    let context: PluginHostContext<element> = {
      root: root.api,
      host,
      delta: effectiveDelta,
      mergeProps(props) {
        let mergedKeys: string[] = []
        for (let key in props) {
          let nextValue = props[key]
          if (effectiveDelta.nextProps[key] === nextValue) continue
          effectiveDelta.nextProps[key] = nextValue
          if (!effectiveDelta.changedKeys.includes(key)) {
            effectiveDelta.changedKeys.push(key)
            mergedKeys.push(key)
          }
        }
        markKeysForLaterPhasePlugins(mergedKeys)
      },
      replaceProps(props) {
        effectiveDelta.nextProps = { ...props }
        effectiveDelta.changedKeys = listChangedPropKeys(
          effectiveDelta.previousProps,
          effectiveDelta.nextProps,
        )
        markKeysForLaterPhasePlugins(effectiveDelta.changedKeys)
      },
      consume(key) {
        if (!consumed) consumed = new Set()
        consumed.add(key)
      },
      isConsumed(key) {
        return consumed?.has(key) ?? false
      },
      remainingPropsView() {
        if (!consumed) return effectiveDelta.nextProps
        let output: Record<string, unknown> = {}
        for (let key in effectiveDelta.nextProps) {
          if (consumed?.has(key)) continue
          output[key] = effectiveDelta.nextProps[key]
        }
        return output
      },
    }

    runPluginPhase(
      plugins.orderedSpecial,
      plugins.routedSpecialByKey,
      plugins.unroutedSpecialIds,
      context,
      root,
      {
        setPhaseState(routedByKey, candidateMarks, candidateVersion, ordered, cursor) {
          phaseRoutedByKey = routedByKey
          phaseCandidateMarks = candidateMarks
          phaseCandidateVersion = candidateVersion
          phaseOrdered = ordered
          phaseCursor = cursor
        },
      },
    )
    runPluginPhase(
      plugins.orderedTerminal,
      new Map(),
      plugins.terminalIds,
      context,
      root,
      {
        setPhaseState() {
          phaseRoutedByKey = null
          phaseCandidateMarks = null
          phaseOrdered = null
          phaseCursor = -1
          phaseCandidateVersion = 0
        },
      },
    )
    host.props = effectiveDelta.nextProps
  }

  function teardownHostPlugins(
    host: CommittedHostNode<parent, node, text, element>,
    root: RootState<parent, node, text, element>,
  ) {
    if (host.activePluginIds.length === 0) return
    let context: PluginHostContext<element> = {
      root: root.api,
      host,
      delta: {
        kind: 'update',
        previousProps: host.props,
        nextProps: host.props,
        changedKeys: [],
      },
      mergeProps() {},
      replaceProps() {},
      consume() {},
      isConsumed() {
        return false
      },
      remainingPropsView() {
        return host.props
      },
    }
    let ids = host.activePluginIds.slice()
    for (let pluginId of ids) {
      let prepared = plugins.all[pluginId]
      if (!prepared) continue
      let slot = host.pluginSlots[pluginId]
      if (slot === undefined) continue
      teardownPlugin(prepared.plugin, context, slot)
      host.pluginSlots[pluginId] = undefined
    }
    host.activePluginIds = []
  }

  function runPluginPhase(
    ordered: PreparedPlugin<any>[],
    routedByKey: Map<string, number[]>,
    unroutedIds: number[],
    context: PluginHostContext<element>,
    root: RootState<parent, node, text, element>,
    hooks: {
      setPhaseState(
        routedByKey: Map<string, number[]>,
        candidateMarks: Uint32Array,
        candidateVersion: number,
        ordered: PreparedPlugin<any>[],
        cursor: number,
      ): void
    },
  ) {
    if (ordered.length === 0 && context.host.activePluginIds.length === 0) return
    if (context.delta.kind === 'update' && context.delta.changedKeys.length === 0) return
    if (candidateVersion === 0xffffffff) {
      candidateMarks.fill(0)
      candidateVersion = 1
    } else {
      candidateVersion++
    }
    let usePresenceRouting = context.delta.kind === 'mount'
    if (usePresenceRouting) {
      for (let id of unroutedIds) {
        candidateMarks[id] = candidateVersion
      }
    }
    for (let key of context.delta.changedKeys) {
      let routed = routedByKey.get(key)
      if (!routed) continue
      for (let id of routed) {
        candidateMarks[id] = candidateVersion
      }
    }
    if (usePresenceRouting) {
      for (let [key, routed] of routedByKey) {
        if (!(key in context.delta.nextProps)) continue
        for (let id of routed) {
          candidateMarks[id] = candidateVersion
        }
      }
    }
    for (let id of context.host.activePluginIds) {
      candidateMarks[id] = candidateVersion
    }

    for (let cursor = 0; cursor < ordered.length; cursor++) {
      let prepared = ordered[cursor]
      hooks.setPhaseState(routedByKey, candidateMarks, candidateVersion, ordered, cursor)
      if (candidateMarks[prepared.id] !== candidateVersion) continue
      let plugin = prepared.plugin
      let isActive = context.host.pluginSlots[prepared.id] !== undefined
      let shouldActivate = plugin.shouldActivate?.(context) ?? true
      if (!isActive && !shouldActivate) continue
      if (isActive && !shouldActivate) {
        let previousSlot = context.host.pluginSlots[prepared.id]
        if (previousSlot !== undefined) {
          teardownPlugin(plugin, context, previousSlot)
          context.host.pluginSlots[prepared.id] = undefined
          removeActivePluginId(context.host.activePluginIds, prepared.id)
        }
        continue
      }
      if (!isActive) {
        context.host.pluginSlots[prepared.id] = setupPlugin(plugin, context, root)
        context.host.activePluginIds.push(prepared.id)
      }
      let slot = context.host.pluginSlots[prepared.id]
      if (slot !== undefined) {
        if (isSetupSlot(slot)) {
          slot.handle.dispatchEvent(new PluginCommitEvent(context))
        } else {
          plugin.apply?.(context, slot)
        }
      }
    }
  }

  function setupPlugin(
    plugin: Plugin<any>,
    context: PluginHostContext<element>,
    root: RootState<parent, node, text, element>,
  ) {
    if (plugin.setup) {
      let handle = new EventTarget() as PluginSetupHandle<element>
      handle.root = context.root
      handle.host = context.host
      handle.update = () =>
        new Promise((resolve) => {
          root.hasPendingComponentUpdate = true
          root.dirtyNodeIds.add(context.host.id)
          root.pendingTasks.push((signal) => resolve(signal))
          root.enqueue()
        })
      handle.queueTask = (task) => {
        root.pendingTasks.push((signal) => task(context.host.node, signal))
      }
      plugin.setup(handle)
      return {
        __rmxSetupSlot: true as const,
        handle,
      }
    }
    let mounted = plugin.mount?.(context)
    return mounted === undefined ? null : mounted
  }

}

function preparePlugins(rawPlugins: Array<Plugin<any>>): PreparedPlugins {
  let all: PreparedPlugin<any>[] = []
  for (let index = 0; index < rawPlugins.length; index++) {
    let plugin = rawPlugins[index]
    let prepared: PreparedPlugin<any> = {
      id: index,
      phase: plugin.phase,
      priority: plugin.priority ?? 0,
      routingKeys: plugin.keys ?? [],
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
  let terminalIds = orderedTerminal.map((plugin) => plugin.id)
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
    terminalIds,
    routedSpecialByKey,
    unroutedSpecialIds,
    all,
  }
}

function materializePlugins(
  plugins: Array<PluginDefinition<any>>,
  root: PluginRootHandle,
) {
  let output: Plugin<any>[] = []
  for (let plugin of plugins) {
    if (typeof plugin === 'function') {
      output.push(plugin(root))
      continue
    }
    output.push(plugin)
  }
  return output
}

function createEmptyRootFacade(): ReconcilerRoot<RenderValue> {
  return Object.assign(new EventTarget(), {
    render() {},
    flush() {},
    remove() {},
    dispose() {},
  }) as ReconcilerRoot<RenderValue>
}

function comparePreparedPlugins(a: PreparedPlugin<any>, b: PreparedPlugin<any>) {
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
    let props = value.props
    let host: HostRenderNode = {
      kind: 'host',
      type: value.type,
      key: value.key,
      props,
      children,
    }
    output.push(host)
    return
  }

  if (typeof value.type === 'function') {
    let props = value.props
    let setup = props.setup
    if ('setup' in props) {
      props = { ...props }
      delete props.setup
    }
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

function listOwnPropKeys(props: Record<string, unknown>) {
  let keys: string[] = []
  for (let key in props) {
    if (key === 'children') continue
    keys.push(key)
  }
  return keys
}

function listChangedPropKeys(
  previous: Record<string, unknown>,
  next: Record<string, unknown>,
) {
  if (previous === next) return []
  let changed: string[] = []
  for (let key in next) {
    if (key === 'children') continue
    if (previous[key] !== next[key]) changed.push(key)
  }
  for (let key in previous) {
    if (key === 'children') continue
    if (key in next) continue
    changed.push(key)
  }
  return changed
}

function shallowEqualProps(previous: Record<string, unknown>, next: Record<string, unknown>) {
  if (previous === next) return true
  let previousKeys = (previous as ReconcilerElement & { [RECONCILER_PROP_KEYS]?: string[] })[
    RECONCILER_PROP_KEYS
  ]
  let nextKeys = (next as ReconcilerElement & { [RECONCILER_PROP_KEYS]?: string[] })[
    RECONCILER_PROP_KEYS
  ]
  if (previousKeys && nextKeys) {
    if (previousKeys.length !== nextKeys.length) return false
    for (let index = 0; index < nextKeys.length; index++) {
      let key = nextKeys[index]
      if (previous[key] !== next[key]) return false
    }
    return true
  }
  let size = 0
  for (let key in next) {
    if (key === 'children') continue
    size++
    if (previous[key] !== next[key]) return false
  }
  let previousSize = 0
  for (let key in previous) {
    if (key === 'children') continue
    previousSize++
  }
  return previousSize === size
}

function canUseMinimalMovePlacement<parent, node, text extends node, element extends node>(
  currentChildren: CommittedNode<parent, node, text, element>[],
  nextNodes: RenderNode[],
  sourceIndices: number[],
) {
  if (currentChildren.length !== nextNodes.length) return false
  if (nextNodes.length === 0) return false
  for (let index = 0; index < nextNodes.length; index++) {
    if (nextNodes[index].key == null) return false
    if (sourceIndices[index] < 0) return false
  }
  return true
}

function longestIncreasingSubsequenceIndices(values: number[]) {
  let predecessors = new Int32Array(values.length)
  let tails: number[] = []
  let tailPositions: number[] = []
  for (let index = 0; index < values.length; index++) {
    let value = values[index]
    if (value < 0) continue
    let low = 0
    let high = tails.length
    while (low < high) {
      let mid = (low + high) >> 1
      if (tails[mid] < value) {
        low = mid + 1
      } else {
        high = mid
      }
    }
    if (low > 0) {
      predecessors[index] = tailPositions[low - 1]
    } else {
      predecessors[index] = -1
    }
    if (low === tails.length) {
      tails.push(value)
      tailPositions.push(index)
    } else {
      tails[low] = value
      tailPositions[low] = index
    }
  }
  let output: number[] = []
  if (tailPositions.length === 0) return output
  let cursor = tailPositions[tailPositions.length - 1]
  while (cursor >= 0) {
    output.push(cursor)
    cursor = predecessors[cursor]
  }
  output.reverse()
  return output
}

function isReconcilerElement(value: unknown): value is ReconcilerElement {
  if (!value || typeof value !== 'object') return false
  return (value as { $rmx?: unknown }).$rmx === true
}
