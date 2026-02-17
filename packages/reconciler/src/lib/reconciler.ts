import { ReconcilerErrorEvent } from './types.ts'
import {
  RECONCILER_FRAGMENT,
  RECONCILER_NODE_CHILDREN,
  RECONCILER_PROP_KEYS,
  RECONCILER_PROP_SHAPE,
  isReconcilerElement,
} from '../testing/jsx.ts'
import type {
  Component,
  ComponentInstance,
  CommittedHostNode,
  CommittedNode,
  DeferredRemoval,
  HostPluginPhase,
  HostPluginDispatchPhase,
  HostPluginInstance,
  NodeChild,
  NodeInput,
  NodeRenderNode,
  NodeTransformInput,
  NodePolicy,
  ReconcilerElement,
  SourceIdentityEntry,
  RenderValue,
  RootState,
  UpdateHandle,
} from './types.ts'

type DiffEntry<node, elementNode extends node> = {
  node: CommittedNode<node, elementNode>
  oldIndex: number
}
const EMPTY_NODE_CHILDREN: NodeChild[] = []

export function createReconcilerRuntime<
  parentNode,
  node,
  elementNode extends node & parentNode,
  traversal,
>(nodePolicy: NodePolicy<parentNode, node, node, elementNode, traversal>) {
  let removalRegistry = new Map<string, DeferredRemoval<parentNode, node, elementNode>>()

  function createNode(input: NodeInput): NodeRenderNode {
    return {
      kind: 'node',
      input,
    }
  }

  function reconcileRoot(
    root: RootState<parentNode, node, elementNode, traversal>,
    flushId: number,
  ) {
    let nextRenderable = root.render ? root.render(root.handle) : null
    let nextNodes = toNodeChildren(nextRenderable)

    root.renderController?.abort()
    root.renderController = new AbortController()

    let traversal = root.nodePolicy.begin(root.container)
    root.current = reconcileChildren(root.current, nextNodes, root.container, root, traversal)
    runRootTasks(root, flushId)
  }

  function removeRoot(root: RootState<parentNode, node, elementNode, traversal>) {
    root.renderController?.abort()
    root.renderController = null
    for (let child of root.current) {
      removeNode(child, root.container, root)
    }
    root.current = []
  }

  return {
    createNode,
    reconcileRoot,
    removeRoot,
  }

  function runRootTasks(
    root: RootState<parentNode, node, elementNode, traversal>,
    flushId: number,
  ) {
    if (!root.renderController) return
    let tasks = root.pendingTasks
    root.pendingTasks = []
    for (let task of tasks) {
      try {
        task(root.renderController.signal)
      } catch (error) {
        root.target.dispatchEvent(
          new ReconcilerErrorEvent(error, {
            phase: 'rootTask',
            flushId,
            rootId: root.id,
          }),
        )
      }
    }
  }

  function reconcileChildren(
    currentChildren: CommittedNode<node, elementNode>[],
    nextChildren: NodeChild[],
    parent: parentNode,
    root: RootState<parentNode, node, elementNode, traversal>,
    traversalCursor: traversal,
  ) {
    if (currentChildren.length === 0) {
      let nextCommitted: CommittedNode<node, elementNode>[] = []
      let traversal = traversalCursor
      for (let nextChild of nextChildren) {
        let result = reconcileNode(null, nextChild, parent, root, null, traversal)
        traversal = result.traversal
        if (result.node) nextCommitted.push(result.node)
      }
      return nextCommitted
    }

    let hasKeys = false
    for (let child of nextChildren) {
      if (typeof child !== 'string' && child && toKey(child.input.key) !== '') {
        hasKeys = true
        break
      }
    }

    if (!hasKeys) {
      let max = Math.max(currentChildren.length, nextChildren.length)
      let nextCommitted: CommittedNode<node, elementNode>[] = []
      let traversal = traversalCursor
      for (let index = 0; index < max; index++) {
        let currentChild = currentChildren[index] ?? null
        let nextChild = nextChildren[index] ?? null
        if (!nextChild) {
          if (currentChild) removeNode(currentChild, parent, root)
          continue
        }
        let result = reconcileNode(currentChild, nextChild, parent, root, null, traversal)
        traversal = result.traversal
        if (result.node) nextCommitted.push(result.node)
      }
      return nextCommitted
    }

    return reconcileKeyedChildren(currentChildren, nextChildren, parent, root)
  }

  function reconcileKeyedChildren(
    currentChildren: CommittedNode<node, elementNode>[],
    nextChildren: NodeChild[],
    parent: parentNode,
    root: RootState<parentNode, node, elementNode, traversal>,
  ) {
    let oldKeyMap = new Map<string, number>()
    let oldNodeIndexByAnchor = new Map<node, number>()
    for (let index = 0; index < currentChildren.length; index++) {
      let child = currentChildren[index]
      oldNodeIndexByAnchor.set(getAnchor(child), index)
      if (child.kind !== 'host') continue
      if (child.key === '') continue
      oldKeyMap.set(child.key, index)
    }

    let matchedOld = new Set<number>()
    let entries: DiffEntry<node, elementNode>[] = []
    let traversal = root.nodePolicy.begin(parent)
    for (let index = 0; index < nextChildren.length; index++) {
      let nextChild = nextChildren[index]
      let matchedIndex = -1
      let currentChild: null | CommittedNode<node, elementNode> = null

      if (typeof nextChild !== 'string' && nextChild) {
        let nextKey = toKey(nextChild.input.key)
        if (nextKey !== '') {
          let keyMatch = oldKeyMap.get(nextKey)
          if (keyMatch != null) {
            matchedIndex = keyMatch
            currentChild = currentChildren[keyMatch] ?? null
          }
        }
      }

      if (!currentChild && index < currentChildren.length && !matchedOld.has(index)) {
        let candidate = currentChildren[index]
        if (!isKeyedHost(candidate)) {
          currentChild = candidate
          matchedIndex = index
        }
      }

      if (matchedIndex >= 0) matchedOld.add(matchedIndex)

      let result = reconcileNode(currentChild, nextChild, parent, root, null, traversal)
      traversal = result.traversal
      if (result.node) {
        entries.push({ node: result.node, oldIndex: matchedIndex })
        if (matchedIndex < 0) {
          let reusedIndex = oldNodeIndexByAnchor.get(getAnchor(result.node))
          if (reusedIndex != null) matchedOld.add(reusedIndex)
        }
      }
    }

    for (let index = 0; index < currentChildren.length; index++) {
      if (matchedOld.has(index)) continue
      removeNode(currentChildren[index], parent, root)
    }

    let anchor: null | node = null
    for (let index = entries.length - 1; index >= 0; index--) {
      let entry = entries[index]
      let currentDom = getAnchor(entry.node)
      let actualNext = root.nodePolicy.nextSibling(currentDom)
      if (actualNext !== anchor) {
        placeCommittedNode(parent, entry.node, anchor, root)
      }
      anchor = currentDom
    }

    let nextCommitted: CommittedNode<node, elementNode>[] = []
    for (let entry of entries) {
      nextCommitted.push(entry.node)
    }
    return nextCommitted
  }

  function reconcileNode(
    current: null | CommittedNode<node, elementNode>,
    next: null | NodeChild,
    parent: parentNode,
    root: RootState<parentNode, node, elementNode, traversal>,
    anchor: null | node,
    traversalCursor: traversal,
  ): { node: null | CommittedNode<node, elementNode>; traversal: traversal } {
    if (next == null) {
      if (current) removeNode(current, parent, root)
      return { node: null, traversal: traversalCursor }
    }

    if (typeof next === 'string') {
      return reconcileText(current, next, parent, root, anchor, traversalCursor)
    }

    return reconcileHost(current, next.input, parent, root, anchor, traversalCursor)
  }

  function reconcileText(
    current: null | CommittedNode<node, elementNode>,
    next: string,
    parent: parentNode,
    root: RootState<parentNode, node, elementNode, traversal>,
    anchor: null | node,
    traversalCursor: traversal,
  ): { node: CommittedNode<node, elementNode>; traversal: traversal } {
    if (current && current.kind === 'text') {
      if (current.value !== next) {
        updateTextValue(current.instance, next)
        current.value = next
      }
      return { node: current, traversal: traversalCursor }
    }

    let resolved = root.nodePolicy.resolveText(parent, traversalCursor, next)
    if (current) {
      root.nodePolicy.insert(parent, resolved.node, getAnchor(current))
      removeNode(current, parent, root)
    } else if (anchor != null) {
      root.nodePolicy.insert(parent, resolved.node, anchor)
    } else if (resolved.node !== root.nodePolicy.firstChild(parent)) {
      root.nodePolicy.insert(parent, resolved.node, null)
    }

    return {
      node: { kind: 'text', instance: resolved.node, value: next },
      traversal: resolved.next,
    }
  }

  function reconcileHost(
    current: null | CommittedNode<node, elementNode>,
    input: NodeInput,
    parent: parentNode,
    root: RootState<parentNode, node, elementNode, traversal>,
    anchor: null | node,
    traversalCursor: traversal,
  ): { node: CommittedNode<node, elementNode>; traversal: traversal } {
    let key = toKey(input.key)
    if (current && current.kind === 'host' && current.key === key) {
      let resolvedInput = resolveComponentInput(current.componentInstances, input, root)
      let hostInput = resolvedInput.input
      if (typeof hostInput.type !== 'string') {
        throw new Error('plugins must resolve host type to string')
      }
      if (!isSameSourceIdentity(current.sourceIdentity, resolvedInput.sourceIdentity)) {
        let mountAnchor = root.nodePolicy.nextSibling(getAnchor(current))
        let componentInstances = resolvedInput.componentInstances
        current.componentInstances = []
        removeNode(current, parent, root)
        return mountHost(
          null,
          resolvedInput.input,
          resolvedInput.sourceIdentity,
          key,
          parent,
          root,
          mountAnchor,
          root.nodePolicy.begin(parent),
          componentInstances,
        )
      }
      current.componentInstances = resolvedInput.componentInstances
      if (current.type !== hostInput.type) {
        let componentInstances = current.componentInstances
        current.componentInstances = []
        return mountHost(
          current,
          hostInput,
          resolvedInput.sourceIdentity,
          key,
          parent,
          root,
          anchor,
          traversalCursor,
          componentInstances,
        )
      }
      let preInput = applyPluginsForPhase(current, hostInput, root, 'pre')
      if (preInput.type !== current.type) {
        throw new Error('plugins cannot change host type during patch')
      }
      patchHost(current, preInput, root, root.nodePolicy.enter(current.instance))
      let postInput = applyPluginsForPhase(current, preInput, root, 'post')
      if (postInput.type !== current.type) {
        throw new Error('plugins cannot change host type during patch')
      }
      if (postInput.children !== preInput.children) {
        patchHost(current, postInput, root, root.nodePolicy.enter(current.instance))
      } else {
        current.props = postInput.props
      }
      return { node: current, traversal: traversalCursor }
    }

    return mountHost(
      current,
      input,
      toSourceIdentityEntryList([{ type: input.type, key: input.key }]),
      key,
      parent,
      root,
      anchor,
      traversalCursor,
    )
  }

  function mountHost(
    current: null | CommittedNode<node, elementNode>,
    input: NodeInput,
    sourceIdentity: SourceIdentityEntry[],
    key: string,
    parent: parentNode,
    root: RootState<parentNode, node, elementNode, traversal>,
    anchor: null | node,
    traversalCursor: traversal,
    reusedComponentInstances: ComponentInstance[] = [],
  ): { node: CommittedHostNode<node, elementNode>; traversal: traversal } {
    let probe = createDraftHostNode(key, sourceIdentity)
    let hostInput: NodeInput = input
    let nextSourceIdentity = sourceIdentity
    if (reusedComponentInstances.length > 0) {
      probe.componentInstances = reusedComponentInstances
    } else {
      let resolvedInput = resolveComponentInput(
        probe.componentInstances,
        input,
        root,
        probe.sourceIdentity,
      )
      probe.componentInstances = resolvedInput.componentInstances
      nextSourceIdentity = resolvedInput.sourceIdentity
      probe.sourceIdentity = nextSourceIdentity
      hostInput = resolvedInput.input
    }
    if (typeof hostInput.type !== 'string') {
      throw new Error('plugins must resolve host type to string')
    }
    let hostType = hostInput.type

    let reclaimed = reclaimHost(parent, hostType, key)
    if (reclaimed) {
      reclaimed.sourceIdentity = nextSourceIdentity
      reclaimed.componentInstances = probe.componentInstances
      reclaimed.type = hostType
      let preInput = applyPluginsForPhase(reclaimed, hostInput, root, 'pre')
      if (preInput.type !== hostType) {
        throw new Error('plugins cannot change host type during mount')
      }
      patchHost(reclaimed, preInput, root, root.nodePolicy.enter(reclaimed.instance))
      let postInput = applyPluginsForPhase(reclaimed, preInput, root, 'post')
      if (postInput.type !== hostType) {
        throw new Error('plugins cannot change host type during mount')
      }
      if (postInput.children !== preInput.children) {
        patchHost(reclaimed, postInput, root, root.nodePolicy.enter(reclaimed.instance))
      } else {
        reclaimed.props = postInput.props
      }
      let mountAnchor = current ? getAnchor(current) : anchor
      if (mountAnchor != null) {
        root.nodePolicy.move(parent, reclaimed.instance, mountAnchor)
      } else {
        root.nodePolicy.move(parent, reclaimed.instance, null)
      }
      if (current) removeNode(current, parent, root)
      return { node: reclaimed, traversal: traversalCursor }
    }

    let resolved = root.nodePolicy.resolveElement(parent, traversalCursor, hostType)
    let hostNode = probe
    hostNode.sourceIdentity = nextSourceIdentity
    hostNode.type = hostType
    hostNode.instance = resolved.node
    let preInput = applyPluginsForPhase(hostNode, hostInput, root, 'pre')
    if (preInput.type !== hostType) {
      throw new Error('plugins cannot change host type during mount')
    }
    patchHost(hostNode, preInput, root, root.nodePolicy.enter(hostNode.instance))
    let postInput = applyPluginsForPhase(hostNode, preInput, root, 'post')
    if (postInput.type !== hostType) {
      throw new Error('plugins cannot change host type during mount')
    }
    if (postInput.children !== preInput.children) {
      patchHost(hostNode, postInput, root, root.nodePolicy.enter(hostNode.instance))
    } else {
      hostNode.props = postInput.props
    }

    let mountAnchor = current ? getAnchor(current) : anchor
    if (mountAnchor != null) {
      root.nodePolicy.insert(parent, hostNode.instance, mountAnchor)
    } else if (root.nodePolicy.firstChild(parent) !== hostNode.instance) {
      root.nodePolicy.insert(parent, hostNode.instance, null)
    }
    if (current) removeNode(current, parent, root)

    return { node: hostNode, traversal: resolved.next }
  }

  function patchHost(
    node: CommittedHostNode<node, elementNode>,
    input: NodeInput,
    root: RootState<parentNode, node, elementNode, traversal>,
    traversalCursor: traversal,
  ) {
    node.props = input.props
    let nextChildren = input.children
    node.children = reconcileChildren(
      node.children,
      nextChildren,
      node.instance as unknown as parentNode,
      root,
      traversalCursor,
    )
  }

  function createDraftHostNode(
    key: string,
    sourceIdentity: SourceIdentityEntry[],
  ): CommittedHostNode<node, elementNode> {
    return {
      kind: 'host',
      type: '',
      sourceIdentity,
      key,
      props: {},
      instance: null as never as elementNode,
      children: [],
      componentInstances: [],
      pluginInstances: null,
      pluginSeenMarks: null,
      pluginSeenEpoch: 0,
      pluginActivePre: null,
      pluginActivePost: null,
    }
  }

  function removeNode(
    current: CommittedNode<node, elementNode>,
    parent: parentNode,
    root: RootState<parentNode, node, elementNode, traversal>,
  ) {
    if (current.kind === 'text') {
      root.nodePolicy.remove(parent, current.instance)
      return
    }

    let pendingRemoval: Promise<void>[] = []
    deactivateHostPlugins(current, pendingRemoval, root, 'unmount')
    if (pendingRemoval.length > 0) {
      let done =
        pendingRemoval.length === 1
          ? pendingRemoval[0]
          : Promise.all(pendingRemoval).then(() => undefined)
      deferRemoval(current, parent, root, done)
      return
    }
    disposeComponentInstances(current.componentInstances)
    root.nodePolicy.remove(parent, current.instance)
  }

  function deferRemoval(
    node: CommittedHostNode<node, elementNode>,
    parent: parentNode,
    root: RootState<parentNode, node, elementNode, traversal>,
    done: Promise<void>,
  ) {
    let key = node.key
    let registryKey = removalKey(node.type, key)
    let deferred: DeferredRemoval<parentNode, node, elementNode> = {
      key,
      type: node.type,
      parent,
      node,
      settled: false,
      reclaimed: false,
    }
    if (key !== '') {
      removalRegistry.set(registryKey, deferred)
    }

    done
      .catch(() => {})
      .then(() => {
        deferred.settled = true
        if (!deferred.reclaimed) {
          disposeComponentInstances(deferred.node.componentInstances)
          root.nodePolicy.remove(parent, deferred.node.instance)
        }
        if (key !== '') {
          removalRegistry.delete(registryKey)
        }
      })
  }

  function reclaimHost(
    parent: parentNode,
    type: string,
    key: string,
  ): null | CommittedHostNode<node, elementNode> {
    if (key === '') return null
    let deferred = removalRegistry.get(removalKey(type, key))
    if (!deferred) return null
    if (deferred.parent !== parent || deferred.settled) return null
    deferred.reclaimed = true
    removalRegistry.delete(removalKey(type, key))
    return deferred.node
  }

  function applyPluginsForPhase(
    node: CommittedHostNode<node, elementNode>,
    input: NodeInput,
    root: RootState<parentNode, node, elementNode, traversal>,
    phase: HostPluginPhase,
  ): NodeInput {
    if (root.hostPlugins.length === 0) return input

    let dispatch = phase === 'post' ? root.hostPluginDispatch.post : root.hostPluginDispatch.pre
    let transformedInput: NodeTransformInput = input as unknown as NodeTransformInput
    let nextChildren = input.children
    let candidates = resolveDispatchCandidates(dispatch, input, transformedInput.props)
    let seenMarks = node.pluginSeenMarks
    if (!seenMarks || seenMarks.length !== root.hostPlugins.length) {
      seenMarks = createSeenMarks(root.hostPlugins.length)
      node.pluginSeenMarks = seenMarks
      node.pluginSeenEpoch = 0
    }
    let seenEpoch = node.pluginSeenEpoch + 1
    if (seenEpoch >= Number.MAX_SAFE_INTEGER) {
      clearSeenMarks(seenMarks)
      seenEpoch = 1
    }
    node.pluginSeenEpoch = seenEpoch
    for (let index of candidates) {
      seenMarks[index] = seenEpoch
    }

    let active = phase === 'post' ? node.pluginActivePost : node.pluginActivePre
    if (!active) {
      active = []
      if (phase === 'post') node.pluginActivePost = active
      else node.pluginActivePre = active
    }
    for (let index = 0; index < active.length; index++) {
      let pluginIndex = active[index]
      if (seenMarks[pluginIndex] === seenEpoch) continue
      let instance = node.pluginInstances?.[pluginIndex]
      if (!instance) continue
      deactivatePluginInstance(instance, node, root, 'deactivate')
      if (node.pluginInstances) node.pluginInstances[pluginIndex] = null
    }
    active.length = 0

    for (let pluginIndex of candidates) {
      let hostPlugin = root.hostPlugins[pluginIndex]
      let instance = node.pluginInstances?.[pluginIndex] ?? null
      if (!instance) {
        try {
          instance = hostPlugin.setup()
          if (!node.pluginInstances) {
            node.pluginInstances = createPluginInstanceSlots(root.hostPlugins.length)
          }
          node.pluginInstances[pluginIndex] = instance
        } catch (error) {
          reportPluginError(root, node, error)
          continue
        }
      }

      try {
        instance.commit(transformedInput, node.instance)
        active.push(pluginIndex)
      } catch (error) {
        reportPluginError(root, node, error)
      }
    }

    if ('children' in transformedInput.props) {
      nextChildren = toNodeChildren(transformedInput.props.children)
      delete transformedInput.props.children
    }

    if (transformedInput.type === input.type && nextChildren === input.children) {
      return input
    }

    return {
      key: input.key,
      type: transformedInput.type,
      props: transformedInput.props,
      children: nextChildren,
      propKeys: input.propKeys,
      propShape: input.propShape,
    }
  }

  function deactivateHostPlugins(
    node: CommittedHostNode<node, elementNode>,
    pending: Promise<void>[],
    root: RootState<parentNode, node, elementNode, traversal>,
    reason: 'deactivate' | 'unmount',
  ) {
    if (node.pluginInstances) {
      for (let index = 0; index < node.pluginInstances.length; index++) {
        let instance = node.pluginInstances[index]
        if (!instance) continue
        let waited = deactivatePluginInstance(instance, node, root, reason)
        if (waited) pending.push(waited)
        node.pluginInstances[index] = null
      }
    }
    if (node.pluginActivePre) node.pluginActivePre.length = 0
    if (node.pluginActivePost) node.pluginActivePost.length = 0
  }

  function deactivatePluginInstance(
    instance: HostPluginInstance<elementNode>,
    node: CommittedHostNode<node, elementNode>,
    root: RootState<parentNode, node, elementNode, traversal>,
    reason: 'deactivate' | 'unmount',
  ) {
    try {
      let pending = instance.remove(node.instance, reason)
      if (pending && typeof pending.then === 'function') {
        return pending.then(() => undefined).catch(() => undefined)
      }
    } catch (error) {
      reportPluginError(root, node, error)
    }
    return null
  }

  function reportPluginError(
    root: RootState<parentNode, node, elementNode, traversal>,
    node: CommittedHostNode<node, elementNode>,
    error: unknown,
  ) {
    root.target.dispatchEvent(
      new ReconcilerErrorEvent(error, {
        phase: 'plugin',
        rootId: root.id,
        nodeKey: node.key,
      }),
    )
  }

}

