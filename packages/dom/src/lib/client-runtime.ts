import type { Component, ComponentHandle } from '@remix-run/reconciler'
import { jsx } from './jsx/jsx-runtime.ts'
import { createDomReconciler } from './dom-reconciler.ts'

type HydrationData = {
  moduleUrl: string
  exportName: string
  props: Record<string, unknown>
}

type FrameData = {
  status: 'pending' | 'resolved'
  src: string
  name?: string
}

type RmxData = {
  h?: Record<string, HydrationData>
  f?: Record<string, FrameData>
}

type HydrationBoundary = {
  id: string
  start: Comment
  end: Comment
}

type FrameBoundary = {
  id: string
  start: Comment
  end: Comment
}

type FrameState = {
  handle: FrameHandle
  id: string
  start: Comment
  end: Comment
  status: 'pending' | 'resolved'
  disposed: boolean
  reloadController: null | AbortController
}

type ReconcilerRoot = ReturnType<ReturnType<typeof createDomReconciler>['createRoot']>

export type ClientModuleLoader = (
  moduleUrl: string,
  exportName: string,
) => Promise<unknown> | unknown

export type ResolveFrame = (
  src: string,
  signal?: AbortSignal,
) => Promise<string | ReadableStream<Uint8Array>> | string | ReadableStream<Uint8Array>

export type BootOptions = {
  document?: Document
  loadModule: ClientModuleLoader
  resolveFrame?: ResolveFrame
  onError?: (error: unknown, boundaryId: null | string) => void
}

export type FrameHandle = EventTarget &
  {
    src: string
    reload(): Promise<AbortSignal>
    id: string
    name?: string
  }

export type FrameRegistry = {
  top: FrameHandle
  get(name: string): undefined | FrameHandle
}

export type RuntimeHandle = EventTarget & {
  frame: FrameHandle
  frames: FrameRegistry
  ready(): Promise<void>
  flush(): void
  dispose(): void
}

type RuntimeState = {
  doc: Document
  options: BootOptions
  data: RmxData
  moduleCache: Map<string, Component<any, any, any>>
  moduleLoads: Map<string, Promise<Component<any, any, any> | undefined>>
  rootsByStart: Map<Comment, ReconcilerRoot>
  frameStatesByStart: Map<Comment, FrameState>
  frameStatesById: Map<string, FrameState>
  namedFrames: Map<string, FrameHandle>
  pendingFrameTemplates: Map<string, DocumentFragment[]>
  templateObserver: null | MutationObserver
  reconcilerByFrame: WeakMap<object, ReturnType<typeof createDomReconciler>>
  disposed: boolean
  runtime: RuntimeHandle
}

export function boot(options: BootOptions): RuntimeHandle {
  let doc = options.document ?? document
  let eventTarget = new EventTarget()
  let topFrame = createRootFrameHandle(doc)
  let frames: FrameRegistry = {
    top: topFrame,
    get(name) {
      return state.namedFrames.get(name)
    },
  }
  let state: RuntimeState = {
    doc,
    options,
    data: {},
    moduleCache: new Map(),
    moduleLoads: new Map(),
    rootsByStart: new Map(),
    frameStatesByStart: new Map(),
    frameStatesById: new Map(),
    namedFrames: new Map(),
    pendingFrameTemplates: new Map(),
    templateObserver: null,
    reconcilerByFrame: new WeakMap(),
    disposed: false,
    runtime: null as unknown as RuntimeHandle,
  }

  let runtime = Object.assign(eventTarget, {
    frame: topFrame,
    frames,
    async ready() {
      await readyPromise
    },
    flush() {
      for (let root of state.rootsByStart.values()) {
        root.flush()
      }
    },
    dispose() {
      if (state.disposed) return
      state.disposed = true
      for (let frameState of Array.from(state.frameStatesByStart.values())) {
        disposeFrameState(state, frameState)
      }
      state.templateObserver?.disconnect()
      state.templateObserver = null
      state.frameStatesByStart.clear()
      state.frameStatesById.clear()
      state.pendingFrameTemplates.clear()
      state.namedFrames.clear()
      for (let root of state.rootsByStart.values()) {
        root.dispose()
      }
      state.rootsByStart.clear()
    },
  }) as RuntimeHandle
  state.runtime = runtime

  let readyPromise = (async () => {
    try {
      mergeRmxDataFromScope(state.data, doc, options.onError)
      startFrameTemplateObservation(state)
      processExistingFrameTemplates(state)
      let container = doc.body ?? doc.documentElement ?? doc
      pruneDisconnectedRuntimeNodes(state)
      await hydrateContainer(state, Array.from(container.childNodes), topFrame)
      runtime.flush()
    } catch (error) {
      options.onError?.(error, null)
    }
  })()

  return runtime
}

