import type { TypedEventTarget } from '@remix-run/interaction'

export type Task = (signal: AbortSignal) => void

export type HostChild = null | string | HostRenderNode

export type Connect = (node: Element, signal: AbortSignal) => void

export type HostInput = {
  type: string
  key: unknown
  props: Record<string, unknown>
  children: HostChild[]
}

export type HostRenderNode = {
  kind: 'host'
  input: HostInput
}

export type TextRenderNode = {
  kind: 'text'
  value: string
}

export type RenderNode = HostRenderNode | TextRenderNode

export type FlushContext = {
  flushId: number
}

export type HostTransform = (input: HostInput) => HostInput
export type HostTask = (node: Element, signal: AbortSignal) => void

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

export type PluginEventMap = {
  beforeFlush: PluginBeforeFlushEvent
  afterFlush: PluginAfterFlushEvent
}

export class HostInsertEvent extends Event {
  input: HostInput
  node: Element
  signal: AbortSignal

  constructor(input: HostInput, node: Element, signal: AbortSignal) {
    super('insert')
    this.input = input
    this.node = node
    this.signal = signal
  }
}

export class HostRemoveEvent extends Event {
  node: Element
  #waitUntil: (promise: Promise<void>) => void

  constructor(node: Element, waitUntil: (promise: Promise<void>) => void) {
    super('remove')
    this.node = node
    this.#waitUntil = waitUntil
  }

  waitUntil(promise: Promise<any>) {
    this.#waitUntil(promise)
  }
}

export type HostEventMap = {
  insert: HostInsertEvent
  remove: HostRemoveEvent
}

export type PluginHandle = TypedEventTarget<PluginEventMap>
export type HostHandle = TypedEventTarget<HostEventMap> & {
  queueTask(task: HostTask): void
}

export type HostFactory = (hostHandle: HostHandle) => void | HostTransform

export type Plugin = (pluginHandle: PluginHandle) => void | HostFactory

export function definePlugin(plugin: Plugin): Plugin {
  return plugin
}

export type PreparedPlugin = {
  handle: PluginHandle
  createHost: null | HostFactory
}

export type SpikeHandle = {
  host(input: HostInput): HostRenderNode
  update(): Promise<AbortSignal>
  queueTask(task: Task): void
  signal: AbortSignal
}

export type RootState = {
  container: Element
  current: null | CommittedNode
  render: null | ((handle: SpikeHandle) => null | HostRenderNode | string)
  handle: SpikeHandle
  renderController: null | AbortController
  pendingTasks: Task[]
  scheduled: boolean
}

export type CommittedTextNode = {
  kind: 'text'
  dom: Text
  value: string
}

export type CommittedHostNode = {
  kind: 'host'
  type: string
  key: string
  props: Record<string, unknown>
  dom: Element
  children: CommittedNode[]
  hostHandles: HostHandle[]
  transforms: HostTransform[]
  pendingTasks: HostTask[]
  reclaimed: boolean
}

export type CommittedNode = CommittedTextNode | CommittedHostNode

export type DeferredRemoval = {
  key: string
  type: string
  parent: ParentNode
  node: CommittedHostNode
  settled: boolean
  reclaimed: boolean
}

export type RemovalRegistry = Map<string, DeferredRemoval>