type ResolveComponentResult = {
  input: NodeInput
  sourceIdentity: SourceIdentityEntry[]
  componentInstances: ComponentInstance[]
}

function resolveComponentInput<parentNode, node, elementNode extends node & parentNode, traversal>(
  currentInstances: ComponentInstance[],
  input: NodeInput,
  root: RootState<parentNode, node, elementNode, traversal>,
  sourceIdentityBuffer?: SourceIdentityEntry[],
): ResolveComponentResult {
  if (typeof input.type !== 'function') {
    disposeComponentInstances(currentInstances)
    let sourceIdentity = sourceIdentityBuffer ?? []
    sourceIdentity.length = 1
    writeSourceIdentityEntry(sourceIdentity, 0, input.type, input.key)
    return {
      input,
      sourceIdentity,
      componentInstances: [],
    }
  }

  let instances = currentInstances
  let sourceIdentity: SourceIdentityEntry[] = sourceIdentityBuffer ?? []
  sourceIdentity.length = 0
  let resolvedType: unknown = input.type
  let resolvedProps = input.props
  let resolvedKey: unknown = input.key
  let depth = 0

  while (typeof resolvedType === 'function') {
    writeSourceIdentityEntry(sourceIdentity, depth, resolvedType, resolvedKey)
    let nextInput = splitSetupProps(resolvedProps)
    let key = toKey(resolvedKey)
    let instance = instances[depth]
    if (!instance || instance.type !== resolvedType || instance.key !== key) {
      if (instance) {
        disposeComponentInstance(instance)
      }
      let controller = new AbortController()
      let handle = createComponentHandle(root, controller)
      let render = (resolvedType as Component<unknown, Record<string, unknown>>)(
        handle,
        nextInput.setup,
      )
      if (typeof render !== 'function') {
        throw new Error('component factory must return a render function')
      }
      instance = {
        type: resolvedType,
        key,
        render,
        handle,
        controller,
      }
      instances[depth] = instance
    }

    let next = instance.render(nextInput.props)
    if (!isElementRecord(next)) {
      throw new Error('component render must return a JSX element')
    }
    resolvedType = next.type
    resolvedProps = next.props
    resolvedKey = next.key
    depth++
  }

  for (let index = depth; index < instances.length; index++) {
    let stale = instances[index]
    if (stale) disposeComponentInstance(stale)
  }
  instances.length = depth

  let { props: nextProps, children: rawChildren } = splitChildrenProps(resolvedProps)
  writeSourceIdentityEntry(sourceIdentity, depth, resolvedType, resolvedKey)
  sourceIdentity.length = depth + 1

  return {
    input: toNodeInput(resolvedType, resolvedKey, nextProps, rawChildren),
    sourceIdentity,
    componentInstances: instances,
  }
}

