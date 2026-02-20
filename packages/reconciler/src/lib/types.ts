export type RootTask = (signal: AbortSignal) => void

export type UpdateHandle = {
  update(): Promise<AbortSignal>
  queueTask(task: RootTask): void
}

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

export type PluginRouting = {
  keys?: string[]
}

export type PluginPhase = 'special' | 'terminal'

export type HostPropDelta = {
  kind: 'mount' | 'update'
  previousProps: Record<string, unknown>
  nextProps: Record<string, unknown>
  changedKeys: string[]
}

export type PluginHostContext<parent, node, text extends node, element extends node> = {
  root: ReconcilerRoot<RenderValue>
  host: CommittedHostNode<parent, node, text, element>
  delta: HostPropDelta
  mergeProps(props: Record<string, unknown>): void
  consume(key: string): void
  isConsumed(key: string): boolean
  remainingPropsView(): Record<string, unknown>
}

export type Plugin<parent, node, text extends node, element extends node> = {
  phase: PluginPhase
  priority?: number
  routing?: PluginRouting
  shouldActivate?(context: PluginHostContext<parent, node, text, element>): boolean
  mount?(context: PluginHostContext<parent, node, text, element>): unknown
  apply?(context: PluginHostContext<parent, node, text, element>, slot: unknown): void
  unmount?(context: PluginHostContext<parent, node, text, element>, slot: unknown): void
}

export type PreparedPlugin<parent, node, text extends node, element extends node> = {
  id: number
  phase: PluginPhase
  priority: number
  routingKeys: string[]
  plugin: Plugin<parent, node, text, element>
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

export type RenderNode =
  | TextRenderNode
  | HostRenderNode
  | ComponentRenderNode

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

export function definePlugin<parent, node, text extends node, element extends node>(
  plugin: Plugin<parent, node, text, element>,
) {
  return plugin
}
