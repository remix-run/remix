import { getNonceManager, type ResourceNonces } from './nonce.ts'
import { jsx } from './core/vnode.ts'
import {
  Fragment,
  FRAME_NODE,
  createComponentErrorEvent,
  createFrameHandle,
  createFrameReloadStartEvent,
  getComponentError,
  type FrameContent,
  type FrameProps,
  type Handle,
  type RenderFn,
  type ReloadOrigin,
} from './component.ts'
import { invariant } from './invariant.ts'
import { createFormSubmissionEvent, encodeFormDataAsSearchParams } from './form-navigation.ts'
import type { RemixElement, RemixNode } from './core/vnode.ts'
import type { ElementFunction } from './element-function.ts'
import type { FrameHandle, FrameReloadOptions } from './component.ts'
import type { Scheduler, VirtualRoot } from './vdom.ts'
import { createRangeRoot, createRoot } from './vdom.ts'
import {
  createFrameRuntime,
  disposeClientEntryBoundary,
  getClientEntryBoundaryOwner,
  getFrameRuntime,
  getSharedFrameRuntime,
  isFrameRuntime,
  setClientEntryBoundaryOwner,
  type ClientEntryIdentity,
  type FrameMountState,
  type FrameNavigationOptions,
  type FrameReloadResult,
  type FrameReloadTransition,
  type FrameRuntime,
  type LoadModule,
  type NamedFrameRegistry,
  type PendingClientEntries,
  type ReconciliationTracker,
  type ResolveFrame,
} from './frame-runtime.ts'
import {
  findContextFromAncestry,
  insertDomNode,
  remove,
  type CommittedFrameNode,
  type FrameNode,
  type FrameNodeRenderer,
  type HydrationCursor,
  type ReconcileContext,
  type VNodeParent,
} from './reconcile.ts'
import {
  collectNodesBetween,
  diffElementAttributes,
  diffNodes,
  findEndMarker,
  getClientEntryKey,
} from './diff-dom.ts'
import { createStyleManager, type StyleManager } from '../style/stylesheet.ts'
import { css } from '../style/css-mixin.ts'
import { createMixin } from './mixins/mixin.ts'
import type { CSSProps } from '../style/style.ts'
import {
  createFrameStartMarker,
  findFlushMarker,
  FRAME_END_MARKER,
  type FlushKind,
  getFrameId,
  getHydrationId,
  isFrameEnd,
  isFrameStart,
  isFrameTemplateEnd,
  isHydrationEnd,
  isHydrationStart,
} from './stream-protocol.ts'
import { getDocumentModulePreloader, type ProcessClientEntryPreloads } from './module-preloader.ts'
import { unwrapFrameResolution } from './spa-response.ts'
import {
  commitFrameResponse,
  getFrameCommitNavigation,
  setFrameCommitNavigation,
  takeFrameCommit,
  type FrameCommit,
} from './frame-commit.ts'
import { getDocumentImportMapManager } from './import-map-manager.ts'
import { ESCAPED_OBJECT } from './props-serialization.ts'

type FrameRoot = [Comment, Comment] | Element | Document | DocumentFragment

type FrameData = {
  status: 'pending' | 'resolved' | 'lazy'
  name?: string
  src: string
}

type HydrationData = {
  moduleUrl: string
  exportName: string
  props: Record<string, unknown>
}

type RmxData = {
  h?: Record<string, HydrationData>
  f?: Record<string, FrameData>
}

export type VirtualRootMarker = Comment & {
  $rmx: ReturnType<typeof createRangeRoot>
}

type FrameMarkerData = FrameData & {
  id: string
}

// Frames of the most recently started run() runtime, for module-level helpers that have no
// runtime reference: targeted prefetching and updateUrl().
let appFrames: Handle['frames'] | undefined

export function setAppFrames(frames: Handle['frames']): () => void {
  appFrames = frames
  return () => {
    if (appFrames === frames) appFrames = undefined
  }
}

export function setTopFrameSource(src: string): void {
  if (appFrames) appFrames.top.src = src
}

/**
 * Returns a named frame handle.
 *
 * @param name Name of the frame to look up.
 * @returns The matching frame handle, or `undefined` when not found.
 */
export function getNamedFrame(name: string): FrameHandle | undefined {
  return appFrames?.get(name)
}

type InternalFrameContent = FrameContent | DocumentFragment

type ReloadFailure = { error: unknown; aborted?: false } | { aborted: true }

type ReloadFinished = PromiseWithResolvers<AbortSignal> & { controller: AbortController }

type FrameTemplateListener = (fragment: DocumentFragment) => void

const bufferedFrameTemplates = new Map<string, DocumentFragment[]>()
const frameTemplateListeners = new Map<string, Set<FrameTemplateListener>>()
const pendingClientEntryHydrations = new WeakMap<Comment, Promise<void>>()
const frameClientEntryParents = new WeakMap<Comment, Comment>()
let frameLoadPool:
  | {
      observer: IntersectionObserver
      callbacks: Map<Element, Set<() => void>>
      dispose: () => void
    }
  | undefined

export const pendingPrefetchLinks = new WeakSet<Node>()

function observeFrameLoad(targets: Element[], load: () => void): () => void {
  let pool = frameLoadPool
  if (!pool) {
    let callbacks = new Map<Element, Set<() => void>>()
    let resizeTimer: ReturnType<typeof setTimeout> | undefined

    function createObserver(): IntersectionObserver {
      return new IntersectionObserver(
        (entries, observer) => {
          if (frameLoadPool?.observer !== observer) return
          for (let entry of entries) {
            if (!entry.isIntersecting || !entry.target.isConnected) continue
            for (let callback of Array.from(callbacks.get(entry.target) ?? [])) callback()
          }
        },
        { root: document, rootMargin: `${window.innerHeight}px ${window.innerWidth}px` },
      )
    }

    function resize(): void {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        resizeTimer = undefined
        let current = frameLoadPool
        if (!current || current.callbacks !== callbacks) return
        current.observer.disconnect()
        current.observer = createObserver()
        for (let target of callbacks.keys()) current.observer.observe(target)
      }, 100)
    }

    pool = {
      observer: createObserver(),
      callbacks,
      dispose() {
        clearTimeout(resizeTimer)
        this.observer.disconnect()
        window.removeEventListener('resize', resize)
      },
    }
    frameLoadPool = pool
    window.addEventListener('resize', resize)
  }

  let { callbacks } = pool
  for (let target of targets) {
    let targetCallbacks = callbacks.get(target)
    if (!targetCallbacks) {
      targetCallbacks = new Set()
      callbacks.set(target, targetCallbacks)
      pool.observer.observe(target)
    }
    targetCallbacks.add(load)
  }

  return () => {
    if (frameLoadPool !== pool) return
    for (let target of targets) {
      let targetCallbacks = callbacks.get(target)
      if (!targetCallbacks?.delete(load)) continue
      if (targetCallbacks.size === 0) {
        callbacks.delete(target)
        pool.observer.unobserve(target)
      }
    }
    if (callbacks.size === 0) {
      pool.dispose()
      frameLoadPool = undefined
    }
  }
}

function createLinkedAbortController(...signals: Array<AbortSignal | undefined>): {
  controller: AbortController
  disconnect: () => void
} {
  let controller = new AbortController()
  let abort = () => controller.abort()

  for (let signal of signals) {
    if (!signal) continue
    if (signal.aborted) {
      controller.abort()
      break
    }
    signal.addEventListener('abort', abort, { once: true })
  }

  return {
    controller,
    disconnect() {
      for (let signal of signals) {
        signal?.removeEventListener('abort', abort)
      }
    },
  }
}

// Marker-less HTML is a whole document when it starts with a doctype or `<html>`.
// `renderToString` strips flush markers before returning, and so does any comment-stripping
// minifier run over static output, so the marker alone cannot tell the two apart here.
// Diffing such HTML as a fragment parses it inside a `<template>`, which drops the
// `<html>`/`<head>`/`<body>` wrappers and makes the document diff throw HierarchyRequestError.
const FULL_DOCUMENT_PATTERN = /^\s*(?:<!doctype\b|<html\b)/i

function inferFlushKind(html: string): FlushKind {
  return FULL_DOCUMENT_PATTERN.test(html) ? 'document' : 'fragment'
}

/**
 * Reloads a frame and returns response metadata used by the navigation runtime.
 *
 * @param frame Frame handle to reload.
 * @param options Form submission metadata and cancellation signal.
 * @returns The reload signal and final response URL, when redirected.
 */
export function reloadFrameForNavigation(
  frame: FrameHandle,
  options?: FrameNavigationOptions,
): FrameReloadTransition {
  let runtime = frame.$runtime
  invariant(isFrameRuntime(runtime), 'Expected a frame runtime')
  let reload = runtime.reloadForNavigation
  invariant(reload, 'Expected frame runtime to support navigation reloads')
  return reload(options)
}

export type FrameContext = {
  reloadOrigin?: ReloadOrigin
  nonce?: string
  transition?: NavigationTransition
  topFrame?: FrameHandle
  getContext: (type: ElementFunction) => unknown
  errorTarget: EventTarget
  loadModule: LoadModule
  resolveFrame: ResolveFrame
  pendingClientEntries: PendingClientEntries
  scheduler: Scheduler
  frame: FrameHandle
  styleManager: StyleManager
  data: RmxData
  moduleCache: Map<string, ElementFunction>
  moduleLoads: Map<string, Promise<ElementFunction | undefined>>
  frameInstances: WeakMap<Comment, FrameInstance>
  namedFrames: NamedFrameRegistry
  processClientEntryPreloads?: ProcessClientEntryPreloads
  lifecycleSignal: AbortSignal
  regionTailRef?: ChildNode | null
  regionParent?: ParentNode | null
  signal?: AbortSignal
  shouldPreserveHeadNode?: (node: Node) => boolean
  reconciliationTracker?: ReconciliationTracker
  blockingFrameTracker?: ReconciliationTracker
}

type FrameInit = {
  nonce?: string
  transition?: NavigationTransition
  signal?: AbortSignal
  name?: string
  loading?: FrameProps['loading']
  topFrame?: FrameHandle
  getContext?: (type: ElementFunction) => unknown
  src: string
  errorTarget: EventTarget
  loadModule: LoadModule
  resolveFrame: ResolveFrame
  pendingClientEntries: PendingClientEntries
  scheduler: Scheduler
  styleManager?: StyleManager
  marker?: FrameMarkerData
  data: RmxData
  moduleCache: Map<string, ElementFunction>
  moduleLoads: Map<string, Promise<ElementFunction | undefined>>
  frameInstances: WeakMap<Comment, FrameInstance>
  namedFrames: NamedFrameRegistry
  processClientEntryPreloads?: ProcessClientEntryPreloads
  disposeFallback?: () => void
}

// The active reload and its completion outcome. Superseded requests finish as aborted without
// dispatching reloadComplete; ancestor resolution can continue an inherited reload.
type FrameReloadState =
  | { status: 'idle' }
  // An ancestor reload is replacing this frame's content. It completes when that content renders
  // or the ancestor's signal aborts.
  | {
      status: 'inherited'
      disconnect: (() => void) | undefined
      finished: ReloadFinished
      origin?: ReloadOrigin
    }
  // This frame is resolving its own source, either for `frame.reload()` or because an ancestor
  // reload re-resolves this client frame.
  | {
      status: 'direct' | 'ancestor'
      controller: AbortController
      disconnect: () => void
      finished: ReloadFinished
      origin?: ReloadOrigin
    }

type FrameLoadOrigin = 'initial' | 'direct' | 'ancestor'