function createComponentHandle<parentNode, node, elementNode extends node & parentNode, traversal>(
  root: RootState<parentNode, node, elementNode, traversal>,
  controller: AbortController,
): UpdateHandle {
  return {
    update() {
      return new Promise<AbortSignal>((resolve) => {
        if (root.disposed || controller.signal.aborted) {
          let aborted = new AbortController()
          aborted.abort()
          resolve(aborted.signal)
          return
        }
        root.pendingTasks.push((signal) => resolve(signal))
        root.enqueue()
      })
    },
    queueTask(task) {
      if (root.disposed || controller.signal.aborted) return
      root.pendingTasks.push(task)
      root.enqueue()
    },
    get signal() {
      return controller.signal
    },
  }
}

function splitSetupProps(props: Record<string, unknown>) {
  if (!('setup' in props)) {
    return {
      setup: undefined,
      props,
    }
  }
  let setup = props.setup
  let nextProps: Record<string, unknown> = {}
  for (let key in props) {
    if (key === 'setup') continue
    nextProps[key] = props[key]
  }
  return {
    setup,
    props: nextProps,
  }
}

function splitChildrenProps(props: Record<string, unknown>) {
  if (!('children' in props)) {
    return {
      props,
      children: undefined as unknown,
    }
  }
  let children = props.children
  let nextProps: Record<string, unknown> = {}
  for (let key in props) {
    if (key === 'children') continue
    nextProps[key] = props[key]
  }
  return {
    props: nextProps,
    children,
  }
}

