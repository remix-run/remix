import { RECONCILER_FRAGMENT, RECONCILER_NODE_CHILDREN } from '../testing/jsx.ts'
import {
  StreamingAfterCommitEvent,
  StreamingBeforeCommitEvent,
  StreamingErrorEvent,
} from './types.ts'
import type {
  ComponentHandle,
  Component,
  PreparedStreamingPlugin,
  ReconcilerElement,
  RootTask,
  StreamingComponentInput,
  StreamingChunkOutput,
  StreamingHostInput,
  StreamingHostNode,
  StreamingPlugin,
  StreamingPluginDefinition,
  StreamingPluginHostContext,
  StreamingPluginNodeScope,
  StreamingPluginRootHandle,
  StreamingPluginSetupHandle,
  StreamingPolicy,
  StreamingRenderValue,
  StreamingRenderer,
  StreamingRendererRoot,
} from './types.ts'

type PreparedStreamingPlugins = {
  orderedSpecial: PreparedStreamingPlugin[]
  orderedTerminal: PreparedStreamingPlugin[]
  routedSpecialByKey: Map<string, number[]>
  unroutedSpecialIds: number[]
  all: PreparedStreamingPlugin[]
}

type StreamingRootState<chunk, rootContext, elementState> = {
  stream: null | ReadableStream<chunk>
  tasks: RootTask[]
  deferred: Promise<StreamingChunkOutput<chunk>>[]
  abortController: AbortController
  rootContext: rootContext
  started: boolean
  nodeId: number
  componentId: number
  onError: (error: unknown) => void
  policy: StreamingPolicy<chunk, rootContext, elementState>
}

type StreamingRendererOptions<chunk, rootContext, elementState> = {
  policy: StreamingPolicy<chunk, rootContext, elementState>
  plugins?: StreamingPluginDefinition[]
}

export function createStreamingRenderer<chunk, rootContext = unknown, elementState = unknown>(
  options: StreamingRendererOptions<chunk, rootContext, elementState>,
): StreamingRenderer<chunk> {
  let pluginRootHandle = new EventTarget() as StreamingPluginRootHandle
  pluginRootHandle.root = createEmptyStreamingRootFacade()
  let plugins = prepareStreamingPlugins(materializeStreamingPlugins(options.plugins ?? [], pluginRootHandle))
  return {
    createRoot(value) {
      let root = createStreamingRoot(value, options.policy, plugins)
      pluginRootHandle.root = root
      return root
    },
  }
}

function createStreamingRoot<chunk, rootContext, elementState>(
  value: null | StreamingRenderValue,
  policy: StreamingPolicy<chunk, rootContext, elementState>,
  plugins: PreparedStreamingPlugins,
) {
  let root = Object.assign(new EventTarget(), {
    stream,
    toString,
    abort,
  }) as StreamingRendererRoot<chunk>

  let state: StreamingRootState<chunk, rootContext, elementState> = {
    stream: null,
    tasks: [],
    deferred: [],
    abortController: new AbortController(),
    rootContext: undefined as rootContext,
    started: false,
    nodeId: 1,
          componentId: 1,
    onError(error) {
      let err = error instanceof Error ? error : new Error(String(error))
      console.error(err)
    },
    policy,
  }

  return root

  function stream() {
    if (state.stream) return state.stream
    state.stream = new ReadableStream<chunk>({
      async start(controller) {
        if (state.started) return
        state.started = true
        try {
          root.dispatchEvent(new StreamingBeforeCommitEvent(root))
          state.rootContext = (await awaitWithAbort(
            state.policy.beginRoot?.(root),
            state.abortController.signal,
          )) as rootContext
          await emitValue(value, controller, root, state, plugins)
          await runPendingTasks(state)
          await emitChunkOutput(
            await awaitWithAbort(state.policy.finalize?.(state.rootContext), state.abortController.signal),
            controller,
            state.abortController.signal,
          )
          await emitDeferredOutputs(state, controller)
          root.dispatchEvent(new StreamingAfterCommitEvent(root))
          controller.close()
        } catch (error) {
          if (!(state.abortController.signal.aborted && error === state.abortController.signal.reason)) {
            state.onError(error)
          }
          root.dispatchEvent(new StreamingErrorEvent(error))
          controller.error(error)
        }
      },
    })
    return state.stream
  }

  async function toString() {
    let reader = stream().getReader()
    let chunks: chunk[] = []
    try {
      while (true) {
        let result = await reader.read()
        if (result.done) break
        chunks.push(result.value)
      }
    } finally {
      reader.releaseLock()
    }
    return chunksToString(chunks)
  }

  function abort(reason?: unknown) {
    state.abortController.abort(reason)
  }
}