// These regions are independent: resolved content can remain visible during a request, and a
// settled request retains its controller while waiting for visibility again. Commit wrappers can
// remain active after rendering while they await navigation completion or animation.
type FrameLoadState = {
  reload: FrameReloadState
  eventController: AbortController | undefined
  lifecycle: 'active' | 'disposed'
  policy: 'eager' | 'lazy'
  content: 'pending' | 'started' | 'resolved'
  request: { status: 'idle' } | { status: 'loading' | 'settled'; controller: AbortController }
  commit: { status: 'idle' } | { status: 'active'; controller: AbortController }
  observation:
    | { status: 'inactive' }
    | { status: 'observing'; load: () => void; disconnect: () => void }
}

type FrameLoadEvent =
  | {
      type: 'start'
      origin: FrameLoadOrigin
      signal?: AbortSignal
      reloadOrigin?: ReloadOrigin
      form?: HTMLFormElement
    }
  | { type: 'settle'; controller: AbortController; failure?: ReloadFailure }
  | { type: 'reject'; controller: AbortController; error: unknown }
  | { type: 'inherit'; signal?: AbortSignal; origin?: ReloadOrigin; takeOverRequest: boolean }
  | { type: 'complete-inherited'; failure?: ReloadFailure }
  | { type: 'reject-inherited'; error: unknown }
  | { type: 'start-commit' }
  | { type: 'cancel-commit' }
  | { type: 'render-start' }
  | { type: 'render-complete' }
  | { type: 'defer'; load?: () => void }
  | { type: 'activate' }
  | { type: 'cancel-deferral' }
  | { type: 'policy'; loading: FrameProps['loading'] }
  | { type: 'dispose' }

type PendingTemplateWatch = {
  markerId: string
  signal: AbortSignal | undefined
  onResolved?: () => void
  dispose?: () => void
}

export type FrameInstance = {
  commitResponse: (
    response: Response,
    commit: FrameCommit,
    render: () => Promise<void>,
    signal: AbortSignal,
    to: string,
  ) => Promise<void>
  render: (content: InternalFrameContent, options?: RenderOptions) => Promise<void>
  ready: () => Promise<void>
  flush: () => void
  clearPendingTemplateWatch: () => void
  isDisplayingResolvedContent: () => boolean
  shouldLoadForAncestorReload: () => boolean
  updateLoading: (loading: FrameProps['loading']) => void
  deferLoad: (load?: () => void) => void
  startDeferredLoad: () => void
  startLoad: (
    origin: FrameLoadOrigin,
    signal?: AbortSignal,
    reloadOrigin?: ReloadOrigin,
  ) => AbortController
  rejectLoad: (controller: AbortController, error: unknown) => void
  completeLoad: (controller: AbortController, failure?: ReloadFailure) => void
  startInheritedReload: (
    signal?: AbortSignal,
    origin?: ReloadOrigin,
    takeOverRequest?: boolean,
  ) => void
  rejectInheritedReloadFinished: (error: unknown) => void
  completeInheritedReload: (failure?: ReloadFailure) => void
  updateMarker: (marker: FrameMarkerData, options?: RenderOptions) => Promise<void>
  renderMarkerContent: (
    marker: FrameMarkerData,
    content: InternalFrameContent,
    options?: RenderOptions,
  ) => Promise<void>
  matchesIdentity: (src: string, name: string | undefined) => boolean
  dispose: () => void
  handle: FrameHandle
}

type RenderOptions = {
  reloadOrigin?: ReloadOrigin
  nonce?: string
  transition?: NavigationTransition
  documentHref?: string
  flushKind?: FlushKind
  reconciliationTracker?: ReconciliationTracker
  blockingFrameTracker?: ReconciliationTracker
  onCommit?: () => void
  signal?: AbortSignal
  data?: RmxData
}

type ActiveRenderOptions = RenderOptions & {
  data: RmxData
}

