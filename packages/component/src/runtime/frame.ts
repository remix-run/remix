import { getNonceManager, type ResourceNonces } from './nonce.ts'
import {
  Fragment,
  FRAME_NODE,
  invariant,
  jsx,
  Portal,
  PORTAL_NODE,
  type ElementFunction,
  type RemixElement,
  type RemixNode,
} from './vnode.ts'
import type {
  FrameContent,
  FrameHandle,
  FrameProps,
  FrameReloadOptions,
  FrameResolution,
  Handle,
  ReloadOrigin,
  RenderFn,
} from './component.ts'
import {
  createComponentErrorEvent,
  createFrameHandle,
  createFrameReloadStartEvent,
  createRangeRoot,
  createRoot,
  excludePortalRanges,
  findContextFromAncestry,
  getComponentError,
  insertDomNode,
  missingFrameRuntime,
  remove,
  type CommittedFrameNode,
  type FrameNode,
  type FrameNodeRenderer,
  type HydrationCursor,
  type ReconcileContext,
  type VirtualRoot,
  type VNodeParent,
} from './vdom.ts'
import {
  createFrameRuntime,
  disposeClientEntryBoundary,
  FrameRegistry,
  getClientEntryBoundaryOwner,
  getFrameRuntime,
  getSharedFrameRuntime,
  pendingPrefetchLinks,
  spaResponses,
  isFrameRuntime,
  navigationRequest,
  setClientEntryBoundaryOwner,
  type ClientEntryIdentity,
  type FrameMountState,
  type FrameNavigationOptions,
  type FrameReloadResult,
  type FrameReloadTransition,
  type FrameRuntime,
  type SharedFrameRuntime,
  type ReconciliationTracker,
} from './frame-runtime.ts'
import {
  collectNodeRange,
  diffElementAttributes,
  diffNodes,
  findEndMarker,
  findOptionalEndMarker,
  getClientEntryKey,
} from './diff-dom.ts'
import {
  createStyleManager,
  getDefaultStyleManager,
  type StyleManager,
} from '../style/stylesheet.ts'
import { css } from '../style/css-mixin.ts'
import { createMixin } from './mixins/mixin.ts'
import type { CSSProps } from '../style/css-mixin.ts'
import {
  createFrameStartMarker,
  findFlushMarkers,
  ESCAPED_OBJECT,
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
  [PORTAL_NODE]?: true
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

function createLinkedAbortController(signal?: AbortSignal): {
  controller: AbortController
  disconnect: () => void
} {
  let controller = new AbortController()
  let abort = () => controller.abort()
  if (signal?.aborted) abort()
  else signal?.addEventListener('abort', abort, { once: true })
  return { controller, disconnect: () => signal?.removeEventListener('abort', abort) }
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
  return reload({ ...options, [navigationRequest]: true })
}

export type FrameContext = SharedFrameRuntime & {
  reloadOrigin?: ReloadOrigin
  nonce?: string
  navigationType?: NavigationType
  from?: NavigationHistoryEntry
  topFrame?: FrameHandle
  getContext: (type: ElementFunction) => unknown
  frame: FrameHandle
  data: RmxData
  lifecycleSignal: AbortSignal
  regionTailRef?: ChildNode | null
  regionParent?: ParentNode | null
  signal?: AbortSignal
  shouldPreserveHeadNode?: (node: Node) => boolean
  reconciliationTracker?: ReconciliationTracker
  blockingFrameTracker?: ReconciliationTracker
}

type FrameInit = Omit<SharedFrameRuntime, 'styleManager'> & {
  nonce?: string
  navigationType?: NavigationType
  from?: NavigationHistoryEntry
  signal?: AbortSignal
  name?: string
  loading?: FrameProps['loading']
  topFrame?: FrameHandle
  getContext?: (type: ElementFunction) => unknown
  src: string
  styleManager?: StyleManager
  marker?: FrameMarkerData
  data: RmxData
  disposeFallback?: () => void
}

// The active reload and its completion outcome. Superseded requests finish as aborted without
// dispatching reloadComplete; ancestor resolution can continue an inherited reload.
type FrameReloadState =
  | {
      status: 'idle'
      controller?: undefined
      origin?: undefined
      finished?: undefined
      disconnect?: undefined
    }
  // An ancestor reload is replacing this frame's content. It completes when that content renders
  // or the ancestor's signal aborts.
  | {
      status: 'inherited'
      controller?: undefined
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

type PendingTemplateWatch = {
  markerId: string
  signal: AbortSignal | undefined
  onResolved?: () => void
  dispose?: () => void
}

export type FrameInstance = {
  resolveClientFrame(
    node: CommittedFrameNode,
    runtime: FrameRuntime,
    reload?: FrameRuntime['serverFrameReload'],
  ): void
  render: (content: InternalFrameContent, options?: RenderOptions) => Promise<void>
  ready: () => Promise<void>
  flush: () => void
  clearPendingTemplateWatch: () => void
  isDisplayingResolvedContent: () => boolean
  shouldLoadForAncestorReload: () => boolean
  updateLoading: (loading: FrameProps['loading']) => void
  deferLoad: (load?: () => void) => void
  startDeferredLoad: () => void
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
  readonly identity: { src: string; name?: string } | undefined
  dispose: () => void
  handle: FrameHandle
}

type RenderOptions = {
  reloadOrigin?: ReloadOrigin
  nonce?: string
  navigationType?: NavigationType
  from?: NavigationHistoryEntry
  documentHref?: string
  clientStreamSignal?: AbortSignal
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
  // A settled request keeps its controller while a lazy frame waits to become visible again.
  let currentRequest: AbortController | undefined
  let activeCommit: AbortController | undefined
  let activeReload: FrameReloadState = { status: 'idle' }
  let eventController: AbortController | undefined
  let observation: { load: () => void; disconnect: () => void } | undefined
  let disposed = false
  let loading = init.loading ?? (init.marker?.status === 'lazy' ? 'lazy' : 'eager')
  let contentState: 'pending' | 'started' | 'resolved' =
    init.marker?.status === 'resolved' ? 'resolved' : 'pending'
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
      modulePreloader.isActivePreload(node)
    )
  }

  if (isDocumentNode(container.root)) {
    modulePreloader.adoptInitialPreloadLinks(container.root)
  } else {
    initialClientEntryResources = consumeClientEntryResources(container.root)
  }

  if (container.doc.getElementById('rmx-data')) mergeRmxDataFrom(init.data, container.doc)

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
      cancelCommit()
      await render(content)
    },
  })
  runtime.topFrame = runtime.topFrame ?? init.topFrame ?? frame

  let frameName = init.marker?.name ?? init.name
  if (frameName) {
    init.registry.register(frameName, frame)
  }

  let context: FrameContext = {
    topFrame: runtime.topFrame,
    getContext: (type) => runtime.getContext?.(type),
    ...getSharedFrameRuntime(runtime),
    frame,
    // Child frames share newly discovered document data, then release their own references.
    data: init.marker ? { ...init.data } : init.data,
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
    flushKind?: FlushKind,
  ): Promise<void> {
    if (isRenderAborted(options.signal)) return
    startRendering()

    function applyBatch(html: string, kind: FlushKind) {
      return renderContent(html, options, kind)
    }

    if (content instanceof ReadableStream) {
      let signal = options.signal
        ? AbortSignal.any([lifecycleController.signal, options.signal])
        : lifecycleController.signal
      await renderFrameStream(
        content,
        container.doc,
        applyBatch,
        options.nonce,
        signal,
        options.clientStreamSignal,
      )
      return
    }

    if (typeof content !== 'string' && !isDocumentFragmentNode(content)) {
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
        runtime.serverFrameReload = getRenderReload(options.signal, options)
      }

      try {
        contentRoot.render(content)
        await new Promise<void>((resolve) => context.scheduler.enqueueCommitPhase([resolve]))
        if (!isRenderAborted(options.signal)) contentState = 'resolved'
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
      if (!flushKind) {
        let remainder = await consumeFlushBatches(content, applyBatch)
        if (remainder !== content) {
          if (remainder) await applyBatch(remainder, 'fragment')
          return
        }
      }
      source =
        container.root instanceof Document && (flushKind ?? inferFlushKind(content)) === 'document'
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
    let responseContext = { ...options, ...context, data: options.data }
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
        shouldPreserveHeadNode: shouldPreserveManagedHeadNode,
      }
      diffNodes([container.doc.head], [head], documentContext)
      diffNodes([container.doc.body], [body], documentContext)

      hydrationContainer = createElementContainer(container.doc.body)
      if (isRenderAborted(options.signal)) return
    } else {
      if (isRenderAborted(options.signal)) return

      diffNodes(container.childNodes, Array.from(source.childNodes), responseContext)
    }

    let subFramesReady = hydrateContainer(hydrationContainer, responseContext, options)
    // Visible content can reload in place while its sub-frames are still settling.
    if (!isRenderAborted(options.signal)) contentState = 'resolved'
    options.onCommit?.()
    await subFramesReady
  }

  function isRenderAborted(signal?: AbortSignal): boolean {
    return disposed || lifecycleController.signal.aborted || signal?.aborted === true
  }

  function getContentNodes(): Node[] {
    return container.root instanceof Document
      ? Array.from(container.doc.body.childNodes)
      : container.childNodes
  }

  function clearFrameContent() {
    for (let node of excludePortalRanges(getContentNodes())) {
      node.parentNode?.removeChild(node)
    }
  }

  async function hydrateInitial(): Promise<void> {
    try {
      if ((await initialClientEntryResources) === false || isRenderAborted(init.signal)) return
      adoptFrameServerStyles(container, context.styleManager)
      let reconciliationTracker = createReconciliationTracker()
      let initial = { nonce: init.nonce, navigationType: init.navigationType, from: init.from }
      let options = { ...initial, reconciliationTracker, signal: init.signal }
      await hydrateContainer(container, { ...context, ...initial }, options)

      if (isRenderAborted(init.signal)) return

      if (currentMarker?.status === 'pending') {
        await watchPendingFrameTemplate(currentMarker, options)
      } else if (currentMarker?.status === 'lazy' && contentState === 'pending') {
        deferLoad(loadLazyFrame)
      }

      await reconciliationTracker.finish()
    } finally {
      clearRmxData(context.data)
    }
  }

  let readyPromise = hydrateInitial()

  return {
    resolveClientFrame,
    render,
    ready: () => readyPromise,
    flush: () => context.scheduler.dequeue(),
    clearPendingTemplateWatch: clearPendingFrameTemplateWatch,
    isDisplayingResolvedContent: () => contentState === 'resolved',
    shouldLoadForAncestorReload,
    updateLoading(value) {
      loading = value ?? 'eager'
    },
    deferLoad,
    startDeferredLoad,
    startInheritedReload,
    rejectInheritedReloadFinished,
    completeInheritedReload,
    updateMarker,
    renderMarkerContent,
    get identity() {
      return disposed ? undefined : { src: frame.src, name: frameName }
    },
    dispose,
    handle: frame,
  }

  function shouldLoadForAncestorReload(): boolean {
    return loading !== 'lazy' || contentState !== 'pending'
  }

  function loadLazyFrame(
    signal?: AbortSignal,
    navigationType?: NavigationType,
    from?: NavigationHistoryEntry,
  ): void {
    // Viewport loading completes initial content; active reloads keep their lifecycle.
    let controller = startLoad(
      !signal && activeReload.status === 'idle' && contentState !== 'resolved'
        ? 'initial'
        : signal
          ? 'ancestor'
          : 'direct',
      signal,
      activeReload.origin,
    )
    // Resolution reports errors before rejecting.
    void resolveAndRenderReload(controller, undefined, { navigationType, from }).catch(() => {})
  }

  function startRendering(): void {
    if (contentState === 'pending') contentState = 'started'
    cancelDeferral()
  }

  function cancelDeferral(): void {
    let previous = observation
    observation = undefined
    previous?.disconnect()
  }

  function cancelCommit(): void {
    let previous = activeCommit
    activeCommit = undefined
    previous?.abort()
  }

  function deferLoad(requested?: () => void): void {
    let load = requested ?? observation?.load
    if (!load) return
    cancelDeferral()
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
    observation = {
      load,
      disconnect() {
        mutations.disconnect()
        unobserve()
      },
    }
  }

  function startDeferredLoad(): void {
    let load = observation?.load
    cancelDeferral()
    if (isRenderAborted()) return
    if (load) {
      load()
    } else if (currentMarker?.status === 'lazy' && contentState === 'pending') {
      loadLazyFrame()
    }
  }

  function notifyReloadStart(finished: ReloadFinished, origin?: ReloadOrigin): void {
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

  function startReloadEvent(
    signal?: AbortSignal,
    request?: AbortController,
  ): ReloadFinished | undefined {
    let previous = eventController
    previous?.abort()
    // Aborting can synchronously start another reload or dispose the frame.
    if (eventController !== previous) return
    if (request) return createReloadFinished(request)
    let { controller, disconnect } = createLinkedAbortController(signal)
    return createReloadFinished(controller, disconnect)
  }

  function startLoad(
    origin: FrameLoadOrigin,
    signal?: AbortSignal,
    reloadOrigin?: ReloadOrigin,
  ): AbortController {
    cancelCommit()
    startRendering()
    if (origin === 'initial') {
      let previous = currentRequest
      let controller = new AbortController()
      currentRequest = controller
      if (previous) {
        previous.abort()
        completeLoad(previous)
      }
      return controller
    }

    let previous = activeReload
    currentRequest?.abort()
    leaveReloadState()

    let { controller, disconnect } = createLinkedAbortController(signal)
    let navigation = getFrameCommitNavigation(signal)
    if (navigation) setFrameCommitNavigation(controller.signal, navigation)
    // Ancestor resolution continues the reload announced while waiting for its response.
    // Direct requests each need an event carrying their own request details and outcome.
    let continued =
      origin === 'ancestor' && (previous.status === 'inherited' || previous.status === 'ancestor')
        ? previous
        : undefined
    let finished = continued?.finished
    if (!finished) {
      finished = startReloadEvent(signal, origin === 'direct' ? controller : undefined)
      if (!finished) {
        disconnect()
        controller.abort()
        return controller
      }
    }
    eventController = finished.controller
    if (!continued) {
      settleReloadFinished(previous.finished, { aborted: true })
    }
    if (origin === 'ancestor') reloadOrigin ??= previous.origin
    currentRequest = controller
    activeReload = { status: origin, controller, disconnect, finished, origin: reloadOrigin }

    if (!continued) {
      notifyReloadStart(finished, reloadOrigin)
    }
    if (origin === 'direct' || previous.status === 'idle' || previous.status === 'direct') {
      startSubFrameInheritedReloads(getContentNodes(), controller.signal, reloadOrigin)
    }
    return controller
  }

  function completeLoad(controller: AbortController, failure?: ReloadFailure): void {
    if (activeReload.controller === controller) {
      let finished = activeReload.finished
      let outcome: ReloadFailure | undefined =
        failure ?? (controller.signal.aborted ? { aborted: true } : undefined)
      finishReload(finished, outcome)
    }
    // reloadComplete listeners can synchronously start another request or dispose the frame.
    if (currentRequest !== controller) return
    if (controller.signal.aborted && loading === 'lazy' && contentState !== 'resolved') {
      // A targeted navigation may have changed the source since the client frame mounted.
      deferLoad(loadLazyFrame)
    }
  }

  function rejectLoad(controller: AbortController, error: unknown): void {
    if (activeReload.controller !== controller) return
    activeReload.finished.reject(error)
    rejectSubFrameInheritedReloadFinished(getContentNodes(), error)
  }

  function startInheritedReload(
    signal?: AbortSignal,
    origin?: ReloadOrigin,
    takeOverRequest = false,
  ): void {
    if (signal?.aborted) return
    if (!takeOverRequest && activeReload.controller) {
      activeReload.origin = origin
      startSubFrameInheritedReloads(getContentNodes(), signal, origin)
      return
    }
    let previous = activeReload
    let previousController = takeOverRequest ? currentRequest : undefined
    if (takeOverRequest) currentRequest = undefined
    leaveReloadState()
    let disconnect: (() => void) | undefined
    if (signal) {
      let abort = () => completeInheritedReload({ aborted: true })
      signal.addEventListener('abort', abort, { once: true })
      disconnect = () => signal.removeEventListener('abort', abort)
    }
    let finished = previous.finished
    if (!finished) {
      finished = startReloadEvent(signal)
      if (!finished) {
        disconnect?.()
        previousController?.abort()
        return
      }
    }
    eventController = finished.controller
    activeReload = { status: 'inherited', disconnect, finished, origin }
    if (!previous.finished) {
      notifyReloadStart(finished, origin)
    }
    if (previous.status !== 'inherited')
      startSubFrameInheritedReloads(getContentNodes(), signal, origin)
    // Publish inherited ownership before aborting the request it supersedes.
    previousController?.abort()
    if (takeOverRequest) cancelCommit()
  }

  function rejectInheritedReloadFinished(error: unknown): void {
    if (activeReload.status !== 'inherited') return
    activeReload.finished.reject(error)
    rejectSubFrameInheritedReloadFinished(getContentNodes(), error)
  }

  function completeInheritedReload(failure?: ReloadFailure): void {
    if (activeReload.status !== 'inherited') return
    finishReload(activeReload.finished, failure)
  }

  function finishReload(finished: ReloadFinished, failure?: ReloadFailure): void {
    settleReloadFinished(finished, failure)
    leaveReloadState()
    if (failure !== undefined)
      completeSubFrameInheritedReloads(getContentNodes(), failure, finished)
    if (eventController === finished.controller) frame.dispatchEvent(new Event('reloadComplete'))
  }

  function dispose(): void {
    if (disposed) return
    disposed = true
    cancelDeferral()
    lifecycleController.abort()
    cancelCommit()
    clearRmxData(context.data)
    currentRequest?.abort()
    currentRequest = undefined
    eventController?.abort()
    eventController = undefined
    settleReloadFinished(activeReload.finished, { aborted: true })
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
      init.registry.unregister(frameName, frame)
    }
  }

  function setCurrentMarker(
    marker: FrameMarkerData,
    signal?: AbortSignal,
    origin?: ReloadOrigin,
  ): boolean {
    loading = marker.status === 'lazy' ? 'lazy' : 'eager'
    if (marker.status !== 'lazy') cancelDeferral()
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
        isInheritedReload || activeReload.status === 'inherited'
          ? () => {
              completeInheritedReload()
            }
          : undefined,
      )
    } else {
      clearPendingFrameTemplateWatch()
      if (marker.status === 'lazy') {
        if (isInheritedReload && shouldLoadForAncestorReload()) {
          loadLazyFrame(options?.signal, options?.navigationType, options?.from)
        } else if (contentState !== 'resolved' && !currentRequest) {
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
      activeReload.status === 'inherited'

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
    cancelCommit()
    let controller = (activeCommit = new AbortController())
    return commitFrameResponse(response, commit, swap, {
      to,
      signal,
      commitSignal: AbortSignal.any([controller.signal, lifecycleController.signal]),
      onError: (error) => init.errorTarget.dispatchEvent(createComponentErrorEvent(error)),
    })
  }

  function resolveClientFrame(
    node: CommittedFrameNode,
    runtime: FrameRuntime,
    serverFrameReload?: NonNullable<FrameRuntime['serverFrameReload']>,
  ): void {
    let frameSrc = node.props.src
    let controller = startLoad(
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
          ...(serverFrameReload?.navigationType
            ? { navigationType: serverFrameReload.navigationType, from: serverFrameReload.from }
            : {}),
        }),
      )
      .then(async (resolution) => {
        await renderResolution(
          resolution,
          signal,
          () => signal.aborted,
          () => frameSrc,
          (content, nonce) =>
            render(content, {
              clientStreamSignal: signal,
              reloadOrigin: serverFrameReload?.origin,
              nonce,
              navigationType: serverFrameReload?.navigationType,
              from: serverFrameReload?.from,
              signal,
              reconciliationTracker: serverFrameReload?.reconciliationTracker,
              blockingFrameTracker: serverFrameReload?.blockingFrameTracker,
              onCommit: frameCommitted.resolve,
            }),
        )
      })
      .catch((error) => {
        if ((serverFrameReload || node.props.loading === 'lazy') && !signal.aborted) {
          failure = { error }
          rejectLoad(controller, error)
          runtime.errorTarget.dispatchEvent(createComponentErrorEvent(error))
        }
      })
      .finally(() => {
        frameCommitted.resolve()
        completeLoad(controller, failure)
      })

    if (!node.props.fallback) {
      serverFrameReload?.reconciliationTracker?.waitFor(resolve)
      serverFrameReload?.blockingFrameTracker?.waitFor(frameCommitted.promise)
    }
  }

  async function renderResolution(
    resolution: FrameResolution,
    signal: AbortSignal,
    isStale: () => boolean,
    getSource: () => string,
    renderContent: (content: FrameContent, nonce?: string, redirectedTo?: string) => Promise<void>,
  ): Promise<FrameReloadResult> {
    let commit = takeFrameCommit(resolution)
    if (isStale()) return { signal }
    let { content, nonce, redirectedTo } = await unwrapFrameResolution(resolution)
    if (isStale()) return { signal }
    let swap = () => renderContent(content, nonce, redirectedTo)
    if (commit && resolution instanceof Response) {
      await commitResponse(resolution, commit, swap, signal, redirectedTo ?? getSource())
    } else {
      await swap()
    }
    return { signal, redirectedTo: isStale() ? undefined : redirectedTo }
  }

  function startReload(options?: FrameNavigationOptions): AbortController {
    let method = options?.method?.toLowerCase() ?? 'get'
    return startLoad('direct', options?.signal, {
      src: frame.src,
      method,
      encType: method === 'post' ? (options?.encType ?? 'application/x-www-form-urlencoded') : null,
      formData: method === 'post' ? options?.formData : undefined,
      element: options?.element,
      submitter: options?.submitter,
    })
  }

  function leaveReloadState(): void {
    activeReload.disconnect?.()
    activeReload = { status: 'idle' }
  }

  async function resolveAndRenderReload(
    controller: AbortController,
    committed?: PromiseWithResolvers<void>,
    options?: FrameNavigationOptions,
  ): Promise<FrameReloadResult> {
    let isStale = () => currentRequest !== controller || controller.signal.aborted
    let origin = activeReload.controller === controller ? activeReload.origin : undefined
    let failure: ReloadFailure | undefined
    try {
      let { element: _, submitter: __, form: ___, ...resolveOptions } = options ?? {}
      let resolution = await init.resolveFrame(frame.src, {
        ...resolveOptions,
        signal: controller.signal,
        target: frameName,
      })
      if (
        !isStale() &&
        isDocumentNode(container.root) &&
        (options?.method ?? 'get').toLowerCase() === 'get' &&
        isFileResponse(resolution)
      ) {
        // The browser committed the destination before the response arrived, so rendering a file
        // would show its bytes as text. Discard the body and let the browser load the destination
        // as its own document. A POST keeps rendering because a document load cannot replay its
        // body.
        await resolution.body?.cancel()
        reloadDocument(container.doc, resolution.url || frame.src)
        return { signal: controller.signal }
      }
      return await renderResolution(
        resolution,
        controller.signal,
        isStale,
        () => frame.src,
        async (content, nonce, redirectedTo) => {
          let reconciliationTracker = createReconciliationTracker()
          let blockingFrameTracker = createReconciliationTracker()
          let commitStarted = false
          await render(content, {
            reloadOrigin: origin,
            nonce,
            navigationType: options?.navigationType,
            from: options?.from,
            documentHref: isDocumentNode(container.root) ? (redirectedTo ?? frame.src) : undefined,
            signal: controller.signal,
            reconciliationTracker,
            blockingFrameTracker,
            onCommit() {
              if (commitStarted) return
              commitStarted = true
              let ready = blockingFrameTracker.finish()
              if (committed) void ready.then(committed.resolve, committed.reject)
            },
          })
          await reconciliationTracker.finish()
        },
      )
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

  function startSubFrameInheritedReloads(
    nodes: Node[],
    signal?: AbortSignal,
    origin?: ReloadOrigin,
  ): void {
    visitSubFrames(nodes, context, (child) => child.startInheritedReload(signal, origin), signal)
  }

  function rejectSubFrameInheritedReloadFinished(nodes: Node[], error: unknown): void {
    visitSubFrames(nodes, context, (child) => child.rejectInheritedReloadFinished(error))
  }

  function completeSubFrameInheritedReloads(
    nodes: Node[],
    failure: ReloadFailure,
    finished: ReloadFinished,
  ): void {
    walkNodes(nodes, (node) => {
      // A completion listener can synchronously start a new ancestor reload.
      if (eventController !== finished.controller) return
      if (!isFrameStart(node)) return
      let end = findFrameEndMarker(node)
      context.registry.instances.get(node)?.completeInheritedReload(failure)
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
    let { reconciliationTracker, signal, nonce, reloadOrigin, navigationType, from } = options
    if (isRenderAborted(signal)) return
    // A replayed template can reach the initial watcher before its shell accepts the marker.
    let rendering = pendingTemplateRender
    if (
      onResolved &&
      rendering?.markerId === marker.id &&
      rendering.controller === eventController
    ) {
      await rendering.ready
      if (!isRenderAborted(signal) && rendering.controller === eventController) onResolved?.()
      return
    }
    if (
      pendingTemplateWatch?.markerId === marker.id &&
      (pendingTemplateWatch.signal === signal || pendingTemplateWatch.signal === undefined)
    ) {
      // Initial streamed content must survive cancellation of a later navigation.
      let controller = eventController
      pendingTemplateWatch.onResolved = onResolved
        ? () => {
            if (!isRenderAborted(signal) && eventController === controller) onResolved()
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
        let inheritedReload = activeReload
        let renderOrigin =
          inheritedReload.status === 'inherited' ? inheritedReload.origin : reloadOrigin
        let ready = Promise.withResolvers<void>()
        pendingTemplateRender = {
          markerId: marker.id,
          controller: eventController,
          ready: ready.promise,
        }
        try {
          await render(fragment, {
            navigationType,
            from,
            nonce,
            signal,
            reloadOrigin: renderOrigin,
          })
        } catch (error) {
          if (isRenderAborted(signal) || activeReload !== inheritedReload) return
          rejectInheritedReloadFinished(error)
          init.errorTarget.dispatchEvent(createComponentErrorEvent(error))
          if (activeReload === inheritedReload) completeInheritedReload({ error })
          return
        } finally {
          ready.resolve()
        }
        if (!isRenderAborted(signal) && activeReload === inheritedReload) watch.onResolved?.()
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
      navigationType,
      from,
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
  let currSrc = curr.props.src
  let nextSrc = next.props.src
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
    frameInstance.handle.src = nextSrc
    if (frameRuntime) {
      frameInstance.resolveClientFrame(committed, frameRuntime, serverFrameReload)
    }
  } else if (frameRuntime && serverFrameReload) {
    if (frameInstance.shouldLoadForAncestorReload()) {
      // Reload client frames whose content is loaded or already being requested.
      frameInstance.resolveClientFrame(committed, frameRuntime, serverFrameReload)
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

function ensureFrameRuntime(frame: FrameHandle): FrameRuntime | undefined {
  let existing = getFrameRuntime(frame)
  if (existing) return existing
  let stub = frame.$runtime as
    | {
        frameInit?: {
          resolveFrame?: SharedFrameRuntime['resolveFrame']
          loadModule?: SharedFrameRuntime['loadModule']
        }
        errorTarget?: EventTarget
        scheduler?: SharedFrameRuntime['scheduler']
        styleManager?: StyleManager
        styleRoot?: ParentNode
      }
    | undefined
  let init = stub?.frameInit
  if (!init?.resolveFrame || !stub?.errorTarget || !stub.scheduler) return undefined
  let styleManager = stub.styleManager ?? getDefaultStyleManager()
  if (stub.styleRoot) styleManager.adoptServerStyles(stub.styleRoot)
  let runtime = createFrameRuntime({
    loadModule:
      init.loadModule ??
      (() => {
        throw new Error('loadModule is required to hydrate client entries inside <Frame />')
      }),
    resolveFrame: init.resolveFrame,
    errorTarget: stub.errorTarget,
    scheduler: stub.scheduler,
    styleManager,
    registry: new FrameRegistry(),
    topFrame: frame,
  })
  frame.$runtime = runtime
  return runtime
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
  let { frame } = context
  let runtime = ensureFrameRuntime(frame)
  if (!runtime) missingFrameRuntime()
  let styles = context.styles ?? runtime.styleManager

  let getContext = (type: ElementFunction) => findContextFromAncestry(vParent, type)

  // Hydration path: adopt server-rendered frame markers and reuse the existing
  // frame instance created during hydration.
  if (isFrameStart(cursor?.current)) {
    let start = cursor.current
    let end = findOptionalEndMarker(start, isFrameStart, isFrameEnd)
    if (end) {
      let instance = runtime.registry.instances.get(start)
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
    instance.deferLoad(() => instance.resolveClientFrame(committed, runtime))
  } else {
    instance.resolveClientFrame(committed, runtime, runtime.serverFrameReload)
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
    src: node.props.src,
    getContext,
    ...getSharedFrameRuntime(runtime),
    data: {},
    disposeFallback,
  })
  runtime.registry.instances.set(start, instance)
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

function getFrameName(node: FrameNode | CommittedFrameNode): string | undefined {
  let name = node.props.name
  return typeof name === 'string' && name.length > 0 ? name : undefined
}

function randomFrameId(): string {
  return `f${crypto.randomUUID().slice(0, 8)}`
}

function createReconciliationTracker(): ReconciliationTracker {
  let ready = Promise.withResolvers<void>()
  // finish() releases the first count once the initial work has been scheduled.
  let pending = 1
  let failure: { error: unknown } | undefined

  function complete() {
    if (--pending !== 0) return
    if (failure) ready.reject(failure.error)
    else ready.resolve()
  }

  return {
    waitFor(task) {
      pending++
      void task.then(complete, (error) => {
        failure ??= { error }
        complete()
      })
    },
    finish() {
      complete()
      return ready.promise
    },
  }
}

function mergeRmxDataFrom(into: RmxData, root: ParentNode): void {
  for (let script of root.querySelectorAll('script#rmx-data')) {
    if (!(script instanceof HTMLScriptElement)) continue
    let { h, f } = parseRmxDataScript(script)
    if (h) copyOwnRmxEntries((into.h ??= {}), h)
    if (f) copyOwnRmxEntries((into.f ??= {}), f)
    script.remove()
  }
}

function clearRmxData(data: RmxData): void {
  delete data.h
  delete data.f
}

function removeEmptyHeads(fragment: DocumentFragment): void {
  for (let head of fragment.querySelectorAll('head')) {
    if (!head.childNodes.length) {
      head.remove()
    }
  }
}

function adoptFrameServerStyles(container: FrameContainer, styleManager: StyleManager): void {
  let styles: HTMLStyleElement[] = []
  let nodes =
    container.root instanceof Document
      ? [...container.doc.head.childNodes, ...container.doc.body.childNodes]
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
    let source = script.textContent || '{}'
    let data: RmxData = JSON.parse(source)
    // A JSON escape can spell part of the tag. Inspect the decoded props in either case.
    if (data.h && !Object.hasOwn(Portal, PORTAL_NODE) && /\$rmxPortal|\\u/.test(source)) {
      for (let entry of Object.values(data.h)) {
        if (entry && hasSerializedPortal(entry.props)) entry[PORTAL_NODE] = true
      }
    }
    return data
  } catch {
    console.error('[createFrame] Failed to parse rmx-data script')
    return {}
  }
}

function hasSerializedPortal(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasSerializedPortal)
  if (!isRecord(value)) return false
  let escaped = value[ESCAPED_OBJECT]
  if (isRecord(escaped)) return Object.values(escaped).some(hasSerializedPortal)
  return value.$rmxPortal === true || Object.values(value).some(hasSerializedPortal)
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
): Promise<void> | undefined {
  let hydrationData = context.data.h
  let markers: HydrationMarker[] = []
  let parent = container.regionStart && frameClientEntryParents.get(container.regionStart)
  let frames: Array<() => void> = []
  let subFramesReady = visit(container.childNodes, parent)
  let hydrations: Array<{
    marker: HydrationMarker
    entry: HydrationData
    complete: () => void
  }> = []

  for (let marker of markers) {
    let entry = hydrationData?.[marker.id]
    if (!entry) continue
    if (!context.registry.entries.has(marker.start)) {
      context.registry.entries.set(marker.start, [marker.end, undefined])
    }
    let { promise, resolve } = Promise.withResolvers<void>()
    pendingClientEntryHydrations.set(marker.start, promise)
    options?.reconciliationTracker?.waitFor(promise)
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

  // A cached entry can synchronously adopt a frame. Register all owners before rendering it.
  for (let start of frames) start()
  for (let { marker, entry, complete } of hydrations) {
    scheduleHydrationMarker(marker, entry, context, complete, options?.signal)
  }
  return subFramesReady

  function visit(nodes: Node[], parent?: Comment): Promise<void> | undefined {
    let tasks: Promise<void>[] = []
    nodes = excludePortalRanges(nodes)
    let boundaries: typeof markers = []
    for (let i = 0; i < nodes.length; i++) {
      let node = nodes[i]

      // Nested frames discover their own entries, inheriting this pass's enclosing boundary.
      if (isFrameStart(node)) {
        if (parent) frameClientEntryParents.set(node, parent)
        else frameClientEntryParents.delete(node)
        let end = findFrameEndMarker(node)
        i = findMarkerRangeEndIndex(nodes, end, i)
        let task = Promise.withResolvers<void>()
        tasks.push(task.promise)
        frames.push(() => task.resolve(startFrame(node, end)))
        continue
      }

      if (isHydrationStart(node)) {
        let id = getHydrationId(node)
        // Fill in the end before starting hydration. Markers stay in parent-first order.
        let boundary = { id, start: node, end: node, parent }
        markers.push(boundary)
        boundaries.push(boundary)
        if (hydrationData?.[id] || pendingClientEntryHydrations.has(node)) parent = node
      } else if (isHydrationEnd(node)) {
        let boundary = boundaries.pop()
        if (boundary) {
          boundary.end = node
          parent = boundary.parent
        }
      }
      if (node.firstChild) {
        let nested = visit(Array.from(node.childNodes), parent)
        if (nested) tasks.push(nested)
      }
    }
    if (boundaries.length) throw new Error('End marker not found')
    if (tasks.length) return Promise.all(tasks).then(() => {})
  }

  async function startFrame(node: Comment, end: Comment): Promise<void> {
    if (options?.signal?.aborted) return
    let existingFrame = context.registry.instances.get(node)
    let id = getFrameId(node)
    let marker = context.data.f?.[id]

    if (!marker) {
      existingFrame?.clearPendingTemplateWatch()
      return
    }
    let frameMarker = { ...marker, id }
    if (existingFrame) return existingFrame.updateMarker(frameMarker, options)

    let subFrame = createFrame([node, end], {
      nonce: context.nonce,
      navigationType: context.navigationType,
      from: context.from,
      signal: options?.signal,
      src: marker.src,
      topFrame: context.topFrame,
      getContext: context.getContext,
      ...getSharedFrameRuntime(context),
      data: context.data,
      marker: frameMarker,
    })
    context.registry.instances.set(node, subFrame)
    if (marker.status === 'resolved') return subFrame.ready()
  }
}

function scheduleHydrationMarker(
  marker: HydrationMarker,
  entry: HydrationData,
  context: FrameContext,
  onComplete: () => void,
  signal?: AbortSignal,
): void {
  if (signal?.aborted || context.lifecycleSignal.aborted) {
    onComplete()
    return
  }

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
  }

  signal?.addEventListener('abort', complete, { once: true })
  context.lifecycleSignal.addEventListener('abort', complete, { once: true })

  let hydrateWithComponent = (component: ElementFunction) => {
    if (signal?.aborted || context.lifecycleSignal.aborted) return
    if (!isHydrationMarkerLive(marker, context)) return
    if (!props) return
    let pending = context.registry.entries.get(marker.start)
    let vElement = pending?.[1] ?? createElement(component, props)
    context.registry.entries.set(marker.start, [marker.end, vElement])
    hydrateRegion(vElement, marker.start, marker.end, identity, context, signal, pending?.[2])
  }

  let parentHydration = marker.parent && pendingClientEntryHydrations.get(marker.parent)
  let component =
    context.registry.modules.get(key) ?? loadClientEntry(key, identity, marker.id, context)
  let portal =
    entry[PORTAL_NODE] && !Object.hasOwn(Portal, PORTAL_NODE) ? import('./portal.ts') : undefined
  if (typeof component === 'function' && !parentHydration && !portal) {
    hydrateWithComponent(component)
    complete()
    return
  }

  // Imports can finish in any order, but setup must wait for the owning entry's context.
  Promise.all([component, parentHydration, portal])
    .then(
      ([component]) => {
        if (component) hydrateWithComponent(component)
      },
      (error) => console.error(`[createFrame] Failed to load Portal for ${marker.id}:`, error),
    )
    .finally(complete)
}

function loadClientEntry(
  key: string,
  identity: ClientEntryIdentity,
  markerId: string,
  context: FrameContext,
): Promise<ElementFunction | undefined> {
  let { promise, resolve } = Promise.withResolvers<ElementFunction | undefined>()
  context.registry.modules.set(key, promise)
  void load()
  return promise

  async function load(): Promise<void> {
    try {
      let component = await context.loadModule(identity.moduleUrl, identity.exportName)
      if (!isElementFunction(component)) {
        throw new Error(
          `Export "${identity.exportName}" from "${identity.moduleUrl}" is not a function`,
        )
      }
      context.registry.modules.set(key, component)
      resolve(component)
    } catch (error) {
      context.registry.modules.delete(key)
      resolve(undefined)
      console.error(`[createFrame] Failed to load module for ${markerId}:`, error)
    }
  }
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
  if (Array.isArray(value)) return value.map(reviveSerializedValue)
  if (!isRecord(value)) return value
  let record = value

  // Revive the fields, but never interpret the escaped object's own tags.
  if (isRecord(record[ESCAPED_OBJECT])) {
    return reviveSerializedProperties(record[ESCAPED_OBJECT])
  }

  if (record.$rmxFrame === true) return reviveSerializedElement(Frame, record)
  if (record.$rmxFragment === true) return reviveSerializedElement(Fragment, record)
  if (record.$rmxPortal === true) return reviveSerializedElement(Portal, record)

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
  type: string | typeof Frame | typeof Fragment | typeof Portal,
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

function getRenderReload(signal: AbortSignal, options: RenderOptions) {
  let {
    reloadOrigin: origin,
    navigationType,
    from,
    reconciliationTracker,
    blockingFrameTracker,
  } = options
  return { signal, origin, navigationType, from, reconciliationTracker, blockingFrameTracker }
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

  context.registry.entries.delete(start)

  // During a server frame reload, expose the reload signal and reconciliation
  // tracker to client frames created while this entry renders so blocking
  // frames keep the reload pending until their content arrives.
  let renderEntry = (root: Pick<VirtualRoot, 'render'>) => {
    let nonceManager = getNonceManager()
    nonceManager.addRootResourceNonces(root, resourceNonces)
    nonceManager.addRootResponseNonce(root, context.nonce)
    if (!signal && !context.navigationType) {
      root.render(vElement)
      return
    }

    let frameRuntime = context.frame.$runtime
    invariant(
      isFrameRuntime(frameRuntime),
      'Expected frame runtime while rendering a client entry during a reload',
    )

    let previousServerFrameReload = frameRuntime.serverFrameReload

    frameRuntime.serverFrameReload = getRenderReload(signal ?? context.lifecycleSignal, context)
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
  let { errorTarget } = context
  root.addEventListener('error', (event: Event) => {
    if (errorTarget !== root)
      errorTarget.dispatchEvent(createComponentErrorEvent(getComponentError(event)))
  })
  return root
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

function visitSubFrames(
  nodes: Node[],
  context: FrameContext,
  visit: (frame: FrameInstance, start: Comment) => void,
  signal?: AbortSignal,
): void {
  walkNodes(
    nodes,
    (node) => {
      if (!isFrameStart(node)) return
      let end = findFrameEndMarker(node)
      let frame = context.registry.instances.get(node)
      if (frame) visit(frame, node)
      return end
    },
    signal,
  )
}

function disposeSubFrames(nodes: Node[], context: FrameContext): void {
  visitSubFrames(nodes, context, (frame, start) => {
    frame.dispose()
    context.registry.instances.delete(start)
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
        observeTemplates(node)
      }
    }
    publishCompleteTemplates()
  })

  function observeTemplates(node: Node): void {
    if (node instanceof HTMLTemplateElement) {
      if (node.id !== id || pending.has(node)) return
      pending.add(node)
      // Template contents are a separate fragment, outside the observed document subtree.
      observer.observe(node.content, { childList: true })
    } else if (node instanceof Element) {
      for (let template of node.querySelectorAll('template')) {
        if (template instanceof HTMLTemplateElement) observeTemplates(template)
      }
    }
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
  observeTemplates(root)
  document.addEventListener('DOMContentLoaded', publishCompleteTemplates, { once: true })

  return () => {
    observer.disconnect()
    pending.clear()
    document.removeEventListener('DOMContentLoaded', publishCompleteTemplates)
  }
}

export function publishFrameTemplate(
  id: string,
  fragment: DocumentFragment,
  options?: { inertScripts?: boolean },
): void {
  let listeners = frameTemplateListeners.get(id)
  if (!listeners) {
    let queue = bufferedFrameTemplates.get(id)
    if (queue) queue.push(fragment)
    else bufferedFrameTemplates.set(id, [fragment])
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
  if (!queue) return null

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
    if (listeners.delete(listener) && listeners.size === 0) frameTemplateListeners.delete(id)
  }
}

const COMPLETE_TEMPLATE_WITH_ID_PATTERN =
  /<template\b[^>]*\bid=(?:"[^"]+"|'[^']+')[^>]*>[\s\S]*?<\/template>/gi

async function renderFrameStream(
  stream: ReadableStream<Uint8Array>,
  doc: Document,
  applyHtml: (html: string, flushKind: FlushKind) => Promise<void>,
  responseNonce: string | undefined,
  signal: AbortSignal,
  clientStreamSignal?: AbortSignal,
): Promise<void> {
  let reader = stream.getReader()
  let decoder = new TextDecoder()
  let buffer = ''
  let html = ''
  let appliedOnce = false
  let abort = () => {
    void reader.cancel(clientStreamSignal?.reason).catch(() => {})
  }
  if (signal.aborted) {
    await reader.cancel(clientStreamSignal?.reason)
    reader.releaseLock()
    return
  }
  signal.addEventListener('abort', abort, { once: true })

  try {
    while (true) {
      let { done, value } = await reader.read()
      if (done) {
        // A template kept from the previous chunk is incomplete. Flushing the UTF-8 decoder
        // can only append a replacement character, never a closing tag.
        html += buffer + decoder.decode()
      } else {
        let previousLength = html.length
        buffer += decoder.decode(value, { stream: true })
        let cursor = 0
        for (let match of buffer.matchAll(COMPLETE_TEMPLATE_WITH_ID_PATTERN)) {
          html += buffer.slice(cursor, match.index)
          cursor = match.index + match[0].length

          let template = createFragmentFromString(doc, match[0]).querySelector('template')
          if (template instanceof HTMLTemplateElement && template.id) {
            let fragment = takeFrameTemplateContent(template)
            getNonceManager().prepareResponse(fragment, responseNonce)
            publishFrameTemplate(template.id, fragment, { inertScripts: true })
          }
        }

        // Hold the unfinished template, including an opening tag split between chunks.
        let tail = buffer.slice(cursor)
        let opening = tail.lastIndexOf('<')
        let pending =
          opening >= 0 &&
          '<template'.startsWith(tail.slice(opening, opening + '<template'.length).toLowerCase())
            ? opening
            : tail.length
        for (let match of tail.matchAll(/<template/gi)) pending = match.index
        html += tail.slice(0, pending)
        buffer = tail.slice(pending)
        if (html.length === previousLength) continue
      }

      let remainder = await consumeFlushBatches(html, applyHtml)
      if (remainder !== html) appliedOnce = true
      html = remainder
      if (done) break
    }

    // An empty stream still replaces the existing frame content.
    if (html || !appliedOnce) {
      await applyHtml(html, appliedOnce ? 'fragment' : inferFlushKind(html))
    }
  } finally {
    signal.removeEventListener('abort', abort)
    reader.releaseLock()
  }
}

async function consumeFlushBatches(
  html: string,
  applyHtml: (html: string, flushKind: FlushKind) => Promise<void>,
): Promise<string> {
  let cursor = 0
  for (let marker of findFlushMarkers(html)) {
    await applyHtml(html.slice(cursor, marker.index), marker[1] as FlushKind)
    cursor = marker.index + marker[0].length
  }
  return html.slice(cursor)
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
      return collectNodeRange(start.nextSibling, end)
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

type HydrationMarker = {
  id: string
  start: Comment
  end: Comment
  parent?: Comment
}

// Visits nodes depth-first. A visitor that handles a range returns its last node, which skips the
// rest of the range and its descendants.
function walkNodes(nodes: Node[], visit: (node: Node) => Node | void, signal?: AbortSignal): void {
  nodes = excludePortalRanges(nodes)
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

// A response that declares a media type the browser would not treat as markup. `text/plain` is
// excluded along with the HTML types: the `Response` constructor applies it to a string body, so
// resolvers that build their own responses from HTML carry it without meaning a file.
function isFileResponse(resolution: FrameResolution): resolution is Response {
  if (!(resolution instanceof Response) || spaResponses.has(resolution)) return false
  let contentType = resolution.headers.get('Content-Type')
  if (contentType === null) return false
  let mediaType = contentType.split(';', 1)[0]!.trim().toLowerCase()
  return (
    mediaType !== 'text/html' && mediaType !== 'application/xhtml+xml' && mediaType !== 'text/plain'
  )
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

type SourceElementNavigateEvent = NavigateEvent & {
  sourceElement?: Element | null
}

type FormNavigateEvent = SourceElementNavigateEvent & {
  formData?: FormData | null
}

type SubmitterElement = HTMLButtonElement | HTMLInputElement

type PendingFormSubmission = {
  form: HTMLFormElement
  submitter: SubmitterElement | null
  snapshot?: { formData: FormData; submitterEntryName: string | undefined }
  supersedingSubmit?: Event
  timeout: ReturnType<typeof setTimeout>
  removeFormDataListener(): void
}

/** Browser-provided data for an intercepted form submission. */
export interface FormSubmission {
  /** Submitted form entries for non-GET submissions, when available. */
  formData: FormData | undefined
  /** Effective form method, including submitter overrides. */
  method: string
  /** Effective form encoding type, including submitter overrides. */
  encType: string
}

/** Metadata and deferred submission data for an intercepted form navigation. */
export interface FormNavigation {
  /** The owning form captured before its submitter can be detached. */
  form: HTMLFormElement
  /** The native submit event's submitter, or `null` for a submission without one. */
  submitter: SubmitterElement | null
  /** Checks the submitter before the form for a submission attribute. */
  hasAttribute(name: string): boolean
  /** Reads a submission attribute, preferring the submitter-specific name when provided. */
  getAttribute(name: string, submitterName?: string): string | null
  /** Resolves browser-generated data for a non-GET submission. */
  getSubmission: (() => Promise<FormSubmission>) | undefined
  /** Submission details available synchronously when the navigation is accepted. */
  submission: FormSubmission
}

const PENDING_FORM_SUBMISSION_TIMEOUT = 1000

/**
 * Tracks native form events and resolves their corresponding Navigation API events.
 *
 * @param signal Signal used to stop tracking form events.
 * @returns A function that resolves form metadata for a navigation event.
 */
export function createFormNavigationResolver(
  signal: AbortSignal,
): (event: NavigateEvent) => FormNavigation | undefined {
  // Index each submission by its form and submitter so detached submitters can still find their form.
  let pendingSubmissions = new WeakMap<HTMLFormElement | SubmitterElement, PendingFormSubmission>()

  function clearPending(pending: PendingFormSubmission) {
    clearTimeout(pending.timeout)
    pending.removeFormDataListener()
    if (pendingSubmissions.get(pending.form) === pending) {
      pendingSubmissions.delete(pending.form)
    }
    if (pending.submitter && pendingSubmissions.get(pending.submitter) === pending) {
      pendingSubmissions.delete(pending.submitter)
    }
  }

  // Cache the authoritative submitter and native data for the matching `navigate` event.
  // Unmatched submits expire.
  document.addEventListener(
    'submit',
    (event) => {
      let form = event.target
      if (!(form instanceof HTMLFormElement) || !event.isTrusted || !(event instanceof SubmitEvent))
        return

      let previous = pendingSubmissions.get(form)
      if (
        previous &&
        (!previous.supersedingSubmit || previous.supersedingSubmit.defaultPrevented)
      ) {
        previous.supersedingSubmit = event
      }

      let eventSubmitter = event.submitter
      let submitter =
        eventSubmitter instanceof HTMLButtonElement || eventSubmitter instanceof HTMLInputElement
          ? eventSubmitter
          : null
      function onFormData(formDataEvent: FormDataEvent) {
        // Native formdata follows an uncanceled submit. Ignore snapshots made in submit handlers
        // or after cancellation, and stop listening before later snapshots can replace this data.
        // Firefox can retain a nonzero eventPhase after native submit dispatch has ended.
        if (event.currentTarget !== null || event.defaultPrevented) return
        // A canceled retry must not replace a submission whose navigation is still pending.
        let existing = pendingSubmissions.get(pending.form)
        if (existing) clearPending(existing)
        let submitterEntryName = submitter?.name
        if (submitter instanceof HTMLInputElement && submitter.type === 'image') {
          submitterEntryName = submitterEntryName ? submitterEntryName + '.x' : 'x'
        }
        pending.snapshot = { formData: formDataEvent.formData, submitterEntryName }
        pendingSubmissions.set(pending.form, pending)
        if (submitter) pendingSubmissions.set(submitter, pending)
        pending.removeFormDataListener()
      }
      let pending: PendingFormSubmission = {
        form,
        submitter,
        timeout: setTimeout(() => clearPending(pending), PENDING_FORM_SUBMISSION_TIMEOUT),
        removeFormDataListener() {
          form.removeEventListener('formdata', onFormData, true)
        },
      }
      form.addEventListener('formdata', onFormData, { capture: true, signal })
    },
    { capture: true, signal },
  )

  return (event) => {
    let sourceElement = (event as SourceElementNavigateEvent).sourceElement
    if (!(sourceElement instanceof Element)) return

    let form = getSourceForm(sourceElement, pendingSubmissions)
    if (!form) return

    let pending = pendingSubmissions.get(form)
    // Some browsers dispatch navigate before the new submission's formdata.
    if (
      pending &&
      (sourceElement !== (pending.submitter ?? form) ||
        (pending.supersedingSubmit && !pending.supersedingSubmit.defaultPrevented))
    ) {
      pending = undefined
    }
    let submitter =
      sourceElement instanceof HTMLButtonElement || sourceElement instanceof HTMLInputElement
        ? sourceElement
        : null
    let method = getFormMethod(form, submitter)
    let encType = getFormEncType(form, submitter)
    let target = getSubmissionAttribute(form, submitter, 'target', 'formtarget')
    if (pending) clearPending(pending)
    if (method === 'dialog' || target?.toLowerCase() === '_blank') return

    let isGet = method.toLowerCase() === 'get'
    let eventFormData = (event as FormNavigateEvent).formData
    let snapshot = pending?.snapshot
    let formData = isGet ? undefined : (eventFormData ?? snapshot?.formData)
    // Chromium and WebKit can rebuild the data after the submitter is disabled. Only prefer
    // the capture if it contains an entry for the submitter that the navigation lost.
    if (
      !isGet &&
      eventFormData &&
      snapshot?.submitterEntryName &&
      submitter?.matches(':disabled')
    ) {
      let name = snapshot.submitterEntryName
      if (snapshot.formData.getAll(name).length > eventFormData.getAll(name).length) {
        formData = snapshot.formData
      }
    }
    let getSubmission: FormNavigation['getSubmission'] = isGet
      ? undefined
      : async () => ({ formData, method, encType })
    return {
      form,
      submitter,
      submission: {
        method,
        encType,
        formData,
      },
      hasAttribute(name) {
        return submitter?.hasAttribute(name) === true || form.hasAttribute(name)
      },
      getAttribute(name, submitterName) {
        return getSubmissionAttribute(form, submitter, name, submitterName)
      },
      getSubmission,
    }
  }
}

function getSourceForm(
  sourceElement: Element,
  pendingSubmissions: WeakMap<HTMLFormElement | SubmitterElement, PendingFormSubmission>,
): HTMLFormElement | undefined {
  // A form navigation's source element is the submitted form or its submit button.
  // https://html.spec.whatwg.org/multipage/nav-history-apis.html#dom-navigateevent-sourceelement
  if (sourceElement instanceof HTMLFormElement) return sourceElement
  if (sourceElement instanceof HTMLButtonElement || sourceElement instanceof HTMLInputElement) {
    // `sourceElement.form` is null when the button was detached before the `navigate` event fired
    // (e.g. a temporary button appended, clicked, and immediately removed). Fall back to the form
    // reference captured at `submit` time when the button was still attached.
    return sourceElement.form ?? pendingSubmissions.get(sourceElement)?.form
  }
}

function getSubmissionAttribute(
  form: HTMLFormElement,
  submitter: SubmitterElement | null,
  name: string,
  submitterName?: string,
): string | null {
  submitterName ??= name
  if (submitter?.hasAttribute(submitterName)) {
    return submitter.getAttribute(submitterName)
  }
  return Element.prototype.getAttribute.call(form, name)
}

function getFormMethod(form: HTMLFormElement, submitter: SubmitterElement | null): string {
  if (submitter?.hasAttribute('formmethod')) {
    return submitter.formMethod
  }
  return form.method
}

function getFormEncType(form: HTMLFormElement, submitter: SubmitterElement | null): string {
  if (submitter?.hasAttribute('formenctype')) {
    return submitter.formEnctype
  }
  return form.enctype
}

// Encodes form entries the way browsers do for `application/x-www-form-urlencoded` submissions:
// line breaks become CRLF and files are replaced by their names.
export function encodeFormDataAsSearchParams(formData: FormData): URLSearchParams {
  let params = new URLSearchParams()
  for (let [name, value] of formData) {
    params.append(
      normalizeFormLineBreaks(name),
      normalizeFormLineBreaks(typeof value === 'string' ? value : value.name),
    )
  }
  return params
}

export function normalizeFormLineBreaks(value: string): string {
  return value.replace(/\r\n|\r|\n/g, '\r\n')
}

/** Context for a custom frame commit callback. */
export interface FrameCommitContext {
  /** Resolved frame destination after redirects, or the requested source when not redirected. */
  to: string
  /** Original frame response, still unconsumed when the callback starts. */
  response: Response
  /** Aborts when this frame update is cancelled, superseded, or disposed. */
  signal: AbortSignal
}

/**
 * Wraps the rendering of a resolved frame response.
 *
 * Calling `commitFrame()` starts rendering once. Its promise waits for rendering and any enclosing
 * navigation, including followed redirects, scroll, and focus handling. Navigation does not wait
 * for the callback's post-commit work.
 *
 * Cancellation resolves without a stale render; rendering failures reject. Returning or throwing
 * without calling `commitFrame()` falls back to the default commit. Callback errors are reported
 * on the runtime.
 *
 * @param commitFrame Starts the default frame commit and waits for the completed update.
 * @param context Resolved destination, response, and cancellation context for this update.
 * @returns Optional asynchronous work surrounding the commit, such as an animation.
 */
export type FrameCommit = (
  commitFrame: () => Promise<void>,
  context: FrameCommitContext,
) => void | Promise<void>

export interface FrameCommitNavigation {
  signal: AbortSignal
  finished: Promise<void>
  pendingCommits: number
}

const frameCommits = new WeakMap<Response, FrameCommit>()
const frameNavigations = new WeakMap<AbortSignal, FrameCommitNavigation>()

export function setFrameCommit(response: Response, commit: FrameCommit): void {
  frameCommits.set(response, commit)
}

export function takeFrameCommit(response: unknown): FrameCommit | undefined {
  if (!(response instanceof Response)) return
  let commit = frameCommits.get(response)
  frameCommits.delete(response)
  return commit
}

export function setFrameCommitNavigation(
  signal: AbortSignal,
  navigation: FrameCommitNavigation,
): void {
  frameNavigations.set(signal, navigation)
}

export function getFrameCommitNavigation(signal?: AbortSignal): FrameCommitNavigation | undefined {
  return signal ? frameNavigations.get(signal) : undefined
}

export async function commitFrameResponse(
  response: Response,
  commit: FrameCommit,
  render: () => Promise<void>,
  options: {
    to: string
    signal: AbortSignal
    commitSignal: AbortSignal
    onError(error: unknown): void
  },
): Promise<void> {
  let navigation = getFrameCommitNavigation(options.signal)
  let signal = AbortSignal.any([
    options.signal,
    options.commitSignal,
    ...(navigation ? [navigation.signal] : []),
  ])
  if (signal.aborted) return

  if (navigation) {
    navigation.pendingCommits++
  }
  let listeners = new AbortController()
  let aborted = new Promise<void>((resolve) => {
    signal.addEventListener('abort', () => resolve(), { once: true, signal: listeners.signal })
  })
  let started = Promise.withResolvers<void>()
  let rendered: Promise<void> | undefined
  let completed: Promise<void> | undefined
  let renderFailure: { error: unknown } | undefined

  function commitFrame(): Promise<void> {
    if (!rendered) {
      rendered = Promise.resolve()
        .then(() => {
          if (!signal.aborted) return render()
        })
        .catch((error) => {
          renderFailure = { error }
          throw error
        })
      completed = Promise.race([rendered.then(() => navigation?.finished), aborted])
      // A callback can start the commit without awaiting its result.
      void completed.catch(() => {})
      started.resolve()
    }
    return completed ?? Promise.resolve()
  }

  let callback = Promise.resolve()
    .then(() => {
      if (!signal.aborted) return commit(commitFrame, { to: options.to, response, signal })
    })
    .catch((error) => {
      if (!signal.aborted && (!renderFailure || renderFailure.error !== error)) {
        options.onError(error)
      }
    })

  // The wrapper can wait for navigation or animation completion after the renderer is released.
  await Promise.race([started.promise, callback, aborted])
  void commitFrame()
  void Promise.allSettled([Promise.race([callback, aborted]), completed]).then(() => {
    listeners.abort()
    if (navigation) navigation.pendingCommits--
  })
  await Promise.race([rendered, aborted])
}

type ImportMap = {
  imports?: ImportMapImports
  scopes?: Record<string, ImportMapImports>
  integrity?: Record<string, string>
}

type ImportMapAddress = string | null
type ImportMapImports = Record<string, ImportMapAddress>
type InstalledImportMapEntry = { href: ImportMapAddress; normalizedHref: ImportMapAddress }

// A scope uses its absolute URL. The top-level imports and integrity entries use false and true.
type InstalledImportMap = Map<string | boolean, Map<string, InstalledImportMapEntry>>

interface ImportMapManager {
  consumeImportMaps(source: ParentNode): 'ready' | 'conflict' | 'blocked'
  disconnect(): void
  shouldPreserveHeadNode(node: Node): boolean
}

const MANAGED_IMPORT_MAP_SELECTOR = 'script[data-rmx-import-map][type="importmap"]'
const IMPORT_MAP_SELECTOR = 'script[type="importmap"]'
const importMapManagers = new WeakMap<Document, ImportMapManager>()

class ImportMapConflictError extends Error {}

export function getDocumentImportMapManager(doc: Document): ImportMapManager {
  let manager = importMapManagers.get(doc)
  if (!manager) {
    manager = createImportMapManager(doc)
    importMapManagers.set(doc, manager)
  }
  return manager
}

export function resetDocumentImportMapManager(doc: Document): void {
  importMapManagers.get(doc)?.disconnect()
  importMapManagers.delete(doc)
}

function createImportMapManager(doc: Document): ImportMapManager {
  let nonce = getNonceManager().moduleNonce
  let installed: InstalledImportMap = new Map()
  let processedScripts = new WeakSet<HTMLScriptElement>()
  let conflicted = false

  function processImportMap(script: HTMLScriptElement): void {
    if (processedScripts.has(script)) return
    processedScripts.add(script)

    let importMap = parseImportMap(script.textContent ?? '')
    if (importMap) installImportMap(installed, importMap, script.baseURI)
  }

  function processImportMaps(): void {
    for (let script of doc.querySelectorAll<HTMLScriptElement>(IMPORT_MAP_SELECTOR)) {
      processImportMap(script)
    }
  }

  function processMutations(mutations: MutationRecord[]): void {
    for (let mutation of mutations) {
      if (mutation.type !== 'childList') continue
      for (let node of mutation.addedNodes) {
        if (node instanceof HTMLScriptElement && node.matches(IMPORT_MAP_SELECTOR)) {
          processImportMap(node)
        }
      }
    }
  }

  let observer = new MutationObserver(processMutations)
  observer.observe(doc, { childList: true })
  observer.observe(doc.head, { childList: true })
  processImportMaps()

  return {
    consumeImportMaps(source) {
      if (conflicted) return 'blocked'
      processMutations(observer.takeRecords())
      processImportMaps()
      let scripts = source.querySelectorAll<HTMLScriptElement>(MANAGED_IMPORT_MAP_SELECTOR)
      if (scripts.length === 0) return 'ready'

      // Check the whole response for conflicts before installing the first script.
      let pending: InstalledImportMap = new Map()
      let deltas: ImportMap[] = []
      let baseUrl = doc.baseURI
      try {
        for (let script of scripts) {
          let importMap = parseImportMap(script.textContent ?? '')
          if (!importMap) continue
          let delta = installImportMap(installed, importMap, baseUrl, pending)
          if (delta) deltas.push(delta)
        }
      } catch (error) {
        if (!(error instanceof ImportMapConflictError)) throw error
        console.warn(error.message)
        conflicted = true
        return 'conflict'
      }

      for (let delta of deltas) {
        let installedScript = appendImportMapScript(doc, delta, nonce)
        processedScripts.add(installedScript)
        installImportMap(installed, delta, baseUrl)
      }
      for (let script of scripts) script.remove()
      return 'ready'
    },
    disconnect() {
      observer.disconnect()
    },
    shouldPreserveHeadNode(node) {
      return (
        node.isConnected &&
        node instanceof HTMLScriptElement &&
        node.matches(MANAGED_IMPORT_MAP_SELECTOR)
      )
    },
  }
}

// Keep each spelling of a new entry in the script we append. Later scripts compare
// against the first entry recorded for its normalized key.
function installImportMap(
  installed: InstalledImportMap,
  importMap: ImportMap,
  baseUrl: string,
  pending?: InstalledImportMap,
): ImportMap | undefined {
  let additions = pending ? new Set<InstalledImportMapEntry>() : undefined
  function installEntries<address extends ImportMapAddress>(
    entries: Record<string, address> | undefined,
    integrity: boolean,
    scope?: string,
  ): Record<string, address> | undefined {
    if (!entries) return
    let namespace = scope === undefined ? integrity : normalizeImportMapUrl(scope, baseUrl)
    if (namespace === null) return
    let groups = pending ?? installed
    let target = groups.get(namespace)
    let previous = pending && installed.get(namespace)
    let delta: Record<string, address> | undefined
    for (let [key, href] of Object.entries(entries)) {
      let normalizedKey = integrity
        ? normalizeImportMapUrl(key, baseUrl)
        : normalizeImportMapSpecifier(key, baseUrl)
      if (normalizedKey === null) continue
      let normalizedHref = integrity || href === null ? href : normalizeImportMapUrl(href, baseUrl)
      let existing = target?.get(normalizedKey) ?? previous?.get(normalizedKey)
      if (existing && !additions?.has(existing)) {
        if (pending && existing.normalizedHref !== normalizedHref) {
          let scopeDescription = scope ? ` in scope "${scope}"` : ''
          let kind = integrity ? 'integrity ' : ''
          throw new ImportMapConflictError(
            `[remix] Reloading page after import map ${kind}conflict for "${key}"${scopeDescription}: ` +
              `${formatImportMapAddress(existing.href)} is already installed, but the new map points to ${formatImportMapAddress(href)}`,
          )
        }
      } else {
        if (pending) (delta ??= Object.create(null))[key] = href
        if (!existing) {
          let entry = { href, normalizedHref }
          if (!target) {
            target = new Map()
            groups.set(namespace, target)
          }
          target.set(normalizedKey, entry)
          additions?.add(entry)
        }
      }
    }
    return delta
  }

  let delta: ImportMap = {}
  let imports = installEntries(importMap.imports, false)
  if (imports) delta.imports = imports
  for (let [scope, scopeImports] of Object.entries(importMap.scopes ?? {})) {
    let entries = installEntries(scopeImports, false, scope)
    if (entries) (delta.scopes ??= Object.create(null))[scope] = entries
  }
  let integrity = installEntries(importMap.integrity, true)
  if (integrity) delta.integrity = integrity
  return Object.keys(delta).length ? delta : undefined
}

function appendImportMapScript(
  doc: Document,
  importMap: ImportMap,
  nonce: string | undefined,
): HTMLScriptElement {
  let script = doc.createElement('script')
  script.setAttribute('data-rmx-import-map', '')
  script.type = 'importmap'
  if (nonce) script.nonce = nonce
  script.textContent = JSON.stringify(importMap)
  doc.head.appendChild(script)
  return script
}

function parseImportMap(json: string): ImportMap | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return null
  }

  if (!parsed || typeof parsed !== 'object') return null
  if ('imports' in parsed && !isImportMapImports(parsed.imports)) return null
  if ('scopes' in parsed && !isImportMapRecord(parsed.scopes, isImportMapImports)) return null
  if ('integrity' in parsed && !isImportMapRecord(parsed.integrity, isString)) return null
  return parsed
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isImportMapImports(value: unknown): value is ImportMapImports {
  return isImportMapRecord(value, (entry) => entry === null || isString(entry))
}

function isImportMapRecord<entry>(
  value: unknown,
  validate: (value: unknown) => value is entry,
): value is Record<string, entry> {
  return typeof value === 'object' && value !== null && Object.values(value).every(validate)
}

function normalizeImportMapSpecifier(specifier: string, baseUrl: string): string | null {
  if (
    specifier.startsWith('/') ||
    specifier.startsWith('./') ||
    specifier.startsWith('../') ||
    URL.canParse(specifier)
  ) {
    return normalizeImportMapUrl(specifier, baseUrl)
  }
  return specifier
}

function normalizeImportMapUrl(value: string, baseUrl: string): string | null {
  try {
    return new URL(value, baseUrl).href
  } catch {
    return null
  }
}

function formatImportMapAddress(address: ImportMapAddress | undefined): string {
  return address === null ? 'null' : `"${address}"`
}

const SERVER_MODULE_PRELOAD_SELECTOR = 'link[data-rmx-module-preload][rel~="modulepreload" i][href]'

interface ModulePreloader {
  adoptInitialPreloadLinks(source: ParentNode): void
  consumePreloadLinks(source: ParentNode, process?: ProcessClientEntryPreloads): Promise<void>
  isActivePreload(node: Node): boolean
}

export type ProcessClientEntryPreloads = (preloads: string[]) => string[] | Promise<string[]>

const modulePreloaders = new WeakMap<Document, ModulePreloader>()

export function getDocumentModulePreloader(doc: Document): ModulePreloader {
  let preloader = modulePreloaders.get(doc)
  if (!preloader) {
    preloader = createModulePreloader(doc)
    modulePreloaders.set(doc, preloader)
  }
  return preloader
}

function createModulePreloader(doc: Document): ModulePreloader {
  let nonce = getNonceManager().moduleNonce
  let requestedUrls = new Set<string>()
  let activeLinks = new WeakSet<Node>()

  function preload(href: string, initialLink?: HTMLLinkElement): void {
    let link = doc.createElement('link')
    link.rel = 'modulepreload'
    link.href = href
    let url = link.href
    if (!initialLink && requestedUrls.has(url)) return
    requestedUrls.add(url)
    link.setAttribute('data-rmx-module-preload', '')
    let linkNonce = initialLink ? initialLink.nonce : nonce
    if (linkNonce) link.nonce = linkNonce

    activeLinks.add(link)
    if (initialLink) activeLinks.add(initialLink)

    function settle(event: Event): void {
      if (!activeLinks.delete(link)) return
      link.remove()
      if (initialLink) {
        activeLinks.delete(initialLink)
        initialLink.remove()
      }
      if (event.type === 'error') requestedUrls.delete(url)
    }
    link.addEventListener('load', settle, { once: true })
    link.addEventListener('error', settle, { once: true })
    doc.head.append(link)
  }

  return {
    adoptInitialPreloadLinks(source) {
      // The duplicate joins the parser-created request and gets a terminal event even
      // when the original link settled before runtime startup.
      for (let link of source.querySelectorAll<HTMLLinkElement>(SERVER_MODULE_PRELOAD_SELECTOR)) {
        if (!activeLinks.has(link)) preload(link.href, link)
      }
    },
    async consumePreloadLinks(source, process) {
      let hrefs: string[] = []
      for (let link of source.querySelectorAll<HTMLLinkElement>(SERVER_MODULE_PRELOAD_SELECTOR)) {
        let href = link.getAttribute('href')
        link.remove()
        if (href) hrefs.push(href)
      }
      let processedHrefs = process ? await process(hrefs) : hrefs
      for (let href of processedHrefs) preload(href)
    },
    isActivePreload(node) {
      return activeLinks.has(node)
    },
  }
}

export async function unwrapFrameResolution(
  resolution: FrameResolution,
): Promise<{ content: FrameContent; redirectedTo?: string; nonce?: string }> {
  if (!(resolution instanceof Response)) return { content: resolution }

  let data = spaResponses.get(resolution)
  if (data) {
    return {
      content: data.node,
      redirectedTo: data.redirectedTo,
    }
  }

  let content = resolution.body ?? (await resolution.text())
  return {
    content,
    nonce: getResponseNonce(resolution),
    redirectedTo: resolution.redirected && resolution.url ? resolution.url : undefined,
  }
}

function getResponseNonce(response: Response): string | undefined {
  let header =
    response.headers.get('Content-Security-Policy') ??
    response.headers.get('Content-Security-Policy-Report-Only')
  let nonce: string | undefined
  for (let policy of header?.split(',') ?? []) {
    let directives = new Map<string, string[]>()
    for (let directive of policy.split(';')) {
      let tokens = directive.split(/[\t\n\f\r ]+/).filter(Boolean)
      let name = tokens.shift()?.toLowerCase()
      // CSP uses the first occurrence, even when its source list is empty.
      if (name && !directives.has(name)) directives.set(name, tokens)
    }
    let scriptSources =
      directives.get('script-src-elem') ??
      directives.get('script-src') ??
      directives.get('default-src')
    let styleSources =
      directives.get('style-src-elem') ??
      directives.get('style-src') ??
      directives.get('default-src')
    for (let sources of [scriptSources, styleSources]) {
      for (let source of sources ?? []) {
        let value = /^'nonce-([a-z0-9+/_-]+={0,2})'$/i.exec(source)?.[1]
        if (value === undefined) continue
        // Only translate a single shared render nonce; differing values are ambiguous.
        if (nonce !== undefined && nonce !== value) return undefined
        nonce = value
      }
    }
  }
  return nonce
}