function createRootFrameHandle(doc: Document): FrameHandle {
  let target = new EventTarget()
  return Object.assign(target, {
    id: 'root',
    src: doc.location?.href ?? '/',
    reload: async () => {
      throw new Error('Root frame cannot be reloaded directly')
    },
  }) as FrameHandle
}

async function hydrateContainer(
  state: RuntimeState,
  nodes: Node[],
  ownerFrame: FrameHandle,
) {
  if (state.disposed) return
  pruneDisconnectedRuntimeNodes(state)
  let hydrationBoundaries = findHydrationBoundaries(nodes, (error) => state.options.onError?.(error, null))
  let hydrationJobs = hydrationBoundaries.map((boundary) => hydrateBoundary(state, boundary, ownerFrame))
  await Promise.all(hydrationJobs)

  let frameBoundaries = findFrameBoundaries(nodes, (error) => state.options.onError?.(error, null))
  for (let boundary of frameBoundaries) {
    let frameData = state.data.f?.[boundary.id]
    if (!frameData || typeof frameData.src !== 'string') continue
    let frameState = getOrCreateFrameState(state, boundary, frameData)
    await applyPendingTemplateIfAvailable(state, frameState)
    await hydrateContainer(state, getRangeNodes(boundary.start, boundary.end), frameState.handle)
  }
}

async function hydrateBoundary(state: RuntimeState, boundary: HydrationBoundary, ownerFrame: FrameHandle) {
  let entry = state.data.h?.[boundary.id]
  if (!entry) return
  let component = await getOrLoadModule(
    state,
    `${entry.moduleUrl}#${entry.exportName}`,
    entry,
    boundary.id,
  )
  if (!component) return
  if (!isHydrationBoundaryLive(boundary)) return

  try {
    let root = state.rootsByStart.get(boundary.start)
    if (!root) {
      let reconciler = getReconcilerForFrame(state, ownerFrame)
      root = reconciler.createRoot([boundary.start, boundary.end])
      state.rootsByStart.set(boundary.start, root)
    }
    root.render(jsx(component, reviveSerializedObject(entry.props) as any))
  } catch (error) {
    state.options.onError?.(error, boundary.id)
  }
}

function getReconcilerForFrame(state: RuntimeState, frame: FrameHandle) {
  let existing = state.reconcilerByFrame.get(frame)
  if (existing) return existing
  let created = createDomReconciler(state.doc, {
    extendComponentHandle(handle) {
      return attachFrameHandle(handle, frame, state.runtime.frames)
    },
  })
  state.reconcilerByFrame.set(frame, created)
  return created
}

function attachFrameHandle(
  handle: ComponentHandle,
  frame: FrameHandle,
  frames: FrameRegistry,
): Partial<ComponentHandle> {
  return {
    ...handle,
    frame,
    frames,
  }
}

function getOrCreateFrameState(state: RuntimeState, boundary: FrameBoundary, data: FrameData): FrameState {
  let existing = state.frameStatesByStart.get(boundary.start)
  if (existing) {
    existing.end = boundary.end
    existing.id = boundary.id
    existing.status = data.status
    existing.handle.src = data.src
    if (typeof data.name === 'string') {
      existing.handle.name = data.name
      state.namedFrames.set(data.name, existing.handle)
    }
    return existing
  }

  let target = new EventTarget()
  let frameState: FrameState = {
    handle: null as unknown as FrameHandle,
    id: boundary.id,
    start: boundary.start,
    end: boundary.end,
    status: data.status,
    disposed: false,
    reloadController: null,
  }
  let handle = Object.assign(target, {
    id: boundary.id,
    name: data.name,
    src: data.src,
    async reload() {
      if (!state.options.resolveFrame) {
        throw new Error('No resolveFrame provided')
      }
      if (frameState.disposed) {
        return AbortSignal.abort('frame disposed')
      }
      frameState.reloadController?.abort()
      let controller = new AbortController()
      frameState.reloadController = controller
      handle.dispatchEvent(new Event('reloadStart'))
      try {
        let content = await state.options.resolveFrame(handle.src, controller.signal)
        if (controller.signal.aborted) return controller.signal
        let html = await toHTML(content, controller.signal)
        if (controller.signal.aborted) return controller.signal
        await replaceFrameContent(state, frameState, html)
        state.runtime.flush()
        return controller.signal
      } finally {
        if (frameState.reloadController === controller) {
          handle.dispatchEvent(new Event('reloadComplete'))
        }
      }
    },
  }) as FrameHandle
  frameState.handle = handle
  state.frameStatesByStart.set(boundary.start, frameState)
  state.frameStatesById.set(boundary.id, frameState)
  if (typeof data.name === 'string') {
    state.namedFrames.set(data.name, handle)
  }
  return frameState
}