export function createFrame(root: FrameRoot, init: FrameInit): FrameInstance {
  let container = createContainer(root)
  let nonceManager = getNonceManager()
  let contentRoot: VirtualRoot | undefined
  // The style registry is document-level and shared by every frame; only the
  // frame that created it (the runtime root) disposes it.
  let ownsStyleManager = !init.styleManager
  let styleManager = init.styleManager ?? createStyleManager()
  let modulePreloader = getDocumentModulePreloader(container.doc)
  let importMapManager = getDocumentImportMapManager(container.doc)
  let currentMarker = init.marker
  let loadState: FrameLoadState = {
    reload: { status: 'idle' },
    eventController: undefined,
    lifecycle: 'active',
    policy: init.loading ?? (init.marker?.status === 'lazy' ? 'lazy' : 'eager'),
    content: init.marker?.status === 'resolved' ? 'resolved' : 'pending',
    request: { status: 'idle' },
    commit: { status: 'idle' },
    observation: { status: 'inactive' },
  }
  let pendingTemplateWatch: PendingTemplateWatch | undefined
  let pendingTemplateRender:
    | { markerId: string; controller: AbortController | undefined; ready: Promise<void> }
    | undefined
  let lifecycleController = new AbortController()

  async function consumeClientEntryResources(
    source: ParentNode,
    documentHref?: string,
    responseNonce?: string,
  ): Promise<boolean> {
    nonceManager.prepareResponse(source, responseNonce)
    let importMapStatus = importMapManager.consumeImportMaps(source)
    if (importMapStatus !== 'ready') {
      lifecycleController.abort()
      if (importMapStatus === 'conflict') reloadDocument(container.doc, documentHref)
      return false
    }
    await modulePreloader.consumePreloadLinks(source, init.processClientEntryPreloads)
    return true
  }

  let initialClientEntryResources: Promise<boolean> | undefined
  function shouldPreserveManagedHeadNode(node: Node): boolean {
    return (
      pendingPrefetchLinks.has(node) ||
      nonceManager.shouldPreserveHeadNode(node) ||
      importMapManager.shouldPreserveHeadNode(node) ||
      (modulePreloader.hasActivePreloads() && modulePreloader.isActivePreload(node))
    )
  }

  if (isDocumentNode(container.root)) {
    modulePreloader.adoptInitialPreloadLinks(container.root)
  } else {
    initialClientEntryResources = consumeClientEntryResources(container.root)
  }

  // Merge any rmx-data found in the current document once at startup.
  mergeRmxDataFrom(init.data, container.doc)

  let runtime = createFrameRuntime({
    ...init,
    styleManager,
    reloadForNavigation: startReloadTransition,
  })

  let frame = createFrameHandle({
    src: init.src,
    $runtime: runtime,
    reload: async (options) => (await reload(options)).signal,
    replace: async (content: FrameContent) => {
      transitionLoad({ type: 'cancel-commit' })
      await render(content)
    },
  })
  runtime.topFrame = runtime.topFrame ?? init.topFrame ?? frame

  let frameName = init.marker?.name ?? init.name
  if (frameName) {
    init.namedFrames.register(frameName, frame)
  }

  let context: FrameContext = {
    nonce: init.nonce,
    transition: init.transition,
    topFrame: runtime.topFrame,
    getContext: (type) => runtime.getContext?.(type),
    ...getSharedFrameRuntime(runtime),
    frame,
    data: init.data,
    lifecycleSignal: lifecycleController.signal,
    regionTailRef: container.regionTailRef,
    regionParent: container.regionParent,
  }

  async function render(content: InternalFrameContent, options?: RenderOptions): Promise<void> {
    if (isRenderAborted(options?.signal)) return
    let ownsData = options?.data === undefined
    let renderOptions: ActiveRenderOptions = {
      ...options,
      data: options?.data ?? {},
    }

    try {
      await renderContent(content, renderOptions)
    } finally {
      if (ownsData) clearRmxData(renderOptions.data)
    }
  }

  async function renderContent(
    content: InternalFrameContent,
    options: ActiveRenderOptions,
  ): Promise<void> {
    if (isRenderAborted(options.signal)) return
    transitionLoad({ type: 'render-start' })

    if (content instanceof ReadableStream) {
      let linkedAbort = createLinkedAbortController(lifecycleController.signal, options.signal)
      try {
        await renderFrameStream(
          content,
          container.doc,
          async (html, flushKind) => {
            if (isRenderAborted(options.signal)) return
            await render(html, { ...options, flushKind })
          },
          options.nonce,
          linkedAbort.controller.signal,
        )
      } finally {
        linkedAbort.disconnect()
      }
      return
    }

    if (isRemixNodeFrameContent(content)) {
      init.disposeFallback?.()
      if (!contentRoot) {
        let currentNodes = getContentNodes()
        removeVirtualRoots(currentNodes)
        disposeSubFrames(currentNodes, context)
        clearFrameContent()
        if (container.root instanceof Document) {
          contentRoot = createFrameRoot(container.doc.body, context)
        } else {
          invariant(Array.isArray(root), 'Expected comment-bounded frame root')
          contentRoot = createFrameRoot(root, context)
        }
      }

      if (isRenderAborted(options.signal)) return
      let previousServerFrameReload = runtime.serverFrameReload
      if (options.signal) {
        runtime.serverFrameReload = {
          signal: options.signal,
          origin: options.reloadOrigin,
          transition: options.transition,
          reconciliationTracker: options.reconciliationTracker,
          blockingFrameTracker: options.blockingFrameTracker,
        }
      }

      try {
        contentRoot.render(content)
        await new Promise<void>((resolve) => context.scheduler.enqueueCommitPhase([resolve]))
        if (!isRenderAborted(options.signal)) transitionLoad({ type: 'render-complete' })
        options.onCommit?.()
      } finally {
        runtime.serverFrameReload = previousServerFrameReload
      }

      return
    }

    if (contentRoot) {
      contentRoot.dispose()
      contentRoot = undefined
    }

    let source: HTMLElement | DocumentFragment
    if (typeof content === 'string') {
      let flushed = await consumeFlushBatches(content, async (html, flushKind) => {
        await render(html, { ...options, flushKind })
      })
      if (flushed.applied) {
        if (flushed.remainder !== '') {
          await render(flushed.remainder, { ...options, flushKind: 'fragment' })
        }
        return
      }
      source =
        container.root instanceof Document &&
        (options.flushKind ?? inferFlushKind(content)) === 'document'
          ? parseDocument(container.doc, content)
          : createFragmentFromString(container.doc, content)
    } else {
      source = content
    }

    if (!(await consumeClientEntryResources(source, options.documentHref, options.nonce))) return
    if (isRenderAborted(options.signal)) return
    init.disposeFallback?.()
    adoptFrameServerStyles(createElementContainer(source), context.styleManager)
    if (source instanceof DocumentFragment) removeEmptyHeads(source)
    mergeRmxDataFrom(options.data, source)
    let responseContext = {
      ...context,
      reloadOrigin: options.reloadOrigin,
      nonce: options.nonce,
      transition: options.transition,
      data: options.data,
      reconciliationTracker: options.reconciliationTracker,
      blockingFrameTracker: options.blockingFrameTracker,
    }
    let hydrationContainer = container

    if (source instanceof HTMLElement) {
      let head = source.querySelector('head')
      let body = source.querySelector('body')
      invariant(head && body, 'Missing document head or body')
      diffElementAttributes(container.doc.documentElement, source)

      let documentContext = {
        ...responseContext,
        regionParent: container.doc.documentElement,
        regionTailRef: null,
        signal: options.signal,
      }
      diffNodes([container.doc.head], [head], {
        ...documentContext,
        shouldPreserveHeadNode: shouldPreserveManagedHeadNode,
      })
      diffNodes([container.doc.body], [body], documentContext)

      hydrationContainer = createElementContainer(container.doc.body)
      if (isRenderAborted(options.signal)) return
    } else {
      if (isRenderAborted(options.signal)) return

      diffNodes(container.childNodes, Array.from(source.childNodes), {
        ...responseContext,
        regionTailRef: container.regionTailRef,
        regionParent: container.regionParent,
        signal: options.signal,
      })
    }

    let subFramesReady = hydrateContainer(hydrationContainer, responseContext, options)
    // Visible content can reload in place while its sub-frames are still settling.
    if (!isRenderAborted(options.signal)) transitionLoad({ type: 'render-complete' })
    options.onCommit?.()
    await subFramesReady
  }

  function isRenderAborted(signal?: AbortSignal): boolean {
    return (
      loadState.lifecycle === 'disposed' ||
      lifecycleController.signal.aborted ||
      signal?.aborted === true
    )
  }

  function getContentNodes(): Node[] {
    return container.root instanceof Document
      ? Array.from(container.doc.body.childNodes)
      : container.childNodes
  }

  function clearFrameContent() {
    for (let node of getContentNodes()) {
      node.parentNode?.removeChild(node)
    }
  }

  async function hydrateInitial(): Promise<void> {
    let reconciliationTracker = createReconciliationTracker()

    if ((await initialClientEntryResources) === false) return
    if (isRenderAborted(init.signal)) return
    adoptFrameServerStyles(container, context.styleManager)
    let subFramesReady = hydrateContainer(container, context, {
      reconciliationTracker,
      nonce: context.nonce,
      transition: context.transition,
      signal: init.signal,
    })

    try {
      await subFramesReady

      if (isRenderAborted(init.signal)) return

      if (currentMarker?.status === 'pending') {
        await watchPendingFrameTemplate(currentMarker, {
          reconciliationTracker,
          nonce: context.nonce,
          transition: context.transition,
          signal: init.signal,
        })
      } else if (currentMarker?.status === 'lazy' && loadState.content === 'pending') {
        deferLoad(loadLazyFrame)
      }

      reconciliationTracker.finalize()
      await reconciliationTracker.ready()
    } finally {
      clearRmxData(context.data)
    }
  }

  function dispose(): void {
    transitionLoad({ type: 'dispose' })
  }

  let readyPromise = hydrateInitial()

  return {
    commitResponse,
    render,
    ready: () => readyPromise,
    flush: () => context.scheduler.dequeue(),
    clearPendingTemplateWatch: clearPendingFrameTemplateWatch,
    isDisplayingResolvedContent: () => loadState.content === 'resolved',
    shouldLoadForAncestorReload,
    updateLoading(value) {
      transitionLoad({ type: 'policy', loading: value })
    },
    deferLoad,
    startDeferredLoad,
    startLoad,
    rejectLoad,
    completeLoad,
    startInheritedReload,
    rejectInheritedReloadFinished,
    completeInheritedReload,
    updateMarker,
    renderMarkerContent,
    matchesIdentity: (src, name) =>
      loadState.lifecycle !== 'disposed' && frame.src === src && frameName === name,
    dispose,
    handle: frame,
  }

  function currentLoadController(): AbortController | undefined {
    return loadState.request.status === 'idle' ? undefined : loadState.request.controller
  }

  function shouldLoadForAncestorReload(): boolean {
    return loadState.policy !== 'lazy' || loadState.content !== 'pending'
  }

  function loadLazyFrame(signal?: AbortSignal, transition?: NavigationTransition): void {
    // Viewport loading completes initial content; active reloads keep their lifecycle.
    let controller = startLoad(
      !signal && loadState.reload.status === 'idle' && loadState.content !== 'resolved'
        ? 'initial'
        : signal
          ? 'ancestor'
          : 'direct',
      signal,
      loadState.reload.status === 'idle' ? undefined : loadState.reload.origin,
    )
    // Resolution reports errors before rejecting.
    void resolveAndRenderReload(controller, undefined, { transition }).catch(() => {})
  }

  function startDeferredLoad(): void {
    transitionLoad({ type: 'activate' })
  }

  function deferLoad(load?: () => void): void {
    transitionLoad({ type: 'defer', load })
  }

  function transitionLoad(
    event: Extract<FrameLoadEvent, { type: 'start' | 'start-commit' }>,
  ): AbortController
  function transitionLoad(event: FrameLoadEvent): void
  function transitionLoad(event: FrameLoadEvent): AbortController | void {
    switch (event.type) {
      case 'policy':
        // Reconciliation activates eager work after updating the fallback.
        loadState.policy = event.loading ?? 'eager'
        return
      case 'render-start':
        if (loadState.content === 'pending') loadState.content = 'started'
        transitionLoad({ type: 'cancel-deferral' })
        return
      case 'render-complete':
        loadState.content = 'resolved'
        return
      case 'cancel-deferral': {
        let observation = loadState.observation
        loadState.observation = { status: 'inactive' }
        if (observation.status === 'observing') observation.disconnect()
        return
      }
      case 'defer': {
        let load =
          event.load ??
          (loadState.observation.status === 'observing' ? loadState.observation.load : undefined)
        if (!load) return
        transitionLoad({ type: 'cancel-deferral' })
        if (isRenderAborted()) return
        let targets = container.childNodes.filter((node) => node instanceof Element)
        if (targets.length === 0) {
          console.warn(
            `Frame with loading="lazy" requires a fallback that renders an element. Loading "${frame.src}" immediately.`,
          )
          load()
          return
        }
        if (typeof IntersectionObserver === 'undefined') {
          load()
          return
        }
        let unobserve = observeFrameLoad(targets, startDeferredLoad)
        let mutations = new MutationObserver(() => {
          let currentTargets = container.childNodes.filter((node) => node instanceof Element)
          if (
            currentTargets.length !== targets.length ||
            currentTargets.some((target, index) => target !== targets[index])
          ) {
            deferLoad()
          }
        })
        mutations.observe(container.root, { childList: true })
        loadState.observation = {
          status: 'observing',
          load,
          disconnect() {
            mutations.disconnect()
            unobserve()
          },
        }
        return
      }
      case 'activate': {
        let load =
          loadState.observation.status === 'observing' ? loadState.observation.load : undefined
        transitionLoad({ type: 'cancel-deferral' })
        if (isRenderAborted()) return
        if (load) {
          load()
        } else if (currentMarker?.status === 'lazy' && loadState.content === 'pending') {
          loadLazyFrame()
        }
        return
      }
      case 'start': {
        transitionLoad({ type: 'cancel-commit' })
        transitionLoad({ type: 'render-start' })
        if (event.origin === 'initial') {
          let previous = currentLoadController()
          let controller = new AbortController()
          loadState.request = { status: 'loading', controller }
          if (previous) {
            previous.abort()
            completeLoad(previous)
          }
          return controller
        }

        let origin = event.reloadOrigin
        let previous = loadState.reload
        currentLoadController()?.abort()
        leaveReloadState()

        let { controller, disconnect } = createLinkedAbortController(event.signal)
        let navigation = getFrameCommitNavigation(event.signal)
        if (navigation) setFrameCommitNavigation(controller.signal, navigation)
        // Ancestor resolution continues the reload announced while waiting for its response.
        // Direct requests each need an event carrying their own request details and outcome.
        let continued =
          event.origin === 'ancestor' &&
          (previous.status === 'inherited' || previous.status === 'ancestor')
            ? previous
            : undefined
        let finished = continued?.finished
        if (!finished) {
          let previousEventController = loadState.eventController
          previousEventController?.abort()
          // Abort listeners can synchronously start a newer reload or dispose the frame.
          if (loadState.eventController !== previousEventController) {
            disconnect()
            controller.abort()
            return controller
          }
          let eventReload =
            event.origin === 'direct'
              ? { controller, disconnect: undefined }
              : createLinkedAbortController(event.signal)
          finished = createReloadFinished(eventReload.controller, eventReload.disconnect)
        }
        loadState.eventController = finished.controller
        if (!continued && previous.status !== 'idle') {
          settleReloadFinished(previous.finished, { aborted: true })
        }
        if (event.origin === 'ancestor' && previous.status !== 'idle') origin ??= previous.origin
        loadState.request = { status: 'loading', controller }
        loadState.reload = { status: event.origin, controller, disconnect, finished, origin }

        if (!continued) {
          frame.dispatchEvent(
            createFrameReloadStartEvent({
              src: frame.src,
              method: 'get',
              encType: null,
              ...origin,
              finished: finished.promise,
            }),
          )
        }
        if (
          event.origin === 'direct' ||
          previous.status === 'idle' ||
          previous.status === 'direct'
        ) {
          startSubFrameInheritedReloads(getContentNodes(), controller.signal, origin)
        }
        // A `reloadStart` listener can start a newer reload, which this submission no longer leads to.
        let form = event.form
        if (form && origin && !controller.signal.aborted) {
          let target = origin?.submitter ?? form
          // Form controls can shadow methods on their owning form.
          let bubbles = Node.prototype.contains.call(form, target)
          EventTarget.prototype.dispatchEvent.call(
            target,
            createFormSubmissionEvent({ ...origin, form, finished: finished.promise, bubbles }),
          )
          // External or detached submitters have no event path through their owning form.
          if (!bubbles && !controller.signal.aborted) {
            EventTarget.prototype.dispatchEvent.call(
              form,
              createFormSubmissionEvent({ ...origin, form, finished: finished.promise }),
            )
          }
        }
        return controller
      }
      case 'start-commit': {
        transitionLoad({ type: 'cancel-commit' })
        let controller = new AbortController()
        loadState.commit = { status: 'active', controller }
        return controller
      }
      case 'cancel-commit': {
        let commit = loadState.commit
        loadState.commit = { status: 'idle' }
        if (commit.status === 'active') commit.controller.abort()
        return
      }
      case 'settle': {
        let { controller } = event
        if (
          (loadState.reload.status === 'direct' || loadState.reload.status === 'ancestor') &&
          loadState.reload.controller === controller
        ) {
          let finished = loadState.reload.finished
          let outcome: ReloadFailure | undefined =
            event.failure ?? (controller.signal.aborted ? { aborted: true } : undefined)
          settleReloadFinished(finished, outcome)
          leaveReloadState()
          if (outcome !== undefined)
            completeSubFrameInheritedReloads(getContentNodes(), outcome, finished)
          if (loadState.eventController === finished.controller)
            frame.dispatchEvent(new Event('reloadComplete'))
        }
        // reloadComplete listeners can synchronously start another request or dispose the frame.
        if (currentLoadController() !== controller) return
        loadState.request = { status: 'settled', controller }
        if (
          controller.signal.aborted &&
          loadState.policy === 'lazy' &&
          loadState.content !== 'resolved'
        ) {
          // A targeted navigation may have changed the source since the client frame mounted.
          deferLoad(loadLazyFrame)
        }
        return
      }
      case 'reject':
        if (loadState.reload.status !== 'direct' && loadState.reload.status !== 'ancestor') return
        if (loadState.reload.controller !== event.controller) return
        loadState.reload.finished.reject(event.error)
        rejectSubFrameInheritedReloadFinished(getContentNodes(), event.error)
        return
      case 'reject-inherited':
        if (loadState.reload.status !== 'inherited') return
        loadState.reload.finished.reject(event.error)
        rejectSubFrameInheritedReloadFinished(getContentNodes(), event.error)
        return
      case 'inherit': {
        let { signal, origin, takeOverRequest } = event
        if (signal?.aborted) return
        if (
          !takeOverRequest &&
          (loadState.reload.status === 'direct' || loadState.reload.status === 'ancestor')
        ) {
          loadState.reload.origin = origin
          startSubFrameInheritedReloads(getContentNodes(), signal, origin)
          return
        }
        let previous = loadState.reload
        let previousController = takeOverRequest ? currentLoadController() : undefined
        if (takeOverRequest) loadState.request = { status: 'idle' }
        leaveReloadState()
        let disconnect: (() => void) | undefined
        if (signal) {
          let abort = () => completeInheritedReload({ aborted: true })
          signal.addEventListener('abort', abort, { once: true })
          disconnect = () => signal.removeEventListener('abort', abort)
        }
        let continued = previous.status === 'idle' ? undefined : previous
        let finished = continued?.finished
        if (!finished) {
          let previousEventController = loadState.eventController
          previousEventController?.abort()
          if (loadState.eventController !== previousEventController) {
            disconnect?.()
            previousController?.abort()
            return
          }
          let eventReload = createLinkedAbortController(signal)
          finished = createReloadFinished(eventReload.controller, eventReload.disconnect)
        }
        loadState.eventController = finished.controller
        loadState.reload = { status: 'inherited', disconnect, finished, origin }
        if (!continued) {
          frame.dispatchEvent(
            createFrameReloadStartEvent({
              src: frame.src,
              method: 'get',
              encType: null,
              ...origin,
              finished: finished.promise,
            }),
          )
        }
        if (previous.status !== 'inherited')
          startSubFrameInheritedReloads(getContentNodes(), signal, origin)
        // Publish inherited ownership before aborting the request it supersedes.
        previousController?.abort()
        if (takeOverRequest) transitionLoad({ type: 'cancel-commit' })
        return
      }
      case 'complete-inherited': {
        if (loadState.reload.status !== 'inherited') return
        let finished = loadState.reload.finished
        settleReloadFinished(finished, event.failure)
        leaveReloadState()
        if (event.failure !== undefined)
          completeSubFrameInheritedReloads(getContentNodes(), event.failure, finished)
        if (loadState.eventController === finished.controller)
          frame.dispatchEvent(new Event('reloadComplete'))
        return
      }
      case 'dispose':
        if (loadState.lifecycle === 'disposed') return
        loadState.lifecycle = 'disposed'
        transitionLoad({ type: 'cancel-deferral' })
        lifecycleController.abort()
        transitionLoad({ type: 'cancel-commit' })
        clearRmxData(context.data)
        currentLoadController()?.abort()
        loadState.request = { status: 'idle' }
        loadState.eventController?.abort()
        loadState.eventController = undefined
        if (loadState.reload.status !== 'idle')
          settleReloadFinished(loadState.reload.finished, { aborted: true })
        leaveReloadState()
        init.disposeFallback?.()
        contentRoot?.dispose()
        contentRoot = undefined
        clearPendingFrameTemplateWatch()
        pendingTemplateRender = undefined

        // Remove hydrated virtual roots in this frame's region.
        removeVirtualRoots(container.childNodes)

        // Dispose sub-frames recursively.
        disposeSubFrames(container.childNodes, context)
        if (ownsStyleManager) {
          context.styleManager.dispose()
        }

        if (frameName) {
          init.namedFrames.unregister(frameName, frame)
        }
        return
      default:
        throw new Error(`Unknown frame load event: ${event satisfies never}`)
    }
  }

  function setCurrentMarker(
    marker: FrameMarkerData,
    signal?: AbortSignal,
    origin?: ReloadOrigin,
  ): boolean {
    transitionLoad({ type: 'policy', loading: marker.status === 'lazy' ? 'lazy' : 'eager' })
    if (marker.status !== 'lazy') transitionLoad({ type: 'cancel-deferral' })
    let isInheritedReload = currentMarker !== undefined && currentMarker.id !== marker.id
    currentMarker = marker

    if (isInheritedReload) {
      startInheritedReload(signal, origin, marker.status !== 'lazy')
    }

    return isInheritedReload
  }

  async function updateMarker(marker: FrameMarkerData, options?: RenderOptions): Promise<void> {
    if (isRenderAborted(options?.signal)) return
    let isInheritedReload = setCurrentMarker(marker, options?.signal, options?.reloadOrigin)

    if (marker.status === 'pending') {
      await watchPendingFrameTemplate(
        marker,
        options,
        isInheritedReload || loadState.reload.status === 'inherited'
          ? () => {
              completeInheritedReload()
            }
          : undefined,
      )
    } else {
      clearPendingFrameTemplateWatch()
      if (marker.status === 'lazy') {
        if (isInheritedReload && shouldLoadForAncestorReload()) {
          loadLazyFrame(options?.signal, options?.transition)
        } else if (loadState.content !== 'resolved' && !currentLoadController()) {
          deferLoad(loadLazyFrame)
        }
      }
      if (isInheritedReload && !options?.signal?.aborted) {
        completeInheritedReload()
      }
    }
  }

  async function renderMarkerContent(
    marker: FrameMarkerData,
    content: InternalFrameContent,
    options?: RenderOptions,
  ): Promise<void> {
    if (isRenderAborted(options?.signal)) return
    let isInheritedReload =
      setCurrentMarker(marker, options?.signal, options?.reloadOrigin) ||
      loadState.reload.status === 'inherited'

    clearPendingFrameTemplateWatch()
    await render(content, options)

    if (isInheritedReload && !isRenderAborted(options?.signal)) {
      completeInheritedReload()
    }
  }

  async function reload(options?: FrameReloadOptions): Promise<FrameReloadResult> {
    let src = options?.src ?? frame.src
    let method = options?.method?.toLowerCase()
    if (method !== undefined && method !== 'post') method = 'get'
    let formData = options?.body
    let encType
    if (formData) {
      if (method !== 'post') {
        let url = new URL(src, container.doc.baseURI)
        url.search = `?${encodeFormDataAsSearchParams(formData)}`
        src = url.href
        formData = undefined
      } else {
        encType = options?.encType?.toLowerCase()
        if (encType !== 'multipart/form-data' && encType !== 'text/plain') {
          encType = 'application/x-www-form-urlencoded'
        }
      }
    }
    frame.src = src
    let reloadOptions: FrameNavigationOptions = {}
    if (method !== undefined) reloadOptions.method = method
    if (encType !== undefined) reloadOptions.encType = encType
    if (formData !== undefined) reloadOptions.formData = formData
    let transition = startReloadTransition(reloadOptions)
    void transition.committed.catch(() => {})
    return await transition.finished
  }

  function startReloadTransition(options?: FrameNavigationOptions): FrameReloadTransition {
    let controller = startReload(options)
    let committed = Promise.withResolvers<void>()
    let finished = resolveAndRenderReload(controller, committed, options)

    // Settle committed when a reload is aborted or fails before rendering any content.
    void finished.then(() => committed.resolve(), committed.reject)

    return { signal: controller.signal, committed: committed.promise, finished }
  }

  function commitResponse(
    response: Response,
    commit: FrameCommit,
    swap: () => Promise<void>,
    signal: AbortSignal,
    to: string,
  ): Promise<void> {
    let controller = transitionLoad({ type: 'start-commit' })
    return commitFrameResponse(response, commit, swap, {
      to,
      signal,
      commitSignal: AbortSignal.any([controller.signal, lifecycleController.signal]),
      onError: (error) => init.errorTarget.dispatchEvent(createComponentErrorEvent(error)),
    })
  }

  function startReload(options?: FrameNavigationOptions): AbortController {
    let method = options?.method?.toLowerCase() ?? 'get'
    return transitionLoad({
      type: 'start',
      origin: 'direct',
      signal: options?.signal,
      form: options?.form,
      reloadOrigin: {
        src: frame.src,
        method,
        encType:
          method === 'post' ? (options?.encType ?? 'application/x-www-form-urlencoded') : null,
        formData: method === 'post' ? options?.formData : undefined,
        element: options?.element,
        submitter: options?.submitter,
      },
    })
  }

  function startLoad(
    origin: FrameLoadOrigin,
    signal?: AbortSignal,
    reloadOrigin?: ReloadOrigin,
  ): AbortController {
    return transitionLoad({ type: 'start', origin, signal, reloadOrigin })
  }

  function leaveReloadState(): void {
    if (loadState.reload.status !== 'idle') loadState.reload.disconnect?.()
    loadState.reload = { status: 'idle' }
  }

  async function resolveAndRenderReload(
    controller: AbortController,
    committed?: PromiseWithResolvers<void>,
    options?: FrameNavigationOptions,
  ): Promise<FrameReloadResult> {
    let isStale = () => currentLoadController() !== controller || controller.signal.aborted
    let origin =
      (loadState.reload.status === 'direct' || loadState.reload.status === 'ancestor') &&
      loadState.reload.controller === controller
        ? loadState.reload.origin
        : undefined
    let failure: ReloadFailure | undefined
    try {
      let { element: _, submitter: __, form: ___, ...resolveOptions } = options ?? {}
      let resolution = await init.resolveFrame(frame.src, {
        ...resolveOptions,
        signal: controller.signal,
        target: frameName,
      })
      let commit = takeFrameCommit(resolution)
      if (isStale()) return { signal: controller.signal }
      let { content, redirectedTo, nonce } = await unwrapFrameResolution(resolution)
      if (isStale()) return { signal: controller.signal }
      let swap = async () => {
        let reconciliationTracker = createReconciliationTracker()
        let blockingFrameTracker = createReconciliationTracker()
        let commitStarted = false
        await render(content, {
          reloadOrigin: origin,
          nonce,
          transition: options?.transition,
          documentHref: isDocumentNode(container.root) ? (redirectedTo ?? frame.src) : undefined,
          signal: controller.signal,
          reconciliationTracker,
          blockingFrameTracker,
          onCommit() {
            if (commitStarted) return
            commitStarted = true
            blockingFrameTracker.finalize()
            if (committed) {
              void blockingFrameTracker.ready().then(committed.resolve, committed.reject)
            }
          },
        })
        reconciliationTracker.finalize()
        await reconciliationTracker.ready()
      }
      if (commit && resolution instanceof Response) {
        await commitResponse(resolution, commit, swap, controller.signal, redirectedTo ?? frame.src)
      } else {
        await swap()
      }
      return {
        signal: controller.signal,
        redirectedTo: isStale() ? undefined : redirectedTo,
      }
    } catch (error) {
      if (isStale()) return { signal: controller.signal }
      failure = { error }
      rejectLoad(controller, error)
      init.errorTarget.dispatchEvent(createComponentErrorEvent(error))
      throw error
    } finally {
      completeLoad(controller, failure)
    }
  }

  function completeLoad(controller: AbortController, failure?: ReloadFailure): void {
    transitionLoad({ type: 'settle', controller, failure })
  }

  function rejectLoad(controller: AbortController, error: unknown): void {
    transitionLoad({ type: 'reject', controller, error })
  }

  function startInheritedReload(
    signal?: AbortSignal,
    origin?: ReloadOrigin,
    takeOverRequest = false,
  ): void {
    transitionLoad({ type: 'inherit', signal, origin, takeOverRequest })
  }

  function rejectInheritedReloadFinished(error: unknown): void {
    transitionLoad({ type: 'reject-inherited', error })
  }

  function completeInheritedReload(failure?: ReloadFailure): void {
    transitionLoad({ type: 'complete-inherited', failure })
  }

  function startSubFrameInheritedReloads(
    nodes: Node[],
    signal?: AbortSignal,
    origin?: ReloadOrigin,
  ): void {
    walkNodes(
      nodes,
      (node) => {
        if (!isFrameStart(node)) return
        let end = findFrameEndMarker(node)
        context.frameInstances.get(node)?.startInheritedReload(signal, origin)
        return end
      },
      signal,
    )
  }

  function rejectSubFrameInheritedReloadFinished(nodes: Node[], error: unknown): void {
    walkNodes(nodes, (node) => {
      if (!isFrameStart(node)) return
      let end = findFrameEndMarker(node)
      context.frameInstances.get(node)?.rejectInheritedReloadFinished(error)
      return end
    })
  }

  function completeSubFrameInheritedReloads(
    nodes: Node[],
    failure: ReloadFailure,
    finished: ReloadFinished,
  ): void {
    walkNodes(nodes, (node) => {
      // A completion listener can synchronously start a new ancestor reload.
      if (loadState.eventController !== finished.controller) return
      if (!isFrameStart(node)) return
      let end = findFrameEndMarker(node)
      context.frameInstances.get(node)?.completeInheritedReload(failure)
      return end
    })
  }

  function clearPendingFrameTemplateWatch(): void {
    let watch = pendingTemplateWatch
    pendingTemplateWatch = undefined
    watch?.dispose?.()
  }

  async function watchPendingFrameTemplate(
    marker: FrameMarkerData,
    options: RenderOptions = {},
    onResolved?: () => void,
  ): Promise<void> {
    let { reconciliationTracker, signal, nonce, reloadOrigin, transition } = options
    if (isRenderAborted(signal)) return
    // A replayed template can reach the initial watcher before its shell accepts the marker.
    let rendering = pendingTemplateRender
    if (
      onResolved &&
      rendering?.markerId === marker.id &&
      rendering.controller === loadState.eventController
    ) {
      await rendering.ready
      if (!isRenderAborted(signal) && rendering.controller === loadState.eventController)
        onResolved?.()
      return
    }
    if (
      pendingTemplateWatch?.markerId === marker.id &&
      (pendingTemplateWatch.signal === signal || pendingTemplateWatch.signal === undefined)
    ) {
      // Initial streamed content must survive cancellation of a later navigation.
      let controller = loadState.eventController
      pendingTemplateWatch.onResolved = onResolved
        ? () => {
            if (!isRenderAborted(signal) && loadState.eventController === controller) onResolved()
          }
        : undefined
      return
    }

    clearPendingFrameTemplateWatch()
    let watch: PendingTemplateWatch = { markerId: marker.id, signal, onResolved }
    pendingTemplateWatch = watch

    let template = consumeFrameTemplate(marker.id) ?? getEarlyFrameContent(marker.id)
    if (!template) {
      if (isRenderAborted(signal)) {
        clearPendingFrameTemplateWatch()
        return
      }

      let stopObserver = setupTemplateObserver(marker.id)
      let unsubscribe = subscribeFrameTemplate(marker.id, async (fragment) => {
        if (isRenderAborted(signal)) return
        if (pendingTemplateWatch !== watch) return
        clearPendingFrameTemplateWatch()
        let inheritedReload = loadState.reload
        let renderOrigin =
          inheritedReload.status === 'inherited' ? inheritedReload.origin : reloadOrigin
        let ready = Promise.withResolvers<void>()
        pendingTemplateRender = {
          markerId: marker.id,
          controller: loadState.eventController,
          ready: ready.promise,
        }
        try {
          await render(fragment, {
            transition,
            nonce,
            signal,
            reloadOrigin: renderOrigin,
          })
        } catch (error) {
          if (isRenderAborted(signal) || loadState.reload !== inheritedReload) return
          rejectInheritedReloadFinished(error)
          init.errorTarget.dispatchEvent(createComponentErrorEvent(error))
          if (loadState.reload === inheritedReload) completeInheritedReload({ error })
          return
        } finally {
          ready.resolve()
        }
        if (!isRenderAborted(signal) && loadState.reload === inheritedReload) watch.onResolved?.()
      })
      let abort = () => {
        if (pendingTemplateWatch === watch) clearPendingFrameTemplateWatch()
      }
      signal?.addEventListener('abort', abort, { once: true })
      watch.dispose = () => {
        unsubscribe()
        stopObserver()
        signal?.removeEventListener('abort', abort)
      }

      template = consumeFrameTemplate(marker.id)
      if (!template) return
    }

    clearPendingFrameTemplateWatch()
    await render(template, {
      nonce,
      transition,
      reconciliationTracker,
      signal,
      reloadOrigin,
    })
    if (!isRenderAborted(signal)) onResolved?.()
  }
}

