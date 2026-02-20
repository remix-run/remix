export type RootTask = (signal: AbortSignal) => void

export type UpdateHandle = {
  update(): Promise<AbortSignal>
  queueTask(task: RootTask): void
}

export type HostTask<element> = (node: element, signal: AbortSignal) => void

export type Component<setup, renderProps, renderValue> = (
  handle: UpdateHandle,
  setup: setup,
) => (props: renderProps) => renderValue

export type ReconcilerElement = {
  $rmx: true
  type: unknown
  key: unknown
  props: Record<string, unknown>
}

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
  mergeProps(props: Record<string, unknown>): void
  consume(key: string): void
  isConsumed(key: string): boolean
  remainingPropsView(): Record<string, unknown>
}

export type PluginSetupHandle<element = EventTarget> = EventTarget & {
  root: ReconcilerRoot<RenderValue>
  host: CommittedHostNode<any, any, any, element>
  update(): Promise<AbortSignal>
  queueTask(task: HostTask<element>): void
}

export type PluginRootHandle = EventTarget & {
  root: ReconcilerRoot<RenderValue>
}

export type Plugin<element = EventTarget> = {
  phase: PluginPhase
  priority?: number
  keys?: string[]
  shouldActivate?(context: PluginHostContext<element>): boolean
  setup?(handle: PluginSetupHandle<element>): void
  mount?(context: PluginHostContext<element>): unknown
  apply?(context: PluginHostContext<element>, slot: unknown): void
  unmount?(context: PluginHostContext<element>, slot: unknown): void
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
  pluginSlots: Array<undefined | unknown>
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
  handle: UpdateHandle
}

export type CommittedNode<parent, node, text extends node, element extends node> =
  | CommittedTextNode<text>
  | CommittedHostNode<parent, node, text, element>
  | CommittedComponentNode<parent, node, text, element>

export type ReconcilerRoot<renderValue> = {
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
  #mergeProps: PluginHostContext<element>['mergeProps']
  #consume: PluginHostContext<element>['consume']
  #isConsumed: PluginHostContext<element>['isConsumed']
  #remainingPropsView: PluginHostContext<element>['remainingPropsView']

  constructor(context: PluginHostContext<element>) {
    super('commit')
    this.root = context.root
    this.host = context.host
    this.delta = context.delta
    this.#mergeProps = context.mergeProps
    this.#consume = context.consume
    this.#isConsumed = context.isConsumed
    this.#remainingPropsView = context.remainingPropsView
  }

  mergeProps(props: Record<string, unknown>) {
    this.#mergeProps(props)
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

export function definePlugin<element>(plugin: Plugin<element>): Plugin<element>
export function definePlugin<element>(
  plugin: (root: PluginRootHandle) => Plugin<element>,
): (root: PluginRootHandle) => Plugin<element>
export function definePlugin<element>(
  plugin: Plugin<element> | ((root: PluginRootHandle) => Plugin<element>),
) {
  return plugin
}