async function replaceFrameContent(state: RuntimeState, frameState: FrameState, html: string) {
  if (frameState.disposed || state.disposed) return
  disposeOwnedInsideRange(state, frameState.start, frameState.end)
  clearRange(frameState.start, frameState.end)
  let fragment = createFragmentFromString(state.doc, html)
  mergeRmxDataFromScope(state.data, fragment, state.options.onError)
  frameState.start.parentNode?.insertBefore(fragment, frameState.end)
  await hydrateContainer(state, getRangeNodes(frameState.start, frameState.end), frameState.handle)
}

function disposeOwnedInsideRange(state: RuntimeState, start: Comment, end: Comment) {
  for (let [marker, root] of Array.from(state.rootsByStart.entries())) {
    if (!isNodeInsideRange(marker, start, end)) continue
    root.dispose()
    state.rootsByStart.delete(marker)
  }
  for (let frameState of Array.from(state.frameStatesByStart.values())) {
    if (!isNodeInsideRange(frameState.start, start, end)) continue
    if (frameState.start === start) continue
    disposeFrameState(state, frameState)
  }
}

function disposeFrameState(state: RuntimeState, frameState: FrameState) {
  if (frameState.disposed) return
  frameState.disposed = true
  frameState.reloadController?.abort()
  frameState.reloadController = null
  disposeOwnedInsideRange(state, frameState.start, frameState.end)
  state.frameStatesByStart.delete(frameState.start)
  if (state.frameStatesById.get(frameState.id) === frameState) {
    state.frameStatesById.delete(frameState.id)
  }
  if (frameState.handle.name && state.namedFrames.get(frameState.handle.name) === frameState.handle) {
    state.namedFrames.delete(frameState.handle.name)
  }
}

function pruneDisconnectedRuntimeNodes(state: RuntimeState) {
  for (let [start, root] of Array.from(state.rootsByStart.entries())) {
    if (start.isConnected) continue
    root.dispose()
    state.rootsByStart.delete(start)
  }
  for (let frameState of Array.from(state.frameStatesByStart.values())) {
    if (frameState.start.isConnected) continue
    disposeFrameState(state, frameState)
  }
}

function findHydrationBoundaries(nodes: Node[], onError: (error: unknown) => void) {
  let boundaries: HydrationBoundary[] = []
  walkCommentsInNodes(nodes, onError, (comment) => {
    let marker = comment.data.trim()
    if (!marker.startsWith('rmx:h:')) return
    let id = marker.slice('rmx:h:'.length)
    if (!id) return
    let end = findEndMarker(comment, isHydrationStart, isHydrationEnd)
    boundaries.push({ id, start: comment, end })
  })
  return boundaries
}

function findFrameBoundaries(nodes: Node[], onError: (error: unknown) => void) {
  let boundaries: FrameBoundary[] = []
  walkCommentsInNodes(nodes, onError, (comment) => {
    let marker = comment.data.trim()
    if (!marker.startsWith('f:')) return
    let id = marker.slice('f:'.length)
    if (!id) return
    let end = findEndMarker(comment, isFrameStartComment, isFrameEnd)
    boundaries.push({ id, start: comment, end })
  })
  return boundaries
}

function walkCommentsInNodes(
  nodes: Node[],
  onError: (error: unknown) => void,
  onComment: (comment: Comment) => void,
) {
  for (let index = 0; index < nodes.length; index++) {
    let node = nodes[index]
    if (isFrameStart(node)) {
      try {
        let end = findEndMarker(node, isFrameStartComment, isFrameEnd)
        onComment(node)
        index = nodes.indexOf(end)
        continue
      } catch (error) {
        onError(error)
        continue
      }
    }
    if (node.nodeType === Node.COMMENT_NODE) {
      try {
        onComment(node as Comment)
      } catch (error) {
        onError(error)
      }
    }
    if (node.childNodes && node.childNodes.length > 0) {
      walkCommentsInNodes(Array.from(node.childNodes), onError, onComment)
    }
  }
}