/**
 * Built-in component used to render nested frame content.
 *
 * @param handle Component handle for the frame instance.
 * @returns A placeholder render function handled by the reconciler.
 */
export function Frame(handle: Handle<FrameProps, FrameHandle>): RenderFn {
  void handle
  return () => null // reconciler renders
}

const frameNodeRenderer: FrameNodeRenderer = {
  insert: insertFrame,
  diff: diffFrame,
  dispose(node) {
    node._state.instance.dispose()
  },
}

Object.defineProperty(Frame, FRAME_NODE, { value: frameNodeRenderer })

function diffFrame(
  curr: CommittedFrameNode,
  next: FrameNode,
  domParent: ParentNode,
  vParent: VNodeParent,
  context: ReconcileContext,
  svg: boolean,
  anchor?: Node,
): CommittedFrameNode {
  let { frame } = context
  let currSrc = getFrameSrc(curr)
  let nextSrc = getFrameSrc(next)
  let currName = getFrameName(curr)
  let nextName = getFrameName(next)

  // If the frame hasn't resolved yet, preserve existing cancel/remount behavior
  // so pending streams from the old src cannot take over the new src.
  if (
    currName !== nextName ||
    (currSrc !== nextSrc && !curr._state.instance.isDisplayingResolvedContent())
  ) {
    let replaceAnchor = curr._rangeEnd.nextSibling ?? anchor
    remove(curr, domParent, context)
    return insertFrame(next, domParent, vParent, context, svg, replaceAnchor)
  }

  let committed = commitFrameNode(next, vParent, svg, curr._rangeStart, curr._rangeEnd, curr._state)

  let frameRuntime = getFrameRuntime(frame)
  let frameInstance = committed._state.instance
  frameInstance.updateLoading(committed.props.loading)
  let serverFrameReload = frameRuntime?.serverFrameReload

  if (currSrc !== nextSrc) {
    if (frameInstance) {
      frameInstance.handle.src = nextSrc
    }

    if (frameRuntime) {
      resolveClientFrame(committed, frameRuntime, serverFrameReload)
    }
  } else if (frameRuntime && frameInstance && serverFrameReload) {
    if (frameInstance.shouldLoadForAncestorReload()) {
      // Reload client frames whose content is loaded or already being requested.
      resolveClientFrame(committed, frameRuntime, serverFrameReload)
    } else {
      frameInstance.completeInheritedReload()
    }
  }

  let { fallbackRoot } = committed._state
  if (fallbackRoot) {
    getNonceManager().inheritRootResourceNonces(fallbackRoot, vParent)
    fallbackRoot.render(committed.props.fallback ?? null)
    if (committed.props.loading === 'lazy') frameInstance.deferLoad()
  }
  if (curr.props.loading === 'lazy' && next.props.loading !== 'lazy') {
    frameInstance.startDeferredLoad()
  }
  return committed
}