async function emitValue<chunk, rootContext, elementState>(
  value: null | StreamingRenderValue,
  controller: ReadableStreamDefaultController<chunk>,
  root: StreamingRendererRoot<chunk>,
  state: StreamingRootState<chunk, rootContext, elementState>,
  plugins: PreparedStreamingPlugins,
) {
  ensureNotAborted(state.abortController.signal)
  if (value == null || typeof value === 'boolean') return
  if (isPromiseLike(value)) {
    let resolved = await awaitWithAbort(value, state.abortController.signal)
    await emitValue(resolved, controller, root, state, plugins)
    return
  }
  if (Array.isArray(value)) {
    for (let child of value) {
      await emitValue(child, controller, root, state, plugins)
    }
    return
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint') {
    let output = await state.policy.text(String(value), state.rootContext)
    await emitChunkOutput(output, controller, state.abortController.signal)
    return
  }
  if (!isReconcilerElement(value)) return

  if (value.type === RECONCILER_FRAGMENT) {
    let children = readChildren(value)
    for (let child of children) {
      await emitValue(child, controller, root, state, plugins)
    }
    return
  }

  if (typeof value.type === 'function') {
    let componentType = value.type as Component<any, any, StreamingRenderValue>
    let props = value.props
    let setup = props.setup
    if ('setup' in props) {
      props = { ...props }
      delete props.setup
    }
    let handle = createComponentUpdateHandle(
      `c${state.componentId++}`,
      state.abortController.signal,
      state.tasks,
    )
    let render = componentType(handle, setup)
    let rendered = render(props)
    let componentBoundaryInput: StreamingComponentInput = {
      kind: 'component',
      type: componentType,
      key: value.key,
      setup,
      props,
      rendered,
    }
    let boundary = await awaitWithAbort(
      state.policy.resolveBoundary?.(
        componentBoundaryInput,
        state.rootContext,
        state.abortController.signal,
      ),
      state.abortController.signal,
    )
    if (boundary) {
      await emitChunkOutput(boundary.open, controller, state.abortController.signal)
      if (boundary.content !== undefined) {
        await emitValue(boundary.content, controller, root, state, plugins)
      }
      await emitChunkOutput(boundary.close, controller, state.abortController.signal)
      if (boundary.deferred) {
        state.deferred.push(boundary.deferred)
      }
      return
    }
    await emitValue(rendered, controller, root, state, plugins)
    return
  }

  if (typeof value.type !== 'string') return

  let hostInput: StreamingHostInput = {
    kind: 'host',
    type: value.type,
    key: value.key,
    props: value.props,
    children: readChildren(value),
  }
  let host = createStreamingHostNode(hostInput, state.nodeId++)
  runHostPlugins(host, root, plugins, state.abortController.signal, state.tasks)
  let nextProps = host.props
  let boundary = await awaitWithAbort(
    state.policy.resolveBoundary?.(
      {
        kind: 'host',
        type: host.type,
        key: host.key,
        props: nextProps,
        children: host.childrenInput,
      },
      state.rootContext,
      state.abortController.signal,
    ),
    state.abortController.signal,
  )
  if (boundary) {
    await emitChunkOutput(boundary.open, controller, state.abortController.signal)
    if (boundary.content !== undefined) {
      await emitValue(boundary.content, controller, root, state, plugins)
    }
    await emitChunkOutput(boundary.close, controller, state.abortController.signal)
    if (boundary.deferred) {
      state.deferred.push(boundary.deferred)
    }
    teardownHostPlugins(host)
    return
  }
  let start = await awaitWithAbort(
    state.policy.beginElement(
    {
      kind: 'host',
      type: host.type,
      key: host.key,
      props: nextProps,
      children: host.childrenInput,
    },
    state.rootContext,
    ),
    state.abortController.signal,
  )
  await emitChunkOutput(start.open, controller, state.abortController.signal)
  if (start.body != null) {
    await emitChunkOutput(start.body, controller, state.abortController.signal)
  } else if (!start.skipChildren) {
    for (let child of host.childrenInput) {
      await emitValue(child, controller, root, state, plugins)
    }
  }
  let closeOutput = await awaitWithAbort(
    state.policy.endElement(start.state, state.rootContext),
    state.abortController.signal,
  )
  await emitChunkOutput(closeOutput, controller, state.abortController.signal)
  teardownHostPlugins(host)
}

function createStreamingHostNode(input: StreamingHostInput, id: number): StreamingHostNode {
  return {
    id,
    key: input.key,
    type: input.type,
    props: input.props,
    childrenInput: input.children,
    pluginSlots: [],
    activePluginIds: [],
  }
}

