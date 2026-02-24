export type RootTask = (signal: AbortSignal) => void

export type UpdateHandle = {
  update(): Promise<AbortSignal>
  queueTask(task: RootTask): void
}

export type ComponentHandle = UpdateHandle & {
  id: string
}

export type HostTask<element> = (node: element, signal: AbortSignal) => void

export type Component<setup, renderProps, renderValue> = (
  handle: ComponentHandle,
  setup: setup,
) => (props: renderProps) => renderValue

export type ReconcilerElement = {
  $rmx: true
  type: unknown
  key: unknown
  props: Record<string, unknown>
}

export type RootTarget<parent, node> = parent | [node, node]

export type NodePolicy<parent, node, text extends node, element extends node> = {
  createText(value: string): text
  setText(node: text, value: string): void
  prepareHostMount?(parent: parent | element, input: HostInput): void
  createElement(parent: parent | element, type: string): element
  getType(node: element): string
  getParent(node: node): null | parent | element
  firstChild(parent: parent | element): null | node
  nextSibling(node: node): null | node
  insert(parent: parent | element, node: node, anchor: null | node): void
  move(parent: parent | element, node: node, anchor: null | node): void
  remove(parent: parent | element, node: node): void
}

export type HostInput = {
  type: string
  key: unknown
  props: Record<string, unknown>
  children: RenderValue[]
}

export type PluginPhase = 'special' | 'terminal'

export type HostPropDelta = {
  kind: 'mount' | 'update'
  previousProps: Record<string, unknown>
  nextProps: Record<string, unknown>
  changedKeys: string[]
}

export type PluginHostContext<element = EventTarget> = {
  root: ReconcilerRoot<RenderValue>
  host: CommittedHostNode<any, any, any, element>
  delta: HostPropDelta
  replaceProps(props: Record<string, unknown>): void
  consume(key: string): void
  isConsumed(key: string): boolean
  remainingPropsView(): Record<string, unknown>
}

export type PluginSetupHandle<element = EventTarget> = {
  root: ReconcilerRoot<RenderValue>
  host: CommittedHostNode<any, any, any, element>
  update(): Promise<AbortSignal>
  queueTask(task: HostTask<element>): void
}

export type PluginRootHandle = EventTarget & {
  root: ReconcilerRoot<RenderValue>
}

export type PluginNodeScope<element = EventTarget> = {
  detach?(event: PluginDetachEvent<element>): void
  commit?(event: PluginCommitEvent<element>): void
  remove?(): void
}

export type Plugin<element = EventTarget> = {
  phase: PluginPhase
  priority?: number
  keys?: string[]
  shouldActivate?(context: PluginHostContext<element>): boolean
  setup?(handle: PluginSetupHandle<element>): void | PluginNodeScope<element>
}

export type PluginDefinition<element = EventTarget> =
  | Plugin<element>
  | ((root: PluginRootHandle) => Plugin<element>)

export type PreparedPlugin<element = EventTarget> = {
  id: number
  phase: PluginPhase
  priority: number
  routingKeys: string[]
  plugin: Plugin<element>
}

export class PluginBeforeCommitEvent extends Event {
  root: ReconcilerRoot<RenderValue>

  constructor(root: ReconcilerRoot<RenderValue>) {
    super('beforeCommit')
    this.root = root
  }
}

export class PluginAfterCommitEvent extends Event {
  root: ReconcilerRoot<RenderValue>

  constructor(root: ReconcilerRoot<RenderValue>) {
    super('afterCommit')
    this.root = root
  }
}

export type RenderValue =
  | ReconcilerElement
  | string
  | number
  | bigint
  | boolean
  | null
  | undefined
  | RenderValue[]

export type RenderNode = TextRenderNode | HostRenderNode | ComponentRenderNode

export type TextRenderNode = {
  kind: 'text'
  value: string
  key: unknown
}

export type HostRenderNode = {
  kind: 'host'
  type: string
  key: unknown
  props: Record<string, unknown>
  children: RenderValue[]
}

export type ComponentRenderNode = {
  kind: 'component'
  type: Component<any, any, RenderValue>
  key: unknown
  setup: unknown
  props: Record<string, unknown>
}

export type CommittedTextNode<text> = {
  id: number
  kind: 'text'
  key: unknown
  node: text
  value: string
}

