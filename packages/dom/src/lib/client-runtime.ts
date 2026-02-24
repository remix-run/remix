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
) => Promise<Function> | Function

export type ResolveFrame = (
  src: string,
  signal?: AbortSignal,
) => Promise<string | ReadableStream<Uint8Array>> | string | ReadableStream<Uint8Array>

export type BootOptions = {
  document?: Document
  loadModule: ClientModuleLoader
  resolveFrame?: ResolveFrame
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

export class RuntimeErrorEvent extends Event {
  error: unknown
  boundaryId: null | string

  constructor(error: unknown, boundaryId: null | string) {
    super('error')
    this.error = error
    this.boundaryId = boundaryId
  }
}

type RuntimeState = {
  doc: Document
  options: BootOptions
  data: RmxData
  moduleCache: Map<string, Function>
  moduleLoads: Map<string, Promise<Function | undefined>>
  rootsByStart: Map<Comment, ReconcilerRoot>
  frameStatesByStart: Map<Comment, FrameState>
  frameStatesById: Map<string, FrameState>
  namedFrames: Map<string, FrameHandle>
  pendingFrameTemplates: Map<string, DocumentFragment[]>
  templateObserver: null | MutationObserver
  pendingHydrationPass: boolean
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
    pendingHydrationPass: false,
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
      mergeRmxDataFromScope(state, state.data, doc)
      startFrameTemplateObservation(state)
      processExistingFrameTemplates(state)
      let container = doc.body ?? doc.documentElement ?? doc
      pruneDisconnectedRuntimeNodes(state)
      await hydrateContainer(state, Array.from(container.childNodes), topFrame)
      runtime.flush()
    } catch (error) {
      reportRuntimeError(state, error, null)
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
  let hydrationBoundaries = findHydrationBoundaries(nodes, (error) =>
    reportRuntimeError(state, error, null),
  )
  let hydrationJobs = hydrationBoundaries.map((boundary) => hydrateBoundary(state, boundary, ownerFrame))
  await Promise.all(hydrationJobs)

  let frameBoundaries = findFrameBoundaries(nodes, (error) => reportRuntimeError(state, error, null))
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
    reportRuntimeError(state, error, boundary.id)
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
  let fragment = createFragmentFromString(state.doc, html)
  mergeRmxDataFromScope(state, state.data, fragment)
  diffRangeWithFragment(state, frameState.start, frameState.end, fragment)
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

function isHydrationStartComment(node: Node): node is Comment {
  return node instanceof Comment && isHydrationStart(node)
}

function isHydrationEndComment(node: Node): node is Comment {
  return node instanceof Comment && isHydrationEnd(node)
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

function isTextNode(node: Node): node is Text {
  return node.nodeType === Node.TEXT_NODE
}

function isElementNode(node: Node): node is Element {
  return node.nodeType === Node.ELEMENT_NODE
}

function isCommentNode(node: Node): node is Comment {
  return node.nodeType === Node.COMMENT_NODE
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
  state: RuntimeState,
  into: RmxData,
  scope: Document | DocumentFragment,
) {
  let scripts = Array.from(scope.querySelectorAll('script#rmx-data'))
  for (let script of scripts) {
    if (!(script instanceof HTMLScriptElement)) continue
    let parsed: RmxData = {}
    try {
      parsed = JSON.parse(script.textContent || '{}') as RmxData
    } catch (error) {
      reportRuntimeError(state, error, null)
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
  mergeRmxDataFromScope(state, state.data, fragment)
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
  diffRangeWithFragment(state, frameState.start, frameState.end, fragment)
  await hydrateContainer(state, getRangeNodes(frameState.start, frameState.end), frameState.handle)
}

function diffRangeWithFragment(
  state: RuntimeState,
  start: Comment,
  end: Comment,
  fragment: DocumentFragment,
) {
  let parent = start.parentNode
  if (!parent || parent !== end.parentNode) return
  let current = getRangeNodes(start, end)
  let next = Array.from(fragment.childNodes)
  diffNodes(state, parent, current, next, end)
}

function diffNodes(
  state: RuntimeState,
  parent: Node,
  currentNodes: Node[],
  nextNodes: Node[],
  tailRef: ChildNode | null,
) {
  let maxLength = Math.max(currentNodes.length, nextNodes.length)
  for (let index = 0; index < maxLength; index++) {
    let current = currentNodes[index]
    let next = nextNodes[index]
    if (!current && next) {
      parent.insertBefore(next, tailRef)
      continue
    }
    if (current && !next) {
      disposeNodeRuntime(state, current)
      parent.removeChild(current)
      continue
    }
    if (!current || !next) continue
    let cursor = diffNode(state, current, next)
    if (cursor) {
      index = nextNodes.indexOf(cursor)
    }
  }
}

function diffNode(state: RuntimeState, current: Node, next: Node): null | ChildNode {
  if (isTextNode(current) && isTextNode(next)) {
    if (current.textContent !== next.textContent) {
      current.textContent = next.textContent
    }
    return null
  }

  if (isHydrationStartComment(current) && isHydrationStartComment(next)) {
    if (current.data !== next.data) {
      current.data = next.data
    }
    return findEndMarker(next, isHydrationStart, isHydrationEnd)
  }

  if (isCommentNode(current) && isCommentNode(next)) {
    if (current.data !== next.data) {
      current.data = next.data
    }
    return null
  }

  if (isElementNode(current) && isElementNode(next)) {
    if (current.tagName !== next.tagName) {
      let parent = current.parentNode
      if (!parent) return null
      disposeNodeRuntime(state, current)
      parent.replaceChild(next, current)
      return null
    }
    diffElementAttributes(current, next)
    diffElementChildren(state, current, next)
    return null
  }

  let parent = current.parentNode
  if (!parent) return null
  disposeNodeRuntime(state, current)
  parent.replaceChild(next, current)
  return null
}

function diffElementAttributes(current: Element, next: Element) {
  let previousNames = current.getAttributeNames()
  let nextNames = next.getAttributeNames()
  let nextNameSet = new Set(nextNames)

  for (let name of previousNames) {
    if (!nextNameSet.has(name)) {
      current.removeAttribute(name)
    }
  }

  for (let name of nextNames) {
    let previousValue = current.getAttribute(name)
    let nextValue = next.getAttribute(name)
    if (previousValue !== nextValue) {
      current.setAttribute(name, nextValue == null ? '' : String(nextValue))
    }
  }
}

function diffElementChildren(state: RuntimeState, current: Element, next: Element) {
  let currentChildren = Array.from(current.childNodes)
  let nextChildren = Array.from(next.childNodes)
  let used = new Array<boolean>(currentChildren.length).fill(false)
  let keyToIndex = new Map<string, number>()

  for (let index = 0; index < currentChildren.length; index++) {
    let node = currentChildren[index]
    if (!isElementNode(node)) continue
    let key = node.getAttribute('data-key')
    if (key == null) continue
    keyToIndex.set(key, index)
  }

  let matchIndexForNext = new Array<number>(nextChildren.length).fill(-1)
  for (let index = 0; index < nextChildren.length; index++) {
    let nextChild = nextChildren[index]
    let matchIndex = -1
    if (isElementNode(nextChild)) {
      let key = nextChild.getAttribute('data-key')
      if (key != null) {
        let mapped = keyToIndex.get(key)
        if (mapped !== undefined && !used[mapped]) {
          matchIndex = mapped
        }
      }
    }
    if (
      matchIndex === -1 &&
      index < currentChildren.length &&
      !used[index] &&
      areComparableNodeTypes(currentChildren[index]!, nextChild)
    ) {
      matchIndex = index
    }
    if (matchIndex !== -1) {
      used[matchIndex] = true
    }
    matchIndexForNext[index] = matchIndex
  }

  let committed: Array<undefined | Node> = new Array(nextChildren.length)
  for (let index = 0; index < nextChildren.length; index++) {
    let matchIndex = matchIndexForNext[index]
    if (matchIndex === -1) {
      committed[index] = nextChildren[index]
      continue
    }
    let currentChild = currentChildren[matchIndex]!
    let cursor = diffNode(state, currentChild, nextChildren[index]!)
    if (!cursor) {
      committed[index] = currentChild
      continue
    }
    let nextEndIndex = nextChildren.indexOf(cursor)
    let currentEndIndex = findHydrationEndIndex(currentChildren, matchIndex)
    for (let rangeIndex = matchIndex; rangeIndex <= currentEndIndex; rangeIndex++) {
      used[rangeIndex] = true
    }
    committed[index] = currentChild
    committed[nextEndIndex] = currentChildren[currentEndIndex]
    for (let skip = index + 1; skip < nextEndIndex; skip++) {
      committed[skip] = undefined
    }
    index = nextEndIndex
  }

  let anchor: null | Node = null
  for (let index = committed.length - 1; index >= 0; index--) {
    let node = committed[index]
    if (!node) continue
    let ref = anchor && anchor.parentNode === current ? anchor : null
    if (isHydrationStartComment(node) || isHydrationEndComment(node)) {
      if (node.parentNode !== current) {
        current.insertBefore(node, ref)
      }
      anchor = node
      continue
    }
    if (node.parentNode === current) {
      let targetNext = ref
      let inPlace =
        (targetNext === null && node.nextSibling === null) || node.nextSibling === targetNext
      if (!inPlace) {
        current.insertBefore(node, targetNext)
      }
    } else {
      current.insertBefore(node, ref)
    }
    if (node.parentNode === current) {
      anchor = node
    }
  }

  for (let index = 0; index < currentChildren.length; index++) {
    if (used[index]) continue
    let node = currentChildren[index]!
    disposeNodeRuntime(state, node)
    current.removeChild(node)
  }
}

function disposeNodeRuntime(state: RuntimeState, node: Node) {
  if (isHydrationStartComment(node)) {
    let root = state.rootsByStart.get(node)
    if (root) {
      root.dispose()
      state.rootsByStart.delete(node)
    }
  }
  if (isFrameStart(node)) {
    let frameState = state.frameStatesByStart.get(node)
    if (frameState) {
      disposeFrameState(state, frameState)
      return
    }
  }
  for (let child of Array.from(node.childNodes)) {
    disposeNodeRuntime(state, child)
  }
}

function areComparableNodeTypes(current: Node, next: Node) {
  if (isTextNode(current) && isTextNode(next)) return true
  if (isElementNode(current) && isElementNode(next)) return current.tagName === next.tagName
  if (isHydrationStartComment(current) && isHydrationStartComment(next)) return true
  if (isHydrationEndComment(current) && isHydrationEndComment(next)) return true
  if (isCommentNode(current) && isCommentNode(next)) return true
  return false
}

function findHydrationEndIndex(nodes: Node[], startIndex: number) {
  for (let index = startIndex + 1; index < nodes.length; index++) {
    if (isHydrationEndComment(nodes[index]!)) return index
  }
  return startIndex
}

function startFrameTemplateObservation(state: RuntimeState) {
  if (state.templateObserver) return
  let root = state.doc.body ?? state.doc.documentElement ?? state.doc
  let observer = new MutationObserver((mutations) => {
    for (let mutation of mutations) {
      for (let node of Array.from(mutation.addedNodes)) {
        processAddedRuntimeNode(state, node)
      }
    }
  })
  observer.observe(root, { childList: true, subtree: true })
  state.templateObserver = observer
}

function processAddedRuntimeNode(state: RuntimeState, node: Node) {
  processFrameTemplateNode(state, node)
  if (nodeHasRuntimeBoundaryStart(node) || isRmxDataScriptNode(node)) {
    scheduleHydrationPass(state)
  }
}

function scheduleHydrationPass(state: RuntimeState) {
  if (state.pendingHydrationPass || state.disposed) return
  state.pendingHydrationPass = true
  queueMicrotask(() => {
    state.pendingHydrationPass = false
    if (state.disposed) return
    let container = state.doc.body ?? state.doc.documentElement ?? state.doc
    void hydrateContainer(state, Array.from(container.childNodes), state.runtime.frame)
      .then(() => {
        state.runtime.flush()
      })
      .catch((error) => {
        reportRuntimeError(state, error, null)
      })
  })
}

function isRmxDataScriptNode(node: Node) {
  return (
    node instanceof HTMLScriptElement &&
    node.id === 'rmx-data' &&
    node.getAttribute('type') === 'application/json'
  )
}

function nodeHasRuntimeBoundaryStart(node: Node): boolean {
  if (node instanceof Comment) {
    let marker = node.data.trim()
    return marker.startsWith('rmx:h:') || marker.startsWith('f:')
  }
  for (let child of Array.from(node.childNodes)) {
    if (nodeHasRuntimeBoundaryStart(child)) {
      return true
    }
  }
  return false
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
  let fragment = template.content.cloneNode(true) as DocumentFragment
  template.remove()
  let frameState = state.frameStatesById.get(frameId)
  if (frameState && !frameState.disposed && frameState.status === 'pending') {
    void applyFrameTemplate(state, frameState, fragment).catch((error) =>
      reportRuntimeError(state, error, frameId),
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
      let component = loaded as Function
      state.moduleCache.set(key, component)
      return component
    } catch (error) {
      reportRuntimeError(state, error, boundaryId)
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

function reportRuntimeError(state: RuntimeState, error: unknown, boundaryId: null | string) {
  queueMicrotask(() => {
    if (state.disposed) return
    state.runtime.dispatchEvent(new RuntimeErrorEvent(error, boundaryId))
  })
}