function insertFrame(
  node: FrameNode,
  domParent: ParentNode,
  vParent: VNodeParent,
  context: ReconcileContext,
  svg: boolean,
  anchor?: Node,
  cursor?: HydrationCursor,
): CommittedFrameNode {
  let { frame, styles } = context
  let runtime = getFrameRuntime(frame)
  if (!runtime || runtime.canResolveFrames === false) {
    throw new Error(
      'Cannot render <Frame /> without frame runtime. Use run() or pass frameInit to createRoot/createRangeRoot.',
    )
  }

  let getContext = (type: ElementFunction) => findContextFromAncestry(vParent, type)

  // Hydration path: adopt server-rendered frame markers and reuse the existing
  // frame instance created during createSubFrames().
  if (isFrameStart(cursor?.current)) {
    let start = cursor.current
    let end = findFrameEndComment(start)
    if (end) {
      let instance = runtime.frameInstances.get(start)
      if (!instance) {
        instance = createFrameInstance(node, start, end, runtime, getContext)
      } else {
        let instanceRuntime = getFrameRuntime(instance.handle)
        if (instanceRuntime) instanceRuntime.getContext = getContext
      }

      cursor.current = end.nextSibling
      return commitFrameNode(node, vParent, svg, start, end, {
        instance,
      })
    }
  }

  let start = document.createComment(createFrameStartMarker(randomFrameId()))
  let end = document.createComment(FRAME_END_MARKER)
  insertDomNode(start, domParent, anchor)
  insertDomNode(end, domParent, anchor)

  let fallbackRoot = createRangeRoot([start, end], {
    frame,
    getContext,
    styleManager: styles,
  })
  getNonceManager().inheritRootResourceNonces(fallbackRoot, vParent)
  fallbackRoot.render(node.props.fallback ?? null)

  let instance = createFrameInstance(node, start, end, runtime, getContext, () => {
    let state = committed._state
    if (state.fallbackRoot) {
      state.fallbackRoot.dispose()
      state.fallbackRoot = undefined
    }
  })
  let committed = commitFrameNode(node, vParent, svg, start, end, {
    instance,
    fallbackRoot,
  })
  if (node.props.loading === 'lazy') {
    instance.deferLoad(() => resolveClientFrame(committed, runtime))
  } else {
    resolveClientFrame(committed, runtime, runtime.serverFrameReload)
  }

  return committed
}

function createReloadFinished(
  controller: AbortController,
  disconnect?: () => void,
): ReloadFinished {
  let finished = Promise.withResolvers<AbortSignal>()
  let abort = () => finished.resolve(controller.signal)
  if (controller.signal.aborted) abort()
  else controller.signal.addEventListener('abort', abort, { once: true })
  let cleanup = () => {
    controller.signal.removeEventListener('abort', abort)
    disconnect?.()
  }
  // Events are notifications: a failure still reaches the app's error target even with no listener.
  void finished.promise.then(cleanup, cleanup)
  return Object.assign(finished, { controller })
}

function settleReloadFinished(finished: ReloadFinished | undefined, failure?: ReloadFailure): void {
  if (!finished) return
  if (failure?.aborted) {
    finished.controller.abort()
  } else if (failure === undefined) {
    finished.resolve(finished.controller.signal)
  } else {
    finished.reject(failure.error)
  }
}

function createFrameInstance(
  node: FrameNode,
  start: Comment,
  end: Comment,
  runtime: FrameRuntime,
  getContext: (type: ElementFunction) => unknown,
  disposeFallback?: () => void,
): FrameInstance {
  let instance = createFrame([start, end], {
    name: getFrameName(node),
    loading: node.props.loading,
    src: getFrameSrc(node),
    getContext,
    errorTarget: runtime.errorTarget,
    loadModule: runtime.loadModule,
    resolveFrame: runtime.resolveFrame,
    pendingClientEntries: runtime.pendingClientEntries,
    scheduler: runtime.scheduler,
    styleManager: runtime.styleManager,
    data: {},
    moduleCache: runtime.moduleCache,
    moduleLoads: runtime.moduleLoads,
    frameInstances: runtime.frameInstances,
    namedFrames: runtime.namedFrames,
    processClientEntryPreloads: runtime.processClientEntryPreloads,
    disposeFallback,
  })
  runtime.frameInstances.set(start, instance)
  return instance
}

function commitFrameNode(
  node: FrameNode,
  parent: VNodeParent,
  svg: boolean,
  start: Comment,
  end: Comment,
  state: FrameMountState,
): CommittedFrameNode {
  let committed = node as unknown as CommittedFrameNode
  committed._parent = parent
  committed._svg = svg
  committed._rangeStart = start
  committed._rangeEnd = end
  committed._state = state
  return committed
}