function isHydrationBoundaryLive(boundary: HydrationBoundary) {
  if (!boundary.start.isConnected || !boundary.end.isConnected) return false
  if (boundary.start.parentNode == null) return false
  if (boundary.start.parentNode !== boundary.end.parentNode) return false
  if (boundary.start.data.trim() !== `rmx:h:${boundary.id}`) return false
  if (boundary.end.data.trim() !== '/rmx:h') return false
  return true
}

function isHydrationStart(node: Comment) {
  return node.data.trim().startsWith('rmx:h:')
}

function isHydrationEnd(node: Comment) {
  return node.data.trim() === '/rmx:h'
}

function isFrameStart(node: Node): node is Comment {
  return node instanceof Comment && node.data.trim().startsWith('f:')
}

function isFrameStartComment(node: Comment) {
  return node.data.trim().startsWith('f:')
}

function isFrameEnd(node: Comment) {
  return node.data.trim() === '/f'
}

function findEndMarker(
  start: Comment,
  isStart: (node: Comment) => boolean,
  isEnd: (node: Comment) => boolean,
) {
  let cursor: Node | null = start.nextSibling
  let depth = 1
  while (cursor) {
    if (cursor.nodeType === Node.COMMENT_NODE) {
      let comment = cursor as Comment
      if (isStart(comment)) {
        depth++
      } else if (isEnd(comment)) {
        depth--
        if (depth === 0) return comment
      }
    }
    cursor = cursor.nextSibling
  }
  throw new Error('End marker not found')
}

function clearRange(start: Comment, end: Comment) {
  let cursor = start.nextSibling
  while (cursor && cursor !== end) {
    let next = cursor.nextSibling
    cursor.parentNode?.removeChild(cursor)
    cursor = next
  }
}

function getRangeNodes(start: Comment, end: Comment) {
  let nodes: Node[] = []
  let cursor = start.nextSibling
  while (cursor && cursor !== end) {
    nodes.push(cursor)
    cursor = cursor.nextSibling
  }
  return nodes
}