export type CommittedHostNode<parent, node, text extends node, element extends node> = {
  id: number
  kind: 'host'
  key: unknown
  type: string
  props: Record<string, unknown>
  childrenInput: RenderValue[]
  node: element
  children: CommittedNode<parent, node, text, element>[]
  pluginSlots: Array<undefined | null | PluginNodeScope<any>>
  activePluginIds: number[]
}

export type CommittedComponentNode<parent, node, text extends node, element extends node> = {
  id: number
  kind: 'component'
  key: unknown
  type: Component<any, any, RenderValue>
  render: (props: Record<string, unknown>) => RenderValue
  props: Record<string, unknown>
  pendingUpdate: boolean
  child: null | CommittedNode<parent, node, text, element>
  handle: ComponentHandle
}

export type CommittedNode<parent, node, text extends node, element extends node> =
  | CommittedTextNode<text>
  | CommittedHostNode<parent, node, text, element>
  | CommittedComponentNode<parent, node, text, element>

export type ReconcilerRoot<renderValue> = EventTarget & {
  render(value: null | renderValue): void
  flush(): void
  remove(): void
  dispose(): void
}

export class ReconcilerErrorEvent extends Event {
  cause: unknown

  constructor(cause: unknown) {
    super('error')
    this.cause = cause
  }
}

export class PluginCommitEvent<element = EventTarget> extends Event {
  root: ReconcilerRoot<RenderValue>
  host: CommittedHostNode<any, any, any, element>
  delta: HostPropDelta
  #replaceProps: PluginHostContext<element>['replaceProps']
  #consume: PluginHostContext<element>['consume']
  #isConsumed: PluginHostContext<element>['isConsumed']
  #remainingPropsView: PluginHostContext<element>['remainingPropsView']

  constructor(context: PluginHostContext<element>) {
    super('commit')
    this.root = context.root
    this.host = context.host
    this.delta = context.delta
    this.#replaceProps = context.replaceProps
    this.#consume = context.consume
    this.#isConsumed = context.isConsumed
    this.#remainingPropsView = context.remainingPropsView
  }

  replaceProps(props: Record<string, unknown>) {
    this.#replaceProps(props)
  }

  consume(key: string) {
    this.#consume(key)
  }

  isConsumed(key: string) {
    return this.#isConsumed(key)
  }

  remainingPropsView() {
    return this.#remainingPropsView()
  }
}

export class PluginDetachEvent<element = EventTarget> extends Event {
  root: ReconcilerRoot<RenderValue>
  host: CommittedHostNode<any, any, any, element>
  #retained = false
  #waitUntilPromises: Promise<unknown>[] = []

  constructor(root: ReconcilerRoot<RenderValue>, host: CommittedHostNode<any, any, any, element>) {
    super('detach')
    this.root = root
    this.host = host
  }

  retain() {
    this.#retained = true
  }

  waitUntil(promise: Promise<unknown>) {
    this.#retained = true
    this.#waitUntilPromises.push(promise)
  }

  isRetained() {
    return this.#retained
  }

  waitUntilPromises() {
    return this.#waitUntilPromises
  }
}

export function definePlugin<element>(plugin: Plugin<element>): Plugin<element>
export function definePlugin<element>(
  plugin: (root: PluginRootHandle) => Plugin<element>,
): (root: PluginRootHandle) => Plugin<element>
export function definePlugin<element>(
  plugin: Plugin<element> | ((root: PluginRootHandle) => Plugin<element>),
) {
  return plugin
}

export type StreamingChunkOutput<chunk> =
  | null
  | undefined
  | chunk
  | Iterable<chunk>
  | AsyncIterable<chunk>

export type StreamingRenderValue = RenderValue | Promise<RenderValue>

export type StreamingHostInput = {
  kind: 'host'
  type: string
  key: unknown
  props: Record<string, unknown>
  children: StreamingRenderValue[]
}

export type StreamingComponentInput = {
  kind: 'component'
  type: Component<any, any, StreamingRenderValue>
  key: unknown
  props: Record<string, unknown>
  rendered: StreamingRenderValue
}

export type StreamingBoundaryInput = StreamingHostInput | StreamingComponentInput

export type StreamingElementStart<chunk, elementState> = {
  state: elementState
  open?: StreamingChunkOutput<chunk>
  body?: StreamingChunkOutput<chunk>
  skipChildren?: boolean
}

export type StreamingBoundaryResult<chunk> = {
  open?: StreamingChunkOutput<chunk>
  content?: null | StreamingRenderValue
  close?: StreamingChunkOutput<chunk>
  deferred?: Promise<StreamingChunkOutput<chunk>>
}