function resolveClientFrame(
  node: CommittedFrameNode,
  runtime: FrameRuntime,
  serverFrameReload?: NonNullable<FrameRuntime['serverFrameReload']>,
): void {
  let frameSrc = getFrameSrc(node)
  let instance = node._state.instance
  let controller = instance.startLoad(
    serverFrameReload ? 'ancestor' : 'initial',
    serverFrameReload?.signal,
    serverFrameReload?.origin,
  )
  let { signal } = controller
  let frameCommitted = Promise.withResolvers<void>()
  let failure: ReloadFailure | undefined

  let resolve = Promise.resolve()
    .then(() =>
      runtime.resolveFrame(frameSrc, {
        signal,
        target: getFrameName(node),
        ...(serverFrameReload?.transition ? { transition: serverFrameReload.transition } : {}),
      }),
    )
    .then(async (resolution) => {
      let commit = takeFrameCommit(resolution)
      if (signal.aborted) return
      let { content, nonce, redirectedTo } = await unwrapFrameResolution(resolution)
      if (signal.aborted) return
      let swap = async () => {
        let nextContent = asAbortableFrameContent(content, signal)
        await instance.render(nextContent, {
          reloadOrigin: serverFrameReload?.origin,
          nonce,
          transition: serverFrameReload?.transition,
          signal,
          reconciliationTracker: serverFrameReload?.reconciliationTracker,
          blockingFrameTracker: serverFrameReload?.blockingFrameTracker,
          onCommit: frameCommitted.resolve,
        })
      }
      if (commit && resolution instanceof Response) {
        await instance.commitResponse(resolution, commit, swap, signal, redirectedTo ?? frameSrc)
      } else {
        await swap()
      }
    })
    .catch((error) => {
      if ((serverFrameReload || node.props.loading === 'lazy') && !signal.aborted) {
        failure = { error }
        instance.rejectLoad(controller, error)
        runtime.errorTarget.dispatchEvent(createComponentErrorEvent(error))
      }
    })
    .finally(() => {
      frameCommitted.resolve()
      instance.completeLoad(controller, failure)
    })

  if (serverFrameReload?.reconciliationTracker && !node.props.fallback) {
    serverFrameReload.reconciliationTracker.waitFor(resolve)
  }
  if (serverFrameReload?.blockingFrameTracker && !node.props.fallback) {
    serverFrameReload.blockingFrameTracker.waitFor(frameCommitted.promise)
  }
}

function asAbortableFrameContent(content: FrameContent, signal: AbortSignal): FrameContent {
  if (!(content instanceof ReadableStream)) return content
  return createAbortableReadableStream(content, signal)
}

function createAbortableReadableStream(
  source: ReadableStream<Uint8Array>,
  signal: AbortSignal,
): ReadableStream<Uint8Array> {
  let reader = source.getReader()
  let aborted = false

  let onAbort = () => {
    aborted = true
    void reader.cancel(signal.reason)
  }

  if (signal.aborted) onAbort()
  else signal.addEventListener('abort', onAbort, { once: true })

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (aborted) {
        controller.close()
        return
      }

      let removeAbortReadListener: undefined | (() => void)
      let abortRead = new Promise<{ done: true; value: undefined }>((resolve) => {
        if (signal.aborted) {
          resolve({ done: true, value: undefined })
          return
        }
        let onAbortRead = () => {
          resolve({ done: true, value: undefined })
        }
        removeAbortReadListener = () => signal.removeEventListener('abort', onAbortRead)
        signal.addEventListener('abort', onAbortRead, { once: true })
      })

      let result = await Promise.race([reader.read(), abortRead])
      removeAbortReadListener?.()

      if (result.done) {
        controller.close()
        return
      }
      controller.enqueue(result.value)
    },
    cancel(reason) {
      signal.removeEventListener('abort', onAbort)
      return reader.cancel(reason)
    },
  })
}

function getFrameSrc(node: FrameNode | CommittedFrameNode): string {
  return node.props.src
}

function getFrameName(node: FrameNode | CommittedFrameNode): string | undefined {
  let name = node.props.name
  return typeof name === 'string' && name.length > 0 ? name : undefined
}

function randomFrameId(): string {
  return `f${crypto.randomUUID().slice(0, 8)}`
}

function findFrameEndComment(start: Comment): Comment | null {
  let depth = 1
  let node: Node | null = start.nextSibling

  while (node) {
    if (isFrameStart(node)) depth++
    else if (isFrameEnd(node)) {
      depth--
      if (depth === 0) return node
    }
    node = node.nextSibling
  }

  return null
}

function createReconciliationTracker(): ReconciliationTracker {
  let pending = 0
  let finalized = false
  let failed = false
  let failure: unknown

  let resolveReady: (() => void) | undefined
  let rejectReady: ((error: unknown) => void) | undefined
  let readyPromise = new Promise<void>((resolve, reject) => {
    resolveReady = resolve
    rejectReady = reject
  })

  function maybeSettle() {
    if (!finalized || pending !== 0) return
    if (failed) rejectReady?.(failure)
    else resolveReady?.()
    resolveReady = undefined
    rejectReady = undefined
  }

  function track(): () => void {
    pending++
    let completed = false
    return () => {
      if (completed) return
      completed = true
      pending--
      maybeSettle()
    }
  }

  return {
    track,
    waitFor(task) {
      let complete = track()
      void task.then(complete, (error) => {
        if (!failed) {
          failed = true
          failure = error
        }
        complete()
      })
    },
    finalize() {
      finalized = true
      maybeSettle()
    },
    ready() {
      return readyPromise
    },
  }
}

function mergeRmxDataFrom(into: RmxData, root: ParentNode): void {
  let scripts = Array.from(root.querySelectorAll('script#rmx-data'))
  for (let script of scripts) {
    if (!(script instanceof HTMLScriptElement)) continue
    mergeRmxData(into, parseRmxDataScript(script))
    script.remove()
  }
}

function clearRmxData(data: RmxData): void {
  delete data.h
  delete data.f
}

function removeEmptyHeads(fragment: DocumentFragment): void {
  let heads = Array.from(fragment.querySelectorAll('head'))
  for (let head of heads) {
    if (!head.childNodes.length) {
      head.remove()
    }
  }
}

function adoptFrameServerStyles(container: FrameContainer, styleManager: StyleManager): void {
  let styles: HTMLStyleElement[] = []
  let nodes =
    container.root instanceof Document
      ? [...Array.from(container.doc.head.childNodes), ...Array.from(container.doc.body.childNodes)]
      : container.childNodes

  walkNodes(nodes, (node) => {
    if (isFrameStart(node)) return findFrameEndMarker(node)
    if (node instanceof HTMLStyleElement && node.matches('style[data-rmx-style]')) {
      styles.push(node)
      return node
    }
  })
  for (let style of styles) {
    let parent = style.parentNode
    let nextSibling = style.nextSibling
    let wasConnected = style.isConnected

    // Let the active document enforce CSP before copying rules into a constructed
    // sheet. Keep this synchronous with the DOM diff so no intermediate state paints.
    if (!wasConnected) document.head.append(style)
    try {
      styleManager.adoptServerStyles([style])
    } finally {
      // Blocked styles and failed adoptions retain their original DOM position.
      if (!wasConnected && style.parentNode) parent?.insertBefore(style, nextSibling)
    }
  }
}

function parseRmxDataScript(script: HTMLScriptElement): RmxData {
  try {
    return JSON.parse(script.textContent || '{}')
  } catch {
    console.error('[createFrame] Failed to parse rmx-data script')
    return {}
  }
}

function mergeRmxData(into: RmxData, from: RmxData): void {
  if (from.h) copyOwnRmxEntries((into.h ??= {}), from.h)
  if (from.f) copyOwnRmxEntries((into.f ??= {}), from.f)
}

function copyOwnRmxEntries<T>(target: Record<string, T>, source: Record<string, T>): void {
  for (let key of Object.keys(source)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue
    target[key] = source[key]!
  }
}

function hydrateContainer(
  container: FrameContainer,
  context: FrameContext,
  options?: RenderOptions,
): Promise<void> {
  let hydrationData = context.data.h
  let hydrationMarkers = findHydrationMarkers(container, hydrationData)
  let hydrations: Array<{
    marker: HydrationMarker
    entry: HydrationData
    complete: () => void
  }> = []

  for (let marker of hydrationMarkers) {
    let entry = hydrationData?.[marker.id]
    if (!entry) continue
    if (!context.pendingClientEntries.has(marker.start)) {
      context.pendingClientEntries.set(marker.start, [marker.end, undefined])
    }
    let { promise, resolve } = Promise.withResolvers<void>()
    pendingClientEntryHydrations.set(marker.start, promise)
    hydrations.push({
      marker,
      entry,
      complete() {
        if (pendingClientEntryHydrations.get(marker.start) === promise) {
          pendingClientEntryHydrations.delete(marker.start)
        }
        resolve()
      },
    })
  }

  // Register frame metadata before a cached client entry can adopt its frame markers.
  let subFramesReady = createSubFrames(container.childNodes, context, options)
  for (let { marker, entry, complete } of hydrations) {
    scheduleHydrationMarker(
      marker,
      entry,
      context,
      complete,
      options?.reconciliationTracker,
      options?.signal,
    )
  }
  return subFramesReady
}

function scheduleHydrationMarker(
  marker: HydrationMarker,
  entry: HydrationData,
  context: FrameContext,
  onComplete: () => void,
  reconciliationTracker?: ReconciliationTracker,
  signal?: AbortSignal,
): void {
  if (signal?.aborted || context.lifecycleSignal.aborted) {
    onComplete()
    return
  }

  let done = reconciliationTracker?.track()
  let identity: ClientEntryIdentity = {
    moduleUrl: entry.moduleUrl,
    exportName: entry.exportName,
  }
  let key = getClientEntryKey(identity)
  let props: Record<string, unknown> | undefined = entry.props
  let completed = false

  let complete = () => {
    if (completed) return
    completed = true
    props = undefined
    signal?.removeEventListener('abort', complete)
    context.lifecycleSignal.removeEventListener('abort', complete)
    onComplete()
    done?.()
  }

  signal?.addEventListener('abort', complete, { once: true })
  context.lifecycleSignal.addEventListener('abort', complete, { once: true })

  let hydrateWithComponent = (component: ElementFunction) => {
    if (signal?.aborted || context.lifecycleSignal.aborted) return
    if (!isHydrationMarkerLive(marker, context)) return
    if (!props) return
    let pending = context.pendingClientEntries.get(marker.start)
    let vElement = pending?.[1] ?? createElement(component, props)
    context.pendingClientEntries.set(marker.start, [marker.end, vElement])
    hydrateRegion(vElement, marker.start, marker.end, identity, context, signal, pending?.[2])
  }

  let parentHydration = marker.parent && pendingClientEntryHydrations.get(marker.parent)
  let cached = context.moduleCache.get(key)
  if (cached && !parentHydration) {
    hydrateWithComponent(cached)
    complete()
    return
  }

  let component = cached ?? getOrStartModuleLoad(key, identity, marker.id, context)
  // Imports can finish in any order, but setup must wait for the owning entry's context.
  Promise.all([component, parentHydration])
    .then(([component]) => {
      if (component) {
        hydrateWithComponent(component)
      }
    })
    .finally(() => {
      complete()
    })
}