function isNodeInsideRange(node: Node, start: Node, end: Node) {
  if (!node.isConnected || !start.isConnected || !end.isConnected) return false
  if (node === start || node === end) return false
  let afterStart = (start.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
  let beforeEnd = (node.compareDocumentPosition(end) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
  return afterStart && beforeEnd
}

function mergeRmxDataFromScope(
  into: RmxData,
  scope: Document | DocumentFragment,
  onError?: (error: unknown, boundaryId: null | string) => void,
) {
  let scripts = Array.from(scope.querySelectorAll('script#rmx-data'))
  for (let script of scripts) {
    if (!(script instanceof HTMLScriptElement)) continue
    let parsed: RmxData = {}
    try {
      parsed = JSON.parse(script.textContent || '{}') as RmxData
    } catch (error) {
      onError?.(error, null)
    }
    mergeRmxData(into, parsed)
    script.remove()
  }
}

function mergeRmxData(into: RmxData, from: RmxData) {
  if (from.h) {
    if (!into.h) into.h = {}
    copyOwnEntries(into.h, from.h)
  }
  if (from.f) {
    if (!into.f) into.f = {}
    copyOwnEntries(into.f, from.f)
  }
}

async function applyPendingTemplateIfAvailable(state: RuntimeState, frameState: FrameState) {
  if (frameState.status !== 'pending') return
  let queue = state.pendingFrameTemplates.get(frameState.id)
  let fragment = queue?.shift()
  if (!fragment) return
  if (queue && queue.length === 0) {
    state.pendingFrameTemplates.delete(frameState.id)
  }
  await applyFrameTemplate(state, frameState, fragment)
}

async function applyFrameTemplate(
  state: RuntimeState,
  frameState: FrameState,
  fragment: DocumentFragment,
) {
  if (state.disposed || frameState.disposed || frameState.status !== 'pending') return
  mergeRmxDataFromScope(state.data, fragment, state.options.onError)
  await replaceFrameContentFragment(state, frameState, fragment)
  frameState.status = 'resolved'
  state.runtime.flush()
}

async function replaceFrameContentFragment(
  state: RuntimeState,
  frameState: FrameState,
  fragment: DocumentFragment,
) {
  if (frameState.disposed || state.disposed) return
  disposeOwnedInsideRange(state, frameState.start, frameState.end)
  clearRange(frameState.start, frameState.end)
  frameState.start.parentNode?.insertBefore(fragment, frameState.end)
  await hydrateContainer(state, getRangeNodes(frameState.start, frameState.end), frameState.handle)
}

function startFrameTemplateObservation(state: RuntimeState) {
  if (state.templateObserver) return
  let root = state.doc.body ?? state.doc.documentElement ?? state.doc
  let observer = new MutationObserver((mutations) => {
    for (let mutation of mutations) {
      for (let node of Array.from(mutation.addedNodes)) {
        processFrameTemplateNode(state, node)
      }
    }
  })
  observer.observe(root, { childList: true, subtree: true })
  state.templateObserver = observer
}

function processExistingFrameTemplates(state: RuntimeState) {
  let templates = Array.from(state.doc.querySelectorAll('template[id]'))
  for (let template of templates) {
    if (!(template instanceof HTMLTemplateElement)) continue
    processFrameTemplateElement(state, template)
  }
}

function processFrameTemplateNode(state: RuntimeState, node: Node) {
  if (node instanceof HTMLTemplateElement) {
    processFrameTemplateElement(state, node)
    return
  }
  if (!(node instanceof Element)) return
  let templates = Array.from(node.querySelectorAll('template[id]'))
  for (let template of templates) {
    if (!(template instanceof HTMLTemplateElement)) continue
    processFrameTemplateElement(state, template)
  }
}

function processFrameTemplateElement(state: RuntimeState, template: HTMLTemplateElement) {
  let frameId = template.id
  if (!frameId) return
  let fragment = template.content
  template.remove()
  let frameState = state.frameStatesById.get(frameId)
  if (frameState && !frameState.disposed && frameState.status === 'pending') {
    void applyFrameTemplate(state, frameState, fragment).catch((error) =>
      state.options.onError?.(error, frameId),
    )
    return
  }
  let queue = state.pendingFrameTemplates.get(frameId)
  if (!queue) {
    queue = []
    state.pendingFrameTemplates.set(frameId, queue)
  }
  queue.push(fragment)
}

function copyOwnEntries<T>(target: Record<string, T>, source: Record<string, T>) {
  for (let key of Object.keys(source)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue
    if (!Object.hasOwn(source, key)) continue
    target[key] = source[key]!
  }
}

async function getOrLoadModule(
  state: RuntimeState,
  key: string,
  entry: HydrationData,
  boundaryId: string,
) {
  let cached = state.moduleCache.get(key)
  if (cached) return cached
  let existing = state.moduleLoads.get(key)
  if (existing) return existing
  let promise = (async () => {
    try {
      let loaded = await state.options.loadModule(entry.moduleUrl, entry.exportName)
      if (typeof loaded !== 'function') {
        throw new Error(
          `Export "${entry.exportName}" from "${entry.moduleUrl}" is not a component function`,
        )
      }
      let component = loaded as Component<any, any, any>
      state.moduleCache.set(key, component)
      return component
    } catch (error) {
      state.options.onError?.(error, boundaryId)
      return undefined
    } finally {
      state.moduleLoads.delete(key)
    }
  })()
  state.moduleLoads.set(key, promise)
  return promise
}

function createFragmentFromString(doc: Document, html: string) {
  let template = doc.createElement('template')
  template.innerHTML = html.trim()
  return template.content
}

async function toHTML(
  content: string | ReadableStream<Uint8Array>,
  signal: AbortSignal,
): Promise<string> {
  if (typeof content === 'string') return content
  let reader = content.getReader()
  let decoder = new TextDecoder()
  let html = ''
  try {
    while (true) {
      if (signal.aborted) {
        await reader.cancel()
        break
      }
      let { done, value } = await reader.read()
      if (done) break
      if (value) {
        html += decoder.decode(value, { stream: true })
      }
    }
    html += decoder.decode()
    return html
  } finally {
    reader.releaseLock()
  }
}

function reviveSerializedObject(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  let revived = reviveSerializedValue(value)
  if (!revived || typeof revived !== 'object' || Array.isArray(revived)) return {}
  return revived as Record<string, unknown>
}

function reviveSerializedValue(value: unknown): unknown {
  if (value == null) return value
  if (typeof value !== 'object') return value
  if (Array.isArray(value)) {
    return value.map((entry) => reviveSerializedValue(entry))
  }
  let record = value as Record<string, unknown>
  if (record.$rmx === true && typeof record.type === 'string') {
    let props = reviveSerializedObject(record.props)
    let key = reviveSerializedValue(record.key)
    return jsx(record.type as any, props as any, key as any)
  }
  let output: Record<string, unknown> = {}
  for (let key in record) {
    output[key] = reviveSerializedValue(record[key])
  }
  return output
}
