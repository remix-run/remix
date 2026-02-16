import { HostInsertEvent, HostRemoveEvent, ReconcilerErrorEvent } from './types.ts'
import { RECONCILER_FRAGMENT, isReconcilerElement } from '../testing/jsx.ts'
import { GuardedEventTarget } from './event-target.ts'
import type {
  Component,
  ComponentInstance,
  CommittedHostNode,
  CommittedNode,
  DeferredRemoval,
  NodeChild,
  HostFactory,
  HostHandle,
  NodeInput,
  NodeRenderNode,
  HostTask,
  NodeTransformInput,
  NodePolicy,
  ReconcilerElement,
  SourceIdentityEntry,
  RenderNode,
  RenderValue,
  RootState,
  UpdateHandle,
} from './types.ts'

type DiffEntry<node, elementNode extends node> = {
  node: CommittedNode<node, elementNode>
  oldIndex: number
}

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
    let nextNodes = normalizeRenderNodes(nextRenderable)

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
    nextChildren: RenderNode[],
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
      if (child.kind === 'node' && toKey(child.input.key) !== '') {
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
    nextChildren: RenderNode[],
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

      if (nextChild.kind === 'node') {
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
    next: null | RenderNode,
    parent: parentNode,
    root: RootState<parentNode, node, elementNode, traversal>,
    anchor: null | node,
    traversalCursor: traversal,
  ): { node: null | CommittedNode<node, elementNode>; traversal: traversal } {
    if (!next) {
      if (current) removeNode(current, parent, root)
      return { node: null, traversal: traversalCursor }
    }

    if (next.kind === 'text') {
      return reconcileText(current, next, parent, root, anchor, traversalCursor)
    }

    return reconcileHost(current, next.input, parent, root, anchor, traversalCursor)
  }

  function reconcileText(
    current: null | CommittedNode<node, elementNode>,
    next: { kind: 'text'; value: string },
    parent: parentNode,
    root: RootState<parentNode, node, elementNode, traversal>,
    anchor: null | node,
    traversalCursor: traversal,
  ): { node: CommittedNode<node, elementNode>; traversal: traversal } {
    if (current && current.kind === 'text') {
      if (current.value !== next.value) {
        updateTextValue(current.instance, next.value)
        current.value = next.value
      }
      return { node: current, traversal: traversalCursor }
    }

    let resolved = root.nodePolicy.resolveText(parent, traversalCursor, next.value)
    if (current) {
      root.nodePolicy.insert(parent, resolved.node, getAnchor(current))
      removeNode(current, parent, root)
    } else if (anchor != null) {
      root.nodePolicy.insert(parent, resolved.node, anchor)
    } else if (resolved.node !== root.nodePolicy.firstChild(parent)) {
      root.nodePolicy.insert(parent, resolved.node, null)
    }

    return {
      node: { kind: 'text', instance: resolved.node, value: next.value },
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
      let transformedInput = applyTransforms(current, resolvedInput.input)
      if (typeof transformedInput.type !== 'string') {
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
      if (current.type !== transformedInput.type) {
        let componentInstances = current.componentInstances
        current.componentInstances = []
        return mountHost(
          current,
          resolvedInput.input,
          resolvedInput.sourceIdentity,
          key,
          parent,
          root,
          anchor,
          traversalCursor,
          componentInstances,
        )
      }
      patchHost(current, transformedInput, root, root.nodePolicy.enter(current.instance))
      runHostTasks(current, root)
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
    initializeHostPlugins(probe, root.hostFactories, root)
    let transformedInput: NodeInput
    let nextSourceIdentity = sourceIdentity
    if (reusedComponentInstances.length > 0) {
      probe.componentInstances = reusedComponentInstances
      transformedInput = applyTransforms(probe, input)
    } else {
      let resolvedInput = resolveComponentInput(probe.componentInstances, input, root)
      probe.componentInstances = resolvedInput.componentInstances
      nextSourceIdentity = resolvedInput.sourceIdentity
      probe.sourceIdentity = nextSourceIdentity
      transformedInput = applyTransforms(probe, resolvedInput.input)
    }
    if (typeof transformedInput.type !== 'string') {
      throw new Error('plugins must resolve host type to string')
    }

    let reclaimed = reclaimHost(parent, transformedInput.type, key)
    if (reclaimed) {
      reclaimed.sourceIdentity = nextSourceIdentity
      reclaimed.hostHandles = probe.hostHandles
      reclaimed.transforms = probe.transforms
      reclaimed.pendingTasks = probe.pendingTasks
      reclaimed.componentInstances = probe.componentInstances
      patchHost(reclaimed, transformedInput, root, root.nodePolicy.enter(reclaimed.instance))
      let mountAnchor = current ? getAnchor(current) : anchor
      if (mountAnchor != null) {
        root.nodePolicy.move(parent, reclaimed.instance, mountAnchor)
      } else {
        root.nodePolicy.move(parent, reclaimed.instance, null)
      }
      if (current) removeNode(current, parent, root)
      dispatchHostInsert(reclaimed, transformedInput, root)
      runHostTasks(reclaimed, root)
      return { node: reclaimed, traversal: traversalCursor }
    }

    let resolved = root.nodePolicy.resolveElement(parent, traversalCursor, transformedInput.type)
    let hostNode = probe
    hostNode.sourceIdentity = nextSourceIdentity
    hostNode.type = transformedInput.type
    hostNode.instance = resolved.node
    patchHost(hostNode, transformedInput, root, root.nodePolicy.enter(hostNode.instance))

    let mountAnchor = current ? getAnchor(current) : anchor
    if (mountAnchor != null) {
      root.nodePolicy.insert(parent, hostNode.instance, mountAnchor)
    } else if (root.nodePolicy.firstChild(parent) !== hostNode.instance) {
      root.nodePolicy.insert(parent, hostNode.instance, null)
    }
    if (current) removeNode(current, parent, root)

    dispatchHostInsert(hostNode, transformedInput, root)
    runHostTasks(hostNode, root)
    return { node: hostNode, traversal: resolved.next }
  }

  function patchHost(
    node: CommittedHostNode<node, elementNode>,
    input: NodeInput,
    root: RootState<parentNode, node, elementNode, traversal>,
    traversalCursor: traversal,
  ) {
    node.props = input.props
    let nextChildren = normalizeNodeChildren(input.children)
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
      hostHandles: [],
      transforms: [],
      pendingTasks: [],
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
    dispatchHostRemove(current, pendingRemoval, root)
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

  function initializeHostPlugins(
    node: CommittedHostNode<node, elementNode>,
    factories: HostFactory<elementNode>[],
    root: RootState<parentNode, node, elementNode, traversal>,
  ) {
    node.hostHandles = []
    node.transforms = []
    node.pendingTasks = []
    for (let createHostFactory of factories) {
      let hostTarget = new GuardedEventTarget((error) => {
        root.target.dispatchEvent(
          new ReconcilerErrorEvent(error, {
            phase: 'plugin',
            rootId: root.id,
            nodeKey: node.key,
          }),
        )
      })
      let connected = new AbortController()
      hostTarget.addEventListener('remove', () => connected.abort())
      let hostHandle = Object.assign(hostTarget, {
        queueTask(task: HostTask<elementNode>) {
          node.pendingTasks.push(task)
        },
        update() {
          return new Promise<AbortSignal>((resolve) => {
            root.pendingTasks.push((signal) => resolve(signal))
            root.enqueue()
          })
        },
        get signal() {
          return connected.signal
        },
      }) as HostHandle<elementNode>
      let transform = createHostFactory(hostHandle)
      node.hostHandles.push(hostHandle)
      if (transform) node.transforms.push(transform)
    }
  }

  function applyTransforms(
    node: CommittedHostNode<node, elementNode>,
    input: NodeInput,
  ): NodeInput {
    let transformedInput: NodeTransformInput = {
      type: input.type,
      props: { ...input.props },
    }
    let nextChildren = input.children
    for (let transform of node.transforms) {
      transformedInput = transform(transformedInput)
      if ('children' in transformedInput.props) {
        nextChildren = toNodeChildren(transformedInput.props.children)
        delete transformedInput.props.children
      }
    }
    return {
      ...input,
      type: transformedInput.type,
      props: transformedInput.props,
      children: nextChildren,
    }
  }

  function dispatchHostRemove(
    node: CommittedHostNode<node, elementNode>,
    pending: Promise<void>[],
    root: RootState<parentNode, node, elementNode, traversal>,
  ) {
    for (let hostHandle of node.hostHandles) {
      try {
        let event = new HostRemoveEvent(node.instance, (promise) => {
          pending.push(promise.catch(() => undefined))
        })
        hostHandle.dispatchEvent(event)
      } catch (error) {
        root.target.dispatchEvent(
          new ReconcilerErrorEvent(error, {
            phase: 'plugin',
            rootId: root.id,
            nodeKey: node.key,
          }),
        )
      }
    }
  }

  function dispatchHostInsert(
    node: CommittedHostNode<node, elementNode>,
    input: NodeInput,
    root: RootState<parentNode, node, elementNode, traversal>,
  ) {
    let transformedInput: NodeTransformInput = {
      type: input.type,
      props: input.props,
    }
    for (let hostHandle of node.hostHandles) {
      try {
        let event = new HostInsertEvent(
          transformedInput,
          node.instance,
          root.renderController!.signal,
        )
        hostHandle.dispatchEvent(event)
      } catch (error) {
        root.target.dispatchEvent(
          new ReconcilerErrorEvent(error, {
            phase: 'plugin',
            rootId: root.id,
            nodeKey: node.key,
          }),
        )
      }
    }
  }

  function runHostTasks(
    node: CommittedHostNode<node, elementNode>,
    root: RootState<parentNode, node, elementNode, traversal>,
  ) {
    let signal = root.renderController?.signal
    if (!signal) return
    let tasks = node.pendingTasks.slice()
    node.pendingTasks.length = 0
    for (let task of tasks) {
      try {
        task(node.instance, signal)
      } catch (error) {
        root.target.dispatchEvent(
          new ReconcilerErrorEvent(error, {
            phase: 'hostTask',
            rootId: root.id,
            nodeKey: node.key,
          }),
        )
      }
    }
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
): ResolveComponentResult {
  if (typeof input.type !== 'function') {
    disposeComponentInstances(currentInstances)
    return {
      input,
      sourceIdentity: toSourceIdentityEntryList([{ type: input.type, key: input.key }]),
      componentInstances: [],
    }
  }

  let instances = currentInstances.slice()
  let sourceIdentity: SourceIdentityEntry[] = []
  let resolvedType: unknown = input.type
  let resolvedProps = input.props
  let resolvedKey: unknown = input.key
  let depth = 0

  while (typeof resolvedType === 'function') {
    sourceIdentity.push(toSourceIdentityEntry(resolvedType, resolvedKey))
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

  let nextProps = { ...resolvedProps }
  let rawChildren = nextProps.children
  delete nextProps.children
  sourceIdentity.push(toSourceIdentityEntry(resolvedType, resolvedKey))

  return {
    input: {
      ...input,
      type: resolvedType,
      key: resolvedKey,
      props: nextProps,
      children: toNodeChildren(rawChildren),
    },
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
  let { setup, ...nextProps } = props
  return {
    setup,
    props: nextProps,
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

function isKeyedHost<node, elementNode extends node>(node: CommittedNode<node, elementNode>) {
  return node.kind === 'host' && node.key !== ''
}

function normalizeRenderNodes(value: RenderValue): RenderNode[] {
  let normalized: RenderNode[] = []
  normalizeInto(value, normalized)
  return normalized
}

function normalizeInto(value: RenderValue, normalized: RenderNode[]) {
  if (value == null) return
  if (typeof value === 'boolean') return
  if (typeof value === 'number' || typeof value === 'bigint') {
    normalized.push({ kind: 'text', value: String(value) })
    return
  }
  if (typeof value === 'string') {
    normalized.push({ kind: 'text', value })
    return
  }
  if (Array.isArray(value)) {
    for (let item of value) {
      normalizeInto(item, normalized)
    }
    return
  }
  if (typeof value === 'object' && value && 'kind' in value) {
    let direct = value as { kind?: unknown; input?: NodeInput; value?: string }
    if (direct.kind === 'node' && direct.input) {
      normalized.push({ kind: 'node', input: direct.input })
      return
    }
    if (direct.kind === 'text' && typeof direct.value === 'string') {
      normalized.push({ kind: 'text', value: direct.value })
      return
    }
  }
  if (isReconcilerElement(value)) {
    if (value.type === RECONCILER_FRAGMENT) {
      normalizeInto(value.props.children as RenderValue, normalized)
      return
    }
    let props = { ...(value.props ?? {}) }
    let rawChildren = props.children
    delete props.children
    normalized.push({
      kind: 'node',
      input: {
        type: value.type,
        key: value.key,
        props,
        children: toNodeChildren(rawChildren),
      },
    })
  }
}

function normalizeNodeChildren(children: NodeChild[]): RenderNode[] {
  let normalized: RenderNode[] = []
  for (let child of children) {
    let next = normalizeRenderNodes(child as RenderValue)
    normalized.push(...next)
  }
  return normalized
}

function toNodeChildren(children: unknown): NodeChild[] {
  let output: NodeChild[] = []
  toNodeChildrenInto(children as RenderValue, output)
  return output
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
  if (!isReconcilerElement(children)) return
  if (children.type === RECONCILER_FRAGMENT) {
    toNodeChildrenInto(children.props.children as RenderValue, output)
    return
  }
  let props = { ...(children.props ?? {}) }
  let rawChildren = props.children
  delete props.children
  output.push({
    kind: 'node',
    input: {
      type: children.type,
      key: children.key,
      props,
      children: toNodeChildren(rawChildren),
    },
  })
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