function getOrStartModuleLoad(
  key: string,
  identity: ClientEntryIdentity,
  markerId: string,
  context: FrameContext,
): Promise<ElementFunction | undefined> {
  let inFlight = context.moduleLoads.get(key)
  if (inFlight) return inFlight

  let loadPromise = (async () => {
    try {
      let mod = await context.loadModule(identity.moduleUrl, identity.exportName)
      if (!isElementFunction(mod)) {
        throw new Error(
          `Export "${identity.exportName}" from "${identity.moduleUrl}" is not a function`,
        )
      }
      context.moduleCache.set(key, mod)
      return mod
    } catch (error) {
      console.error(`[createFrame] Failed to load module for ${markerId}:`, error)
      return undefined
    } finally {
      context.moduleLoads.delete(key)
    }
  })()

  context.moduleLoads.set(key, loadPromise)
  return loadPromise
}

function createElement(component: ElementFunction, props: Record<string, unknown>): RemixElement {
  let revivedProps = reviveSerializedValue(props)
  invariant(isRecord(revivedProps), 'Expected revived component props to be an object')
  return jsx(component, revivedProps)
}

function isElementFunction(value: unknown): value is ElementFunction {
  return typeof value === 'function'
}

// Stands in for a mixin the server couldn't serialize, so the error is reported
// when the element renders, the same way other client entry render errors are.
const unserializableMixin = createMixin(() => {
  throw new Error(
    "Client entry props contain a mixin that can't be serialized. Only css() mixins can be " +
      'used in JSX passed to a client entry. Render elements that use other mixins, such as ' +
      'on() or ref(), inside the client entry instead.',
  )
})

function reviveSerializedValue(value: unknown): unknown {
  if (value === null || value === undefined) return value
  if (typeof value !== 'object') return value

  if (Array.isArray(value)) {
    return value.map((item) => reviveSerializedValue(item))
  }

  if (!isRecord(value)) return value
  let record = value

  // Revive the fields, but never interpret the escaped object's own tags.
  if (isRecord(record[ESCAPED_OBJECT])) {
    return reviveSerializedProperties(record[ESCAPED_OBJECT])
  }

  if (record.$rmxFrame === true) return reviveSerializedElement(Frame, record)
  if (record.$rmxFragment === true) return reviveSerializedElement(Fragment, record)

  if (record.$rmxMixin === 'css') {
    let args = reviveSerializedValue(record.args)
    let styles: unknown = Array.isArray(args) ? args[0] : undefined
    return css(isCSSProps(styles) ? styles : {})
  }

  if (record.$rmxMixin === null) {
    return unserializableMixin()
  }

  if (record.$rmx === true && typeof record.type === 'string') {
    return reviveSerializedElement(record.type, record)
  }

  return reviveSerializedProperties(record)
}

function reviveSerializedProperties(record: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, reviveSerializedValue(value)]),
  )
}

function reviveSerializedElement(
  type: string | typeof Frame | typeof Fragment,
  record: Record<string, unknown>,
): RemixElement {
  let props = reviveSerializedObject(record.props)
  let key = reviveSerializedValue(record.key)
  return jsx(type, props, key)
}

function reviveSerializedObject(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) return {}
  let revived = reviveSerializedValue(value)
  return isRecord(revived) ? revived : {}
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isCSSProps(value: unknown): value is CSSProps {
  if (!isRecord(value)) return false
  for (let key in value) {
    let item = value[key]
    if (item == null || typeof item === 'string' || typeof item === 'number') continue
    if (!isCSSProps(item)) return false
  }
  return true
}

function hydrateRegion(
  vElement: RemixElement,
  start: Comment,
  end: Comment,
  identity: ClientEntryIdentity,
  context: FrameContext,
  signal?: AbortSignal,
  resourceNonces?: ResourceNonces,
): void {
  if (signal?.aborted) return

  context.pendingClientEntries.delete(start)

  // During a server frame reload, expose the reload signal and reconciliation
  // tracker to client frames created while this entry renders so blocking
  // frames keep the reload pending until their content arrives.
  let renderEntry = (root: Pick<VirtualRoot, 'render'>) => {
    let nonceManager = getNonceManager()
    nonceManager.addRootResourceNonces(root, resourceNonces)
    nonceManager.addRootResponseNonce(root, context.nonce)
    if (!signal && !context.transition) {
      root.render(vElement)
      return
    }

    let frameRuntime = context.frame.$runtime
    invariant(
      isFrameRuntime(frameRuntime),
      'Expected frame runtime while rendering a client entry during a reload',
    )

    let previousServerFrameReload = frameRuntime.serverFrameReload

    frameRuntime.serverFrameReload = {
      signal: signal ?? context.lifecycleSignal,
      transition: context.transition,
      origin: context.reloadOrigin,
      reconciliationTracker: context.reconciliationTracker,
      blockingFrameTracker: context.blockingFrameTracker,
    }
    try {
      root.render(vElement)
    } finally {
      frameRuntime.serverFrameReload = previousServerFrameReload
    }
  }

  // The same marker can be discovered by overlapping hydration passes
  // (for example, document root + nested frame root). Reuse the existing
  // virtual root instead of redefining the marker property.
  let owner = getClientEntryBoundaryOwner(start)
  if (owner) {
    renderEntry(owner.root)
    return
  }

  let root = createFrameRoot([start, end], context)
  setClientEntryBoundaryOwner(start, end, identity, root)
  renderEntry(root)
}

function createFrameRoot(
  target: HTMLElement | [Comment, Comment],
  context: FrameContext,
): VirtualRoot {
  let options = {
    scheduler: context.scheduler,
    frame: context.frame,
    getContext: context.getContext,
    styleManager: context.styleManager,
  }
  let root = Array.isArray(target) ? createRangeRoot(target, options) : createRoot(target, options)
  root.addEventListener('error', (event: Event) => {
    if (context.errorTarget === root) return
    context.errorTarget.dispatchEvent(createComponentErrorEvent(getComponentError(event)))
  })
  return root
}

async function createSubFrames(
  nodes: Node[],
  context: FrameContext,
  options?: RenderOptions,
): Promise<void> {
  let tasks: Promise<void>[] = []

  for (let i = 0; i < nodes.length; i++) {
    if (options?.signal?.aborted) break

    let node = nodes[i]

    if (isFrameStart(node)) {
      let end = findFrameEndMarker(node)
      let existingFrame = context.frameInstances.get(node)
      let id = getFrameId(node)
      let marker = context.data.f?.[id]

      if (existingFrame) {
        if (marker) {
          let frameMarker: FrameMarkerData = { ...marker, id }
          tasks.push(existingFrame.updateMarker(frameMarker, options))
        } else {
          existingFrame.clearPendingTemplateWatch()
        }
      } else {
        if (marker) {
          let frameMarker: FrameMarkerData = { ...marker, id }
          let subFrame = createFrame([node, end], {
            nonce: context.nonce,
            transition: context.transition,
            signal: options?.signal,
            src: frameMarker.src,
            marker: frameMarker,
            topFrame: context.topFrame,
            getContext: context.getContext,
            ...getSharedFrameRuntime(context),
            data: context.data,
          })
          context.frameInstances.set(node, subFrame)
          if (frameMarker.status === 'resolved') {
            tasks.push(subFrame.ready())
          }
        }
      }

      i = findMarkerRangeEndIndex(nodes, end, i)
      continue
    }

    if (node.childNodes && node.childNodes.length > 0) {
      tasks.push(createSubFrames(Array.from(node.childNodes), context, options))
    }
  }

  await Promise.all(tasks)
}

