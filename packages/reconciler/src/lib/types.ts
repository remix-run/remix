export type ReconcilerElementType = unknown

export type ReconcilerElement = {
  $rmx: true
  type: ReconcilerElementType
  key: unknown
  props: Record<string, unknown>
}

export type RenderValue =
  | null
  | undefined
  | boolean
  | number
  | bigint
  | string
  | ReconcilerElement
  | RenderValue[]

export type NodeChild = null | string | NodeRenderNode

export type NodeInput = {
  type: ReconcilerElementType
  key: unknown
  props: Record<string, unknown>
  children: NodeChild[]
}

export type NodeTransformInput = {
  type: ReconcilerElementType
  props: Record<string, unknown>
}

export type NodeRenderNode = {
  kind: 'node'
  input: NodeInput
}

export type TextRenderNode = {
  kind: 'text'
  value: string
}

export type RenderNode = NodeRenderNode | TextRenderNode

export type FlushContext = {
  flushId: number
}

export type RootTask = (signal: AbortSignal) => void
export type HostTask<elementNode> = (node: elementNode, signal: AbortSignal) => void
export type NodeTransform = (input: NodeTransformInput) => NodeTransformInput

export class PluginBeforeFlushEvent extends Event {
  context: FlushContext

  constructor(context: FlushContext) {
    super('beforeFlush')
    this.context = context
  }
}

export class PluginAfterFlushEvent extends Event {
  context: FlushContext

  constructor(context: FlushContext) {
    super('afterFlush')
    this.context = context
  }
}

export type PluginHandle = EventTarget

export class HostInsertEvent<elementNode> extends Event {
  input: NodeTransformInput
  node: elementNode
  signal: AbortSignal

  constructor(input: NodeTransformInput, node: elementNode, signal: AbortSignal) {
    super('insert')
    this.input = input
    this.node = node
    this.signal = signal
  }
}

export class HostRemoveEvent<elementNode> extends Event {
  node: elementNode
  #waitUntil: (promise: Promise<void>) => void

  constructor(node: elementNode, waitUntil: (promise: Promise<void>) => void) {
    super('remove')
    this.node = node
    this.#waitUntil = waitUntil
  }

  waitUntil(promise: Promise<unknown>) {
    this.#waitUntil(promise.then(() => undefined))
  }
}

export type HostHandle<elementNode> = EventTarget & {
  queueTask(task: HostTask<elementNode>): void
  update(): Promise<AbortSignal>
  signal: AbortSignal
}

export type UpdateHandle = {
  update(): Promise<AbortSignal>
  queueTask(task: RootTask): void
  signal: AbortSignal
}

export type HostFactory<elementNode> = (hostHandle: HostHandle<elementNode>) => void | NodeTransform
export type Plugin<elementNode> = (
  pluginHandle: PluginHandle,
  root: ReconcilerRoot,
) => void | HostFactory<elementNode>

export function definePlugin<elementNode>(plugin: Plugin<elementNode>): Plugin<elementNode> {
  return plugin
}

export type PreparedPlugin<elementNode> = {
  name: string
  handle: PluginHandle
  createHost: null | HostFactory<elementNode>
}

export type NodeHandle = {
  node(input: NodeInput): NodeRenderNode
  update(): Promise<AbortSignal>
  queueTask(task: RootTask): void
  signal: AbortSignal
}

export type NodeTraversal = unknown

export type ResolvedText<textNode, traversal = NodeTraversal> = {
  node: textNode
  next: traversal
}

export type ResolvedElement<elementNode, traversal = NodeTraversal> = {
  node: elementNode
  next: traversal
}

export type NodePolicy<
  parentNode,
  node,
  textNode extends node,
  elementNode extends node,
  traversal = NodeTraversal,
> = {
  firstChild(parent: parentNode): null | node
  nextSibling(node: node): null | node
  begin(parent: parentNode): traversal
  enter(parent: parentNode): traversal
  insert(parent: parentNode, node: node, anchor: null | node): void
  move(parent: parentNode, node: node, anchor: null | node): void
  remove(parent: parentNode, node: node): void
  resolveText(
    parent: parentNode,
    traversal: traversal,
    value: string,
  ): ResolvedText<textNode, traversal>
  resolveElement(
    parent: parentNode,
    traversal: traversal,
    type: string,
  ): ResolvedElement<elementNode, traversal>
}

export type CommittedTextNode<textNode> = {
  kind: 'text'
  instance: textNode
  value: string
}

export type CommittedHostNode<node, elementNode extends node> = {
  kind: 'host'
  type: string
  key: string
  props: Record<string, unknown>
  instance: elementNode
  children: CommittedNode<node, elementNode>[]
  hostHandles: HostHandle<elementNode>[]
  transforms: NodeTransform[]
  pendingTasks: HostTask<elementNode>[]
}

export type CommittedNode<node, elementNode extends node> =
  | CommittedTextNode<node>
  | CommittedHostNode<node, elementNode>

export type DeferredRemoval<parentNode, node, elementNode extends node> = {
  key: string
  type: string
  parent: parentNode
  node: CommittedHostNode<node, elementNode>
  settled: boolean
  reclaimed: boolean
}

export type RemovalRegistry<parentNode, node, elementNode extends node> = Map<
  string,
  DeferredRemoval<parentNode, node, elementNode>
>

export type RootState<
  parentNode,
  node,
  elementNode extends node & parentNode,
  traversal = NodeTraversal,
> = {
  id: number
  target: EventTarget
  parent: null | RootState<parentNode, node, elementNode, traversal>
  branches: Set<RootState<parentNode, node, elementNode, traversal>>
  container: parentNode
  current: CommittedNode<node, elementNode>[]
  render: null | ((handle: NodeHandle) => RenderValue)
  handle: NodeHandle
  enqueue(): void
  nodePolicy: NodePolicy<parentNode, node, node, elementNode, traversal>
  renderController: null | AbortController
  pendingTasks: RootTask[]
  scheduled: boolean
  disposed: boolean
  preparedPlugins: PreparedPlugin<elementNode>[]
  hostFactories: HostFactory<elementNode>[]
}

export type ErrorPhase =
  | 'beforeFlush'
  | 'afterFlush'
  | 'reconcile'
  | 'plugin'
  | 'hostTask'
  | 'rootTask'
  | 'scheduler'

export type ReconcilerErrorContext = {
  phase: ErrorPhase
  flushId?: number
  rootId?: number
  pluginName?: string
  nodeKey?: string
}

export class ReconcilerErrorEvent extends Event {
  error: unknown
  context: ReconcilerErrorContext

  constructor(error: unknown, context: ReconcilerErrorContext) {
    super('error')
    this.error = error
    this.context = context
  }
}

export type ReconcilerRoot<parentNode = unknown> = EventTarget & {
  render(render: null | RenderValue | ((handle: NodeHandle) => RenderValue)): void
  branch(container: parentNode): ReconcilerRoot<parentNode>
  flush(): void
  remove(): void
  dispose(): void
}