function runHostPlugins(
  host: StreamingHostNode,
  root: StreamingRendererRoot<any>,
  plugins: PreparedStreamingPlugins,
  signal: AbortSignal,
  tasks: RootTask[],
) {
  if (plugins.all.length === 0) return
  let delta = {
    kind: 'mount' as const,
    previousProps: {},
    nextProps: host.props,
    changedKeys: listOwnPropKeys(host.props),
  }
  runPluginPhase(plugins.orderedSpecial, plugins.routedSpecialByKey, plugins.unroutedSpecialIds)
  runPluginPhase(plugins.orderedTerminal, new Map(), [])
  host.props = delta.nextProps

  function runPluginPhase(
    ordered: PreparedStreamingPlugin[],
    routedByKey: Map<string, number[]>,
    unroutedIds: number[],
  ) {
    let consumed: null | Set<string> = null
    let context: StreamingPluginHostContext = {
      root,
      host,
      delta,
      replaceProps(nextProps) {
        delta.nextProps = { ...nextProps }
        delta.changedKeys = listOwnPropKeys(delta.nextProps)
      },
      consume(key) {
        if (!consumed) consumed = new Set()
        consumed.add(key)
      },
      isConsumed(key) {
        return consumed?.has(key) ?? false
      },
      remainingPropsView() {
        if (!consumed) return delta.nextProps
        let output: Record<string, unknown> = {}
        for (let key in delta.nextProps) {
          if (consumed.has(key)) continue
          output[key] = delta.nextProps[key]
        }
        return output
      },
    }
    let routedIdSet = new Set<number>()
    for (let id of unroutedIds) routedIdSet.add(id)
    for (let key of delta.changedKeys) {
      let ids = routedByKey.get(key)
      if (!ids) continue
      for (let id of ids) routedIdSet.add(id)
    }

    for (let prepared of ordered) {
      if (routedIdSet.size > 0 && !routedIdSet.has(prepared.id) && prepared.routingKeys.length > 0) {
        continue
      }
      let shouldActivate = prepared.plugin.shouldActivate?.(context) ?? true
      if (!shouldActivate) continue
      let slot = setupPlugin(prepared.plugin, context, signal, tasks)
      if (slot !== null) {
        host.pluginSlots[prepared.id] = slot
        host.activePluginIds.push(prepared.id)
      }
      slot?.commit?.(context)
    }
  }
}

function setupPlugin(
  plugin: StreamingPlugin,
  context: StreamingPluginHostContext,
  signal: AbortSignal,
  tasks: RootTask[],
) {
  if (!plugin.setup) return null
  let handle: StreamingPluginSetupHandle = {
    root: context.root,
    host: context.host,
    update: async () => signal,
    queueTask(task) {
      tasks.push(task)
    },
  }
  return plugin.setup(handle) ?? null
}

function teardownHostPlugins(host: StreamingHostNode) {
  if (host.activePluginIds.length === 0) return
  let ids = host.activePluginIds.slice()
  for (let id of ids) {
    host.pluginSlots[id]?.remove?.()
    host.pluginSlots[id] = undefined
  }
  host.activePluginIds = []
}

function createComponentUpdateHandle(
  id: string,
  signal: AbortSignal,
  tasks: RootTask[],
): ComponentHandle {
  return {
    id,
    update: async () => signal,
    queueTask(task) {
      tasks.push(task)
    },
  }
}

async function runPendingTasks(state: StreamingRootState<any, any, any>) {
  let tasks = state.tasks
  state.tasks = []
  for (let task of tasks) {
    ensureNotAborted(state.abortController.signal)
    task(state.abortController.signal)
  }
}

async function emitDeferredOutputs<chunk>(
  state: StreamingRootState<chunk, any, any>,
  controller: ReadableStreamDefaultController<chunk>,
) {
  while (state.deferred.length > 0) {
    let pending = state.deferred.splice(0, state.deferred.length)
    let settled = await Promise.allSettled(pending)
    for (let entry of settled) {
      if (entry.status === 'rejected') throw entry.reason
      await emitChunkOutput(entry.value, controller, state.abortController.signal)
    }
  }
}