export type StreamingPolicy<chunk, rootContext = unknown, elementState = unknown> = {
  beginRoot?(root: StreamingRendererRoot<chunk>): rootContext | Promise<rootContext>
  resolveBoundary?(
    input: StreamingBoundaryInput,
    context: rootContext,
    signal: AbortSignal,
  ): null | StreamingBoundaryResult<chunk> | Promise<null | StreamingBoundaryResult<chunk>>
  beginElement(
    input: StreamingHostInput,
    context: rootContext,
  ):
    | StreamingElementStart<chunk, elementState>
    | Promise<StreamingElementStart<chunk, elementState>>
  text(value: string, context: rootContext): StreamingChunkOutput<chunk> | Promise<StreamingChunkOutput<chunk>>
  endElement(
    state: elementState,
    context: rootContext,
  ): StreamingChunkOutput<chunk> | Promise<StreamingChunkOutput<chunk>>
  finalize?(context: rootContext): StreamingChunkOutput<chunk> | Promise<StreamingChunkOutput<chunk>>
}

export type StreamingHostNode = {
  id: number
  key: unknown
  type: string
  props: Record<string, unknown>
  childrenInput: StreamingRenderValue[]
  pluginSlots: Array<undefined | null | StreamingPluginNodeScope>
  activePluginIds: number[]
}

export type StreamingPropDelta = {
  kind: 'mount'
  previousProps: Record<string, unknown>
  nextProps: Record<string, unknown>
  changedKeys: string[]
}

export type StreamingPluginHostContext = {
  root: StreamingRendererRoot<any>
  host: StreamingHostNode
  delta: StreamingPropDelta
  replaceProps(props: Record<string, unknown>): void
  consume(key: string): void
  isConsumed(key: string): boolean
  remainingPropsView(): Record<string, unknown>
}

export type StreamingPluginSetupHandle = {
  root: StreamingRendererRoot<any>
  host: StreamingHostNode
  update(): Promise<AbortSignal>
  queueTask(task: RootTask): void
}

export type StreamingPluginNodeScope = {
  commit?(context: StreamingPluginHostContext): void
  remove?(): void
}

export type StreamingPluginRootHandle = EventTarget & {
  root: StreamingRendererRoot<any>
}

export type StreamingPlugin<phase extends PluginPhase = PluginPhase> = {
  phase: phase
  priority?: number
  keys?: string[]
  shouldActivate?(context: StreamingPluginHostContext): boolean
  setup?(handle: StreamingPluginSetupHandle): void | StreamingPluginNodeScope
}

export type StreamingPluginDefinition =
  | StreamingPlugin
  | ((root: StreamingPluginRootHandle) => StreamingPlugin)

export type PreparedStreamingPlugin = {
  id: number
  phase: PluginPhase
  priority: number
  routingKeys: string[]
  plugin: StreamingPlugin
}

export type StreamingRendererRoot<chunk> = EventTarget & {
  stream(): ReadableStream<chunk>
  toString(): Promise<string>
  abort(reason?: unknown): void
}

export type StreamingRenderer<chunk> = {
  createRoot(value: null | StreamingRenderValue): StreamingRendererRoot<chunk>
}

export class StreamingBeforeCommitEvent<chunk> extends Event {
  root: StreamingRendererRoot<chunk>

  constructor(root: StreamingRendererRoot<chunk>) {
    super('beforeCommit')
    this.root = root
  }
}

export class StreamingAfterCommitEvent<chunk> extends Event {
  root: StreamingRendererRoot<chunk>

  constructor(root: StreamingRendererRoot<chunk>) {
    super('afterCommit')
    this.root = root
  }
}

export class StreamingErrorEvent extends Event {
  cause: unknown

  constructor(cause: unknown) {
    super('error')
    this.cause = cause
  }
}

export function defineStreamingPlugin<phase extends PluginPhase>(
  plugin: StreamingPlugin<phase>,
): StreamingPlugin<phase>
export function defineStreamingPlugin<phase extends PluginPhase>(
  plugin: (root: StreamingPluginRootHandle) => StreamingPlugin<phase>,
): (root: StreamingPluginRootHandle) => StreamingPlugin<phase>
export function defineStreamingPlugin<phase extends PluginPhase>(
  plugin:
    | StreamingPlugin<phase>
    | ((root: StreamingPluginRootHandle) => StreamingPlugin<phase>),
) {
  return plugin
}