function isHydrationMarkerLive(marker: HydrationMarker, context: FrameContext): boolean {
  if (!marker.start.isConnected || !marker.end.isConnected) return false
  if (marker.start.parentNode !== marker.end.parentNode) return false

  if (!isHydrationStart(marker.start) || getHydrationId(marker.start) !== marker.id) return false
  if (!isHydrationEnd(marker.end)) return false

  if (context.regionTailRef) {
    let startPosition = marker.start.compareDocumentPosition(context.regionTailRef)
    let endPosition = marker.end.compareDocumentPosition(context.regionTailRef)
    let tailFollowsStart = (startPosition & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
    let tailFollowsEnd = (endPosition & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
    if (!tailFollowsStart || !tailFollowsEnd) return false
  }

  return true
}

function removeVirtualRoots(nodes: Node[]): void {
  walkNodes(nodes, (node) => {
    if (isHydrationStart(node) && disposeClientEntryBoundary(node)) {
      return findEndMarker(node, isHydrationStart, isHydrationEnd)
    }
  })
}

function disposeSubFrames(nodes: Node[], context: FrameContext): void {
  walkNodes(nodes, (node) => {
    if (!isFrameStart(node)) return
    let end = findFrameEndMarker(node)
    let subFrame = context.frameInstances.get(node)
    if (subFrame) {
      subFrame.dispose()
      context.frameInstances.delete(node)
    }
    return end
  })
}

function getEarlyFrameContent(id: string): DocumentFragment | null {
  let template = document.querySelector(`template#${id}`)
  if (template instanceof HTMLTemplateElement && isFrameTemplateComplete(template)) {
    return takeFrameTemplateContent(template)
  }
  return null
}

function isFrameTemplateComplete(template: HTMLTemplateElement): boolean {
  let end = template.content.lastChild
  return isFrameTemplateEnd(end) || template.ownerDocument.readyState !== 'loading'
}

function takeFrameTemplateContent(template: HTMLTemplateElement): DocumentFragment {
  let fragment = template.content
  let end = fragment.lastChild
  if (isFrameTemplateEnd(end)) end.remove()
  template.remove()
  return fragment
}

function setupTemplateObserver(id: string): () => void {
  let root = document.body ?? document.documentElement ?? document
  let pending = new Set<HTMLTemplateElement>()
  let observer = new MutationObserver((mutations) => {
    for (let mutation of mutations) {
      for (let node of mutation.addedNodes) {
        collectFrameTemplates(node, observeTemplate)
      }
    }
    publishCompleteTemplates()
  })

  function observeTemplate(template: HTMLTemplateElement): void {
    if (template.id !== id || pending.has(template)) return
    pending.add(template)
    // Template contents are a separate fragment, outside the observed document subtree.
    observer.observe(template.content, { childList: true })
  }

  function publishCompleteTemplates(): void {
    for (let template of pending) {
      if (!template.isConnected) {
        pending.delete(template)
        continue
      }
      if (!isFrameTemplateComplete(template)) continue
      pending.delete(template)
      publishFrameTemplate(template.id, takeFrameTemplateContent(template))
    }
  }

  observer.observe(root, { childList: true, subtree: true })
  collectFrameTemplates(root, observeTemplate)
  document.addEventListener('DOMContentLoaded', publishCompleteTemplates, { once: true })

  return () => {
    observer.disconnect()
    pending.clear()
    document.removeEventListener('DOMContentLoaded', publishCompleteTemplates)
  }
}

function collectFrameTemplates(node: Node, collect: (template: HTMLTemplateElement) => void): void {
  if (node instanceof HTMLTemplateElement) {
    collect(node)
    return
  }

  if (!(node instanceof Element)) return
  let templates = Array.from(node.querySelectorAll('template'))
  for (let template of templates) {
    if (!(template instanceof HTMLTemplateElement)) continue
    collect(template)
  }
}

export function publishFrameTemplate(
  id: string,
  fragment: DocumentFragment,
  options?: { inertScripts?: boolean },
): void {
  let listeners = frameTemplateListeners.get(id)
  if (!listeners || listeners.size === 0) {
    let queue = bufferedFrameTemplates.get(id)
    if (!queue) {
      queue = []
      bufferedFrameTemplates.set(id, queue)
    }
    queue.push(fragment)
    return
  }

  for (let listener of listeners) {
    let clone = fragment.cloneNode(true)
    invariant(isDocumentFragmentNode(clone), 'Expected cloned frame template fragment')
    if (options?.inertScripts) makeSvgScriptsInert(clone)
    listener(clone)
  }
}

function makeSvgScriptsInert(source: ParentNode): void {
  // Work around browser bugs that make fragment-parsed SVG scripts executable after cloning.
  // Recreate the script shell with the fragment parser after cloning to keep it inert.
  // https://crbug.com/538197148
  for (let script of source.querySelectorAll('script')) {
    if (!(script instanceof SVGScriptElement)) continue
    let doc = script.ownerDocument
    let svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.innerHTML = '<script></script>'
    let replacement = svg.firstElementChild
    invariant(replacement, 'Missing SVG script')
    for (let attribute of script.attributes) {
      replacement.setAttributeNodeNS(doc.importNode(attribute, true))
    }
    if (script.hasAttribute('nonce')) replacement.setAttribute('nonce', script.nonce)
    replacement.replaceChildren(...script.childNodes)
    script.replaceWith(replacement)
  }
  for (let template of source.querySelectorAll('template')) {
    makeSvgScriptsInert(template.content)
  }
}

export function consumeFrameTemplate(id: string): DocumentFragment | null {
  let queue = bufferedFrameTemplates.get(id)
  if (!queue || queue.length === 0) return null

  let fragment = queue.shift() ?? null
  if (queue.length === 0) {
    bufferedFrameTemplates.delete(id)
  }

  return fragment
}

function subscribeFrameTemplate(id: string, listener: FrameTemplateListener): () => void {
  let listeners = frameTemplateListeners.get(id)
  if (!listeners) {
    listeners = new Set()
    frameTemplateListeners.set(id, listeners)
  }
  listeners.add(listener)
  return () => {
    let current = frameTemplateListeners.get(id)
    if (!current) return
    current.delete(listener)
    if (current.size === 0) {
      frameTemplateListeners.delete(id)
    }
  }
}

type StreamTemplateParseResult = {
  html: string
  remainder: string
}

const COMPLETE_TEMPLATE_WITH_ID_PATTERN =
  /<template\b[^>]*\bid=(?:"[^"]+"|'[^']+')[^>]*>[\s\S]*?<\/template>/gi

function extractTemplatesFromBuffer(
  doc: Document,
  buffer: string,
  onTemplate: (id: string, fragment: DocumentFragment) => void,
): StreamTemplateParseResult {
  let html = ''
  let cursor = 0

  for (let match of buffer.matchAll(COMPLETE_TEMPLATE_WITH_ID_PATTERN)) {
    html += buffer.slice(cursor, match.index)

    let parsed = createFragmentFromString(doc, match[0])
    let template = parsed.querySelector('template')
    if (template instanceof HTMLTemplateElement && template.id) {
      onTemplate(template.id, takeFrameTemplateContent(template))
    }

    cursor = match.index + match[0].length
  }

  let tail = buffer.slice(cursor)
  if (tail === '') return { html, remainder: '' }

  let tailStart = tail.toLowerCase().lastIndexOf('<template')
  if (tailStart === -1) {
    return { html: html + tail, remainder: '' }
  }

  return {
    html: html + tail.slice(0, tailStart),
    remainder: tail.slice(tailStart),
  }
}

async function renderFrameStream(
  stream: ReadableStream<Uint8Array>,
  doc: Document,
  applyHtml: (html: string, flushKind: FlushKind) => Promise<void>,
  responseNonce: string | undefined,
  signal?: AbortSignal,
): Promise<void> {
  let reader = stream.getReader()
  let decoder = new TextDecoder()
  let buffer = ''
  let html = ''
  let appliedOnce = false
  let abort = () => {
    void reader.cancel().catch(() => {})
  }
  if (signal?.aborted) {
    await reader.cancel()
    reader.releaseLock()
    return
  }
  signal?.addEventListener('abort', abort, { once: true })

  function rewriteAndPublishTemplate(id: string, fragment: DocumentFragment): void {
    getNonceManager().prepareResponse(fragment, responseNonce)
    publishFrameTemplate(id, fragment, { inertScripts: true })
  }

  try {
    while (true) {
      let { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      let parsed = extractTemplatesFromBuffer(doc, buffer, rewriteAndPublishTemplate)
      buffer = parsed.remainder

      if (parsed.html !== '') {
        html += parsed.html
        let flushed = await consumeFlushBatches(html, applyHtml)
        appliedOnce = flushed.applied || appliedOnce
        html = flushed.remainder
      }
    }

    buffer += decoder.decode()
    let parsed = extractTemplatesFromBuffer(doc, buffer, publishFrameTemplate)
    html += parsed.html + parsed.remainder

    if (html !== '') {
      await applyHtml(html, appliedOnce ? 'fragment' : inferFlushKind(html))
    } else if (!appliedOnce) {
      // A frame stream can legitimately resolve to empty content. Ensure the
      // existing frame region is cleared instead of treated as a no-op.
      await applyHtml('', 'fragment')
    }
  } finally {
    signal?.removeEventListener('abort', abort)
    reader.releaseLock()
  }
}

async function consumeFlushBatches(
  html: string,
  applyHtml: (html: string, flushKind: FlushKind) => Promise<void>,
): Promise<{ applied: boolean; remainder: string }> {
  let applied = false
  let cursor = 0
  let marker = findFlushMarker(html, cursor)

  while (marker) {
    let batch = html.slice(cursor, marker.index)
    await applyHtml(batch, marker.kind)
    applied = true
    cursor = marker.endIndex
    marker = findFlushMarker(html, cursor)
  }

  return { applied, remainder: html.slice(cursor) }
}

type FrameContainer = {
  doc: Document
  root: ParentNode
  childNodes: Node[]
  regionStart?: Comment
  regionTailRef?: ChildNode | null
  regionParent?: ParentNode | null
}

function createContainer(root: FrameRoot): FrameContainer {
  return Array.isArray(root) ? createCommentContainer(root) : createElementContainer(root)
}

function createElementContainer(root: Document | Element | DocumentFragment): FrameContainer {
  let doc = root instanceof Document ? root : (root.ownerDocument ?? document)
  return {
    doc,
    root,
    get childNodes() {
      return Array.from(root.childNodes)
    },
  }
}

function createCommentContainer([start, end]: [Comment, Comment]): FrameContainer {
  let parent = end.parentNode
  invariant(parent, 'Invalid comment container')
  invariant(start.parentNode === parent, 'Boundaries must share parent')
  let doc = parent.ownerDocument ?? document

  return {
    doc,
    root: parent,
    regionStart: start,
    get childNodes() {
      return collectNodesBetween(start, end)
    },
    regionTailRef: end,
    regionParent: parent,
  }
}

function createFragmentFromString(doc: Document, content: string): DocumentFragment {
  let template = doc.createElement('template')
  template.innerHTML = content.trim()
  removeNoscriptContents(template.content)
  return template.content
}

function isRemixNodeFrameContent(content: InternalFrameContent): content is RemixNode {
  return !(
    content instanceof ReadableStream ||
    isDocumentFragmentNode(content) ||
    typeof content === 'string'
  )
}

type HydrationMarker = {
  id: string
  start: Comment
  end: Comment
  parent?: Comment
}

function findHydrationMarkers(container: FrameContainer, data: RmxData['h']): HydrationMarker[] {
  let markers: Array<Omit<HydrationMarker, 'end'> & { end?: Comment }> = []
  let parent = container.regionStart && frameClientEntryParents.get(container.regionStart)
  visit(container.childNodes, parent)
  return markers.map(({ id, start, end, parent }) => {
    if (!end) throw new Error('End marker not found')
    return { id, start, end, parent }
  })

  function visit(nodes: Node[], parent?: Comment): void {
    let boundaries: typeof markers = []
    for (let i = 0; i < nodes.length; i++) {
      let node = nodes[i]

      // Nested frames discover their own entries, inheriting this pass's enclosing boundary.
      if (isFrameStart(node)) {
        if (parent) frameClientEntryParents.set(node, parent)
        else frameClientEntryParents.delete(node)
        let end = findFrameEndMarker(node)
        i = findMarkerRangeEndIndex(nodes, end, i)
        continue
      }

      if (isHydrationStart(node)) {
        let id = getHydrationId(node)
        let boundary = { id, start: node, parent }
        markers.push(boundary)
        boundaries.push(boundary)
        if (data?.[id] || pendingClientEntryHydrations.has(node)) parent = node
      } else if (isHydrationEnd(node)) {
        let boundary = boundaries.pop()
        if (boundary) {
          boundary.end = node
          parent = boundary.parent
        }
      }
      if (node.childNodes.length > 0) {
        visit(Array.from(node.childNodes), parent)
      }
    }
  }
}

// Visits nodes depth-first. A visitor that handles a range returns its last node, which skips the
// rest of the range and its descendants.
function walkNodes(nodes: Node[], visit: (node: Node) => Node | void, signal?: AbortSignal): void {
  for (let i = 0; i < nodes.length; i++) {
    if (signal?.aborted) break

    let node = nodes[i]
    let end = visit(node)
    if (end) {
      i = findMarkerRangeEndIndex(nodes, end, i)
      continue
    }

    if (node.childNodes.length > 0) {
      walkNodes(Array.from(node.childNodes), visit, signal)
    }
  }
}

function findFrameEndMarker(start: Comment): Comment {
  return findEndMarker(start, isFrameStart, isFrameEnd)
}

function findMarkerRangeEndIndex(nodes: Node[], end: Node, startIndex: number): number {
  // The snapshot may not contain an end marker moved by a DOM update.
  return Math.max(startIndex, nodes.indexOf(end, startIndex))
}

function isDocumentNode(node: Node): node is Document {
  return node.nodeType === Node.DOCUMENT_NODE
}

function isDocumentFragmentNode(value: unknown): value is DocumentFragment {
  return (
    typeof value === 'object' &&
    value !== null &&
    Reflect.get(value, 'nodeType') === Node.DOCUMENT_FRAGMENT_NODE
  )
}

const documentReloadInfo = 'remix-document-reload'

export function isDocumentReload(info: unknown): boolean {
  return info === documentReloadInfo
}

export function reloadDocument(doc: Document, href = doc.location.href): void {
  let navigation = doc.defaultView?.navigation
  if (navigation) {
    navigation.navigate(href, { history: 'replace', info: documentReloadInfo })
  } else {
    doc.location.replace(href)
  }
}

export function reloadCurrentDocument(doc: Document): void {
  let navigation = doc.defaultView?.navigation
  if (navigation && typeof navigation.reload === 'function') {
    navigation.reload({ info: documentReloadInfo })
  } else {
    doc.location.reload()
  }
}

function parseDocument(doc: Document, content: string): HTMLElement {
  let parsed = doc.implementation.createHTMLDocument()
  parsed.open()

  // Let the native parser find the opening html element and its attributes. The
  // delimiters only split input chunks; the parser handles comments and quoted >.
  let offset = 0
  while (!parsed.documentElement && offset < content.length) {
    let end = content.indexOf('>', offset)
    let next = end === -1 ? content.length : end + 1
    parsed.write(content.slice(offset, next))
    offset = next
  }

  let root = parsed.documentElement
  root?.remove()
  parsed.close()
  root ??= parsed.documentElement
  invariant(root, 'Missing document element')
  root.remove()

  // Fragment parsing keeps scripts inert. Keep the root disconnected so styles
  // cannot enforce CSP before their response nonces have been rewritten.
  root.innerHTML = content
  removeNoscriptContents(root)
  return root
}

function removeNoscriptContents(source: ParentNode): void {
  // Frame navigation requires scripting; fallback markup must stay inactive.
  for (let noscript of source.querySelectorAll('noscript')) noscript.textContent = ''
  for (let template of source.querySelectorAll('template')) {
    removeNoscriptContents(template.content)
  }
}
