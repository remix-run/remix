import { HostInsertEvent, HostRemoveEvent } from './types.ts'
import type {
  CommittedHostNode,
  CommittedNode,
  DeferredRemoval,
  HostChild,
  HostFactory,
  HostEventMap,
  HostHandle,
  HostInput,
  HostRenderNode,
  HostTask,
  HostTransform,
  PreparedPlugin,
  RemovalRegistry,
  RootState,
  TextRenderNode,
} from './types.ts'
import { TypedEventTarget } from '@remix-run/interaction'

export function createReconcilerRuntime(plugins: PreparedPlugin[]) {
  let removalRegistry: RemovalRegistry = new Map()
  let hostFactories: HostFactory[] = []
  for (let plugin of plugins) {
    if (plugin.createHost) hostFactories.push(plugin.createHost)
  }

  function createHost(input: HostInput): HostRenderNode {
    return {
      kind: 'host',
      input,
    }
  }

  function reconcileRoot(root: RootState) {
    let nextRenderable = root.render ? root.render(root.handle) : null
    let nextNode = normalizeRenderNode(nextRenderable)

    root.renderController?.abort()
    root.renderController = new AbortController()

    root.current = reconcileNode(root.current, nextNode, root.container, root)
    runTasks(root)
  }

  function removeRoot(root: RootState) {
    root.renderController?.abort()
    root.renderController = null
    root.current = removeNode(root.current, root.container)
    runTasks(root)
  }

  return {
    createHost,
    reconcileRoot,
    removeRoot,
  }

  function runTasks(root: RootState) {
    if (!root.renderController) return
    let tasks = root.pendingTasks
    root.pendingTasks = []
    for (let task of tasks) {
      task(root.renderController.signal)
    }
  }

  function reconcileNode(
    current: null | CommittedNode,
    next: null | TextRenderNode | HostRenderNode,
    parent: ParentNode,
    root: RootState,
  ): null | CommittedNode {
    if (!next) {
      return removeNode(current, parent)
    }

    if (next.kind === 'text') {
      return reconcileText(current, next, parent)
    }

    return reconcileHost(current, next.input, parent, root)
  }

  function reconcileText(
    current: null | CommittedNode,
    next: TextRenderNode,
    parent: ParentNode,
  ): CommittedNode {
    if (current && current.kind === 'text') {
      if (current.value !== next.value) {
        current.dom.data = next.value
        current.value = next.value
      }
      return current
    }

    let text = getDocument(parent).createTextNode(next.value)
    if (current) {
      parent.insertBefore(text, getAnchor(current))
      removeNode(current, parent)
    } else {
      parent.append(text)
    }

    return { kind: 'text', dom: text, value: next.value }
  }

  function reconcileHost(
    current: null | CommittedNode,
    input: HostInput,
    parent: ParentNode,
    root: RootState,
  ): CommittedNode {
    let key = toKey(input.key)

    if (current && current.kind === 'host' && current.type === input.type && current.key === key) {
      let transformedInput = applyTransforms(current, input)
      patchHost(current, transformedInput, root)
      runHostTasks(current, root.renderController!.signal)
      return current
    }

    let reclaimed = reclaimHost(parent, input.type, key)
    if (reclaimed) {
      initializeHostPlugins(reclaimed, hostFactories)
      let transformedInput = applyTransforms(reclaimed, input)
      patchHost(reclaimed, transformedInput, root)
      if (current) {
        parent.insertBefore(reclaimed.dom, getAnchor(current))
        removeNode(current, parent)
      } else if (reclaimed.dom.parentNode !== parent) {
        parent.append(reclaimed.dom)
      }
      dispatchHostInsert(reclaimed, transformedInput, root.renderController!.signal)
      runHostTasks(reclaimed, root.renderController!.signal)
      return reclaimed
    }

    let element = getDocument(parent).createElement(input.type)
    let hostNode: CommittedHostNode = {
      kind: 'host',
      type: input.type,
      key,
      props: {},
      dom: element,
      children: [],
      hostHandles: [],
      transforms: [],
      pendingTasks: [],
      reclaimed: false,
    }
    initializeHostPlugins(hostNode, hostFactories)

    let transformedInput = applyTransforms(hostNode, input)
    patchHost(hostNode, transformedInput, root)

    if (current) {
      parent.insertBefore(element, getAnchor(current))
      removeNode(current, parent)
    } else {
      parent.append(element)
    }
    dispatchHostInsert(hostNode, transformedInput, root.renderController!.signal)
    runHostTasks(hostNode, root.renderController!.signal)

    return hostNode
  }

  function patchHost(node: CommittedHostNode, input: HostInput, root: RootState) {
    node.props = input.props
    node.key = toKey(input.key)

    let nextChildren = normalizeChildren(input.children)
    let max = Math.max(node.children.length, nextChildren.length)
    let nextCommitted: CommittedNode[] = []

    for (let index = 0; index < max; index++) {
      let currentChild = node.children[index] ?? null
      let nextChild = nextChildren[index] ?? null
      let reconciled = reconcileNode(currentChild, nextChild, node.dom, root)
      if (reconciled) nextCommitted.push(reconciled)
    }

    node.children = nextCommitted
  }

  function normalizeChildren(children: HostChild[]): (TextRenderNode | HostRenderNode)[] {
    let normalized: (TextRenderNode | HostRenderNode)[] = []
    for (let child of children) {
      let next = normalizeRenderNode(child)
      if (next) normalized.push(next)
    }
    return normalized
  }

  function normalizeRenderNode(
    value: null | string | HostRenderNode,
  ): null | TextRenderNode | HostRenderNode {
    if (value == null) return null
    if (typeof value === 'string') {
      return { kind: 'text', value }
    }
    return value
  }

  function removeNode(current: null | CommittedNode, parent: ParentNode): null {
    if (!current) return null
    if (current.kind === 'text') {
      if (current.dom.parentNode === parent) {
        parent.removeChild(current.dom)
      }
      return null
    }

    let pendingRemoval: Promise<void>[] = []
    dispatchHostRemove(current, pendingRemoval)

    if (pendingRemoval.length > 0) {
      let done =
        pendingRemoval.length === 1
          ? pendingRemoval[0]
          : Promise.all(pendingRemoval).then(() => undefined)
      deferRemoval(current, parent, done)
      return null
    }

    if (current.dom.parentNode === parent) {
      parent.removeChild(current.dom)
    }
    return null
  }

  function deferRemoval(node: CommittedHostNode, parent: ParentNode, done: Promise<void>) {
    let key = node.key
    let registryKey = removalKey(node.type, key)
    let deferred: DeferredRemoval = {
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
        if (!deferred.reclaimed && deferred.node.dom.parentNode === parent) {
          parent.removeChild(deferred.node.dom)
        }
        if (key !== '') {
          removalRegistry.delete(registryKey)
        }
      })
  }

  function reclaimHost(parent: ParentNode, type: string, key: string): null | CommittedHostNode {
    if (key === '') return null
    let deferred = removalRegistry.get(removalKey(type, key))
    if (!deferred) return null
    if (deferred.parent !== parent || deferred.settled) return null
    deferred.reclaimed = true
    removalRegistry.delete(removalKey(type, key))
    return deferred.node
  }

  function initializeHostPlugins(
    node: CommittedHostNode,
    factories: HostFactory[],
  ) {
    node.hostHandles = []
    node.transforms = []
    node.pendingTasks = []
    for (let createHost of factories) {
      let hostTarget: TypedEventTarget<HostEventMap> = new TypedEventTarget()
      let hostHandle: HostHandle = Object.assign(hostTarget, {
        queueTask(task: HostTask) {
          node.pendingTasks.push(task)
        },
      })
      let transform = createHost(hostHandle)
      node.hostHandles.push(hostHandle)
      if (transform) node.transforms.push(transform)
    }
  }

  function applyTransforms(node: CommittedHostNode, input: HostInput) {
    let transformedInput = input
    for (let transform of node.transforms) {
      transformedInput = transform(transformedInput)
    }
    return transformedInput
  }

  function dispatchHostRemove(node: CommittedHostNode, pending: Promise<void>[]) {
    for (let hostHandle of node.hostHandles) {
      let event = new HostRemoveEvent(node.dom, (promise) => {
        pending.push(promise.catch(() => undefined))
      })
      hostHandle.dispatchEvent(event)
    }
  }

  function dispatchHostInsert(node: CommittedHostNode, input: HostInput, signal: AbortSignal) {
    for (let hostHandle of node.hostHandles) {
      let event = new HostInsertEvent(input, node.dom, signal)
      hostHandle.dispatchEvent(event)
    }
  }

  function runHostTasks(node: CommittedHostNode, signal: AbortSignal) {
    let tasks = node.pendingTasks
    node.pendingTasks = []
    for (let task of tasks) {
      task(node.dom, signal)
    }
  }
}

function getAnchor(node: CommittedNode) {
  return node.kind === 'host' ? node.dom : node.dom
}

function toKey(value: unknown) {
  if (value == null) return ''
  return String(value)
}

function removalKey(type: string, key: string) {
  return `${type}::${key}`
}

function getDocument(parent: ParentNode) {
  if (parent.ownerDocument) return parent.ownerDocument
  return parent as Document
}