function disposeComponentInstances(instances: ComponentInstance[]) {
  for (let instance of instances) {
    disposeComponentInstance(instance)
  }
  instances.length = 0
}

function disposeComponentInstance(instance: ComponentInstance) {
  instance.controller.abort()
}

function isSameSourceIdentity(previous: SourceIdentityEntry[], next: SourceIdentityEntry[]) {
  if (previous.length !== next.length) return false
  for (let index = 0; index < previous.length; index++) {
    let previousEntry = previous[index]
    let nextEntry = next[index]
    if (previousEntry?.type !== nextEntry?.type) return false
    if (previousEntry?.key !== nextEntry?.key) return false
  }
  return true
}

function toSourceIdentityEntry(type: unknown, key: unknown): SourceIdentityEntry {
  return {
    type,
    key: toKey(key),
  }
}

function toSourceIdentityEntryList(
  entries: Array<{ type: unknown; key: unknown }>,
): SourceIdentityEntry[] {
  return entries.map((entry) => toSourceIdentityEntry(entry.type, entry.key))
}

function isElementRecord(value: unknown): value is ReconcilerElement {
  if (!value || typeof value !== 'object') return false
  let record = value as { $rmx?: unknown; type?: unknown; props?: unknown }
  if (record.$rmx !== true) return false
  return 'type' in record && !!record.props && typeof record.props === 'object'
}