async function emitChunkOutput<chunk>(
  output: StreamingChunkOutput<chunk>,
  controller: ReadableStreamDefaultController<chunk>,
  signal: AbortSignal,
) {
  if (output == null) return
  ensureNotAborted(signal)
  if (output instanceof Uint8Array) {
    controller.enqueue(output as chunk)
    return
  }
  if (isAsyncIterable(output)) {
    for await (let chunk of output) {
      ensureNotAborted(signal)
      controller.enqueue(chunk)
    }
    return
  }
  if (isIterable(output) && typeof output !== 'string') {
    for (let chunk of output) {
      ensureNotAborted(signal)
      controller.enqueue(chunk)
    }
    return
  }
  controller.enqueue(output as chunk)
}

function ensureNotAborted(signal: AbortSignal) {
  if (!signal.aborted) return
  throw signal.reason ?? new Error('stream aborted')
}

async function awaitWithAbort<value>(input: value | Promise<value>, signal: AbortSignal): Promise<value> {
  ensureNotAborted(signal)
  if (!isPromiseLike(input)) return input
  return new Promise<value>((resolve, reject) => {
    let onAbort = () => {
      signal.removeEventListener('abort', onAbort)
      reject(signal.reason ?? new Error('stream aborted'))
    }
    signal.addEventListener('abort', onAbort, { once: true })
    input.then(
      (resolved) => {
        signal.removeEventListener('abort', onAbort)
        resolve(resolved)
      },
      (error) => {
        signal.removeEventListener('abort', onAbort)
        reject(error)
      },
    )
  })
}

function prepareStreamingPlugins(rawPlugins: StreamingPlugin[]): PreparedStreamingPlugins {
  let all: PreparedStreamingPlugin[] = []
  for (let index = 0; index < rawPlugins.length; index++) {
    let plugin = rawPlugins[index]
    all.push({
      id: index,
      phase: plugin.phase,
      priority: plugin.priority ?? 0,
      routingKeys: plugin.keys ?? [],
      plugin,
    })
  }
  let orderedSpecial = all
    .filter((plugin) => plugin.phase === 'special')
    .sort(comparePreparedStreamingPlugin)
  let orderedTerminal = all
    .filter((plugin) => plugin.phase === 'terminal')
    .sort(comparePreparedStreamingPlugin)
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

function materializeStreamingPlugins(
  plugins: StreamingPluginDefinition[],
  root: StreamingPluginRootHandle,
) {
  let output: StreamingPlugin[] = []
  for (let plugin of plugins) {
    if (typeof plugin === 'function') {
      output.push(plugin(root))
      continue
    }
    output.push(plugin)
  }
  return output
}

function comparePreparedStreamingPlugin(a: PreparedStreamingPlugin, b: PreparedStreamingPlugin) {
  if (a.priority !== b.priority) return a.priority - b.priority
  return a.id - b.id
}

function readChildren(element: ReconcilerElement) {
  let cached = (element as ReconcilerElement & { [RECONCILER_NODE_CHILDREN]?: StreamingRenderValue[] })[
    RECONCILER_NODE_CHILDREN
  ]
  if (cached) return cached
  let children = element.props.children
  if (children == null) return []
  if (Array.isArray(children)) return children as StreamingRenderValue[]
  return [children as StreamingRenderValue]
}

function listOwnPropKeys(props: Record<string, unknown>) {
  let keys: string[] = []
  for (let key in props) {
    if (key === 'children') continue
    keys.push(key)
  }
  return keys
}

function isReconcilerElement(value: unknown): value is ReconcilerElement {
  if (!value || typeof value !== 'object') return false
  return (value as { $rmx?: unknown }).$rmx === true
}

function isPromiseLike(value: unknown): value is Promise<unknown> {
  if (!value || typeof value !== 'object') return false
  return typeof (value as { then?: unknown }).then === 'function'
}

function isIterable(value: unknown): value is Iterable<unknown> {
  if (!value || typeof value !== 'object') return false
  return Symbol.iterator in value
}

function isAsyncIterable(value: unknown): value is AsyncIterable<unknown> {
  if (!value || typeof value !== 'object') return false
  return Symbol.asyncIterator in value
}

function createEmptyStreamingRootFacade() {
  return Object.assign(new EventTarget(), {
    stream() {
      return new ReadableStream()
    },
    async toString() {
      return ''
    },
    abort() {},
  }) as StreamingRendererRoot<any>
}

function chunksToString<chunk>(chunks: chunk[]) {
  let hasUint8 = chunks.some((chunk) => chunk instanceof Uint8Array)
  if (hasUint8) {
    let decoder = new TextDecoder()
    let output = ''
    for (let chunk of chunks) {
      if (chunk instanceof Uint8Array) {
        output += decoder.decode(chunk, { stream: true })
      } else {
        output += String(chunk)
      }
    }
    output += decoder.decode()
    return output
  }
  let output = ''
  for (let chunk of chunks) output += String(chunk)
  return output
}