function placeCommittedNode<parentNode, node, elementNode extends node & parentNode, traversal>(
  parent: parentNode,
  nodeValue: CommittedNode<node, elementNode>,
  anchor: null | node,
  root: RootState<parentNode, node, elementNode, traversal>,
) {
  let instance = getAnchor(nodeValue)
  root.nodePolicy.move(parent, instance, anchor)
}

function getAnchor<node, elementNode extends node>(node: CommittedNode<node, elementNode>) {
  return node.kind === 'host' ? node.instance : node.instance
}

function toKey(value: unknown) {
  if (value == null) return ''
  return String(value)
}

function removalKey(type: string, key: string) {
  return `${type}::${key}`
}

function createPluginInstanceSlots<elementNode>(size: number): Array<null | HostPluginInstance<elementNode>> {
  let slots: Array<null | HostPluginInstance<elementNode>> = []
  for (let index = 0; index < size; index++) {
    slots.push(null)
  }
  return slots
}

function createSeenMarks(size: number): number[] {
  let marks: number[] = []
  for (let index = 0; index < size; index++) {
    marks.push(0)
  }
  return marks
}

function clearSeenMarks(marks: number[]) {
  for (let index = 0; index < marks.length; index++) {
    marks[index] = 0
  }
}

function resolveDispatchCandidates(
  dispatch: HostPluginDispatchPhase,
  input: NodeInput,
  props: Record<string, unknown>,
): number[] {
  let propKeys = input.propKeys ?? toPropKeys(props)
  if (!input.propKeys) {
    input.propKeys = propKeys
  }
  let shape = input.propShape ?? toPropShape(propKeys)
  if (!input.propShape) {
    input.propShape = shape
  }
  let cached = dispatch.byShape.get(shape)
  if (cached) return cached

  let seenEpoch = dispatch.seenEpoch + 1
  if (seenEpoch >= Number.MAX_SAFE_INTEGER) {
    clearSeenMarks(dispatch.seenMarks)
    seenEpoch = 1
  }
  dispatch.seenEpoch = seenEpoch

  let seenMarks = dispatch.seenMarks
  for (let key of propKeys) {
    let keyed = dispatch.keyed.get(key)
    if (!keyed) continue
    for (let index of keyed) {
      seenMarks[index] = seenEpoch
    }
  }
  for (let index of dispatch.wildcard) {
    seenMarks[index] = seenEpoch
  }

  let resolved: number[] = []
  for (let index = 0; index < seenMarks.length; index++) {
    if (seenMarks[index] === seenEpoch) resolved.push(index)
  }
  dispatch.byShape.set(shape, resolved)
  return resolved
}

function toPropKeys(props: Record<string, unknown>): string[] {
  let keys: string[] = []
  for (let key in props) {
    keys.push(key)
  }
  return keys
}

function toPropShape(keys: string[]) {
  if (keys.length === 0) return ''
  return keys.join('\u0001')
}


function isKeyedHost<node, elementNode extends node>(node: CommittedNode<node, elementNode>) {
  return node.kind === 'host' && node.key !== ''
}

function toNodeChildren(children: unknown): NodeChild[] {
  if (children == null || typeof children === 'boolean') return EMPTY_NODE_CHILDREN
  if (typeof children === 'string') return [children]
  if (typeof children === 'number' || typeof children === 'bigint') return [String(children)]
  let output: NodeChild[] = []
  toNodeChildrenInto(children as RenderValue, output)
  return output.length === 0 ? EMPTY_NODE_CHILDREN : output
}

function toNodeChildrenInto(children: RenderValue, output: NodeChild[]) {
  if (children == null) return
  if (typeof children === 'boolean') return
  if (typeof children === 'number' || typeof children === 'bigint') {
    output.push(String(children))
    return
  }
  if (typeof children === 'string') {
    output.push(children)
    return
  }
  if (Array.isArray(children)) {
    for (let child of children) {
      toNodeChildrenInto(child, output)
    }
    return
  }
  if (typeof children === 'object' && children && 'kind' in children) {
    let direct = children as { kind?: unknown; input?: NodeInput; value?: string }
    if (direct.kind === 'node' && direct.input) {
      output.push(children as unknown as NodeChild)
      return
    }
    if (direct.kind === 'text' && typeof direct.value === 'string') {
      output.push(direct.value)
      return
    }
  }
  if (!isReconcilerElement(children)) return
  if (children.type === RECONCILER_FRAGMENT) {
    let cachedFragmentChildren = (children as ReconcilerElement & { [RECONCILER_NODE_CHILDREN]?: NodeChild[] })[
      RECONCILER_NODE_CHILDREN
    ]
    if (cachedFragmentChildren) {
      for (let child of cachedFragmentChildren) {
        output.push(child)
      }
      return
    }
    toNodeChildrenInto(children.props.children as RenderValue, output)
    return
  }
  let sourceProps = (children.props ?? {}) as Record<string, unknown>
  let { props, children: rawChildren } = splitChildrenProps(sourceProps)
  let cached = children as ReconcilerElement & {
    [RECONCILER_NODE_CHILDREN]?: NodeChild[]
    [RECONCILER_PROP_KEYS]?: string[]
    [RECONCILER_PROP_SHAPE]?: string
  }
  let cachedChildren = cached[RECONCILER_NODE_CHILDREN]
  output.push({
    kind: 'node',
    input: {
      type: children.type,
      key: children.key,
      props,
      children: cachedChildren ?? toNodeChildren(rawChildren),
      propKeys: cached[RECONCILER_PROP_KEYS],
      propShape: cached[RECONCILER_PROP_SHAPE],
    },
  })
}

function toNodeInput(
  type: unknown,
  key: unknown,
  props: Record<string, unknown>,
  rawChildren: unknown,
): NodeInput {
  let children: NodeChild[] = []
  toNodeChildrenInto(rawChildren as RenderValue, children)
  let propKeys = toPropKeys(props)
  return {
    type,
    key,
    props,
    children: children.length === 0 ? EMPTY_NODE_CHILDREN : children,
    propKeys,
    propShape: toPropShape(propKeys),
  }
}

function writeSourceIdentityEntry(
  output: SourceIdentityEntry[],
  index: number,
  type: unknown,
  key: unknown,
) {
  let nextType = type
  let nextKey = toKey(key)
  let current = output[index]
  if (current) {
    current.type = nextType
    current.key = nextKey
    return
  }
  output[index] = { type: nextType, key: nextKey }
}

function updateTextValue(node: unknown, value: string) {
  if (node && typeof node === 'object' && 'value' in (node as Record<string, unknown>)) {
    ;(node as { value: string }).value = value
    return
  }
  if (node && typeof node === 'object' && 'data' in (node as Record<string, unknown>)) {
    ;(node as { data: string }).data = value
  }
}
