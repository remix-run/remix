import { jsx } from './jsx.ts'
import { Frame, createFrameHandle, type FrameContent, type FrameResolution } from './component.ts'
import { createComponentErrorEvent, getComponentError } from './error-event.ts'
import { invariant } from './invariant.ts'
import type { RemixElement, RemixNode } from './jsx.ts'
import type { ElementFunction } from './element-function.ts'
import type { FrameHandle } from './component.ts'
import type { Scheduler, VirtualRoot } from './vdom.ts'
import { createRangeRoot, createRoot } from './vdom.ts'
import { diffNodes } from './diff-dom.ts'
import { createStyleManager, type StyleManager } from '../style/index.ts'
import { findFlushMarker, type FlushKind } from './stream-protocol.ts'
import { getDocumentModulePreloader } from './module-preloader.ts'
import { unwrapFrameResolution } from './frame-resolution.ts'
import {
  disposeClientEntryBoundary,
  getClientEntryBoundaryOwner,
  setClientEntryBoundaryOwner,
  type ClientEntryIdentity,
} from './client-entry-boundary.ts'

type FrameRoot = [Comment, Comment] | Element | Document | DocumentFragment

type FrameData = {
  status: 'pending' | 'resolved'
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

type PendingClientEntries = Map<Comment, [Comment, RemixElement]>

/**
 * Loads a named client-entry export for hydration.
 *
 * @param moduleUrl Browser-resolvable URL for the module that contains the client entry.
 * @param exportName Named export to read from the loaded module.
 * @returns The exported component function, or a promise for it.
 *
 * @example
 * ```ts
 * run({
 *   async loadModule(moduleUrl, exportName) {
 *     let mod = await import(moduleUrl)
 *     return mod[exportName]
 *   },
 * })
 * ```
 */
export type LoadModule = (moduleUrl: string, exportName: string) => Promise<Function> | Function

/**
 * Resolves content for a browser-loaded frame.
 *
 * @param src Source string from the `<Frame src>` prop.
 * @param options Information about the active frame load or form submission.
 * @returns Frame content or a response whose body should be rendered into the frame.
 */
export type ResolveFrame = (
  src: string,
  options?: ResolveFrameOptions,
) => Promise<FrameResolution> | FrameResolution

/**
 * Information available while resolving browser-loaded frame content.
 */
export interface ResolveFrameOptions {
  /** Optional name of the frame being loaded or reloaded. */
  target?: string
  /** Form values submitted to the frame source for a non-GET submission. */
  formData?: FormData
  /** HTTP method selected by the form and its submitter. */
  method?: string
  /** Form encoding selected by the form and its submitter. */
  encType?: string
  /** Aborts the reload when the navigation that started it is cancelled. */
  signal?: AbortSignal
}

type InternalFrameContent = FrameContent | DocumentFragment

type FrameReloadOptions = Omit<ResolveFrameOptions, 'target'>

type FrameReloadResult = {
  signal: AbortSignal
  redirectedTo?: string
}

type FrameTemplateListener = (fragment: DocumentFragment) => void

const bufferedFrameTemplates = new Map<string, DocumentFragment[]>()
const frameTemplateListeners = new Map<string, Set<FrameTemplateListener>>()
const DOCTYPE_PATTERN = /<!doctype(?:\s[^>]*)?>/gi

function createLinkedAbortController(
  first: AbortSignal,
  second?: AbortSignal,
): { controller: AbortController; disconnect: () => void } {
  let controller = new AbortController()
  let signals = second ? [first, second] : [first]
  let abort = () => controller.abort()

  for (let signal of signals) {
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
        signal.removeEventListener('abort', abort)
      }
    },
  }
}

function stripDoctypeMarkup(html: string): string {
  return html.replace(DOCTYPE_PATTERN, '')
}

function syncElementAttributes(target: Element, source: Element) {
  for (let attribute of Array.from(target.attributes)) {
    if (!source.hasAttribute(attribute.name)) {
      target.removeAttribute(attribute.name)
    }
  }

  for (let attribute of Array.from(source.attributes)) {
    if (target.getAttribute(attribute.name) !== attribute.value) {
      target.setAttribute(attribute.name, attribute.value)
    }
  }
}

const FRAME_RUNTIME = Symbol('FrameRuntime')

export type FrameRuntime = {
  [FRAME_RUNTIME]: true
  canResolveFrames?: boolean
  topFrame?: FrameHandle
  errorTarget: EventTarget
  loadModule: LoadModule
  resolveFrame: ResolveFrame
  pendingClientEntries: PendingClientEntries
  scheduler: Scheduler
  styleManager: StyleManager
  moduleCache: Map<string, ElementFunction>
  moduleLoads: Map<string, Promise<ElementFunction | undefined>>
  frameInstances: WeakMap<Comment, Frame>
  namedFrames: Map<string, FrameHandle>
  serverFrameReload:
    | { signal: AbortSignal; reconciliationTracker?: ReconciliationTracker }
    | undefined
  reloadForNavigation?: (options?: FrameReloadOptions) => Promise<FrameReloadResult>
}

export function isFrameRuntime(value: unknown): value is FrameRuntime {
  return isRecord(value) && Reflect.get(value, FRAME_RUNTIME) === true
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
  options?: FrameReloadOptions,
): Promise<FrameReloadResult> {
  let runtime = frame.$runtime
  invariant(isFrameRuntime(runtime), 'Expected a frame runtime')
  let reload = runtime.reloadForNavigation
  invariant(reload, 'Expected frame runtime to support navigation reloads')
  return reload(options)
}

export type FrameContext = {
  topFrame?: FrameHandle
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
  frameInstances: WeakMap<Comment, Frame>
  namedFrames: Map<string, FrameHandle>
  lifecycleSignal: AbortSignal
  regionTailRef?: ChildNode | null
  regionParent?: ParentNode | null
  signal?: AbortSignal
  isActiveModulePreload?: (node: Node) => boolean
  reconciliationTracker?: ReconciliationTracker
}

type FrameInit = {
  name?: string
  topFrame?: FrameHandle
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
  frameInstances: WeakMap<Comment, Frame>
  namedFrames: Map<string, FrameHandle>
}

export type Frame = {
  render: (content: InternalFrameContent, options?: RenderOptions) => Promise<void>
  ready: () => Promise<void>
  flush: () => void
  clearPendingTemplateWatch: () => void
  isDisplayingResolvedContent: () => boolean
  beginClientFrameReloadForAncestorReload: (signal: AbortSignal) => {
    controller: AbortController
    complete: () => void
  }
  cancelReload: () => void
  startInheritedReload: (signal?: AbortSignal) => void
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
  flushKind?: FlushKind
  reconciliationTracker?: ReconciliationTracker
  signal?: AbortSignal
  contentStatus?: 'pending' | 'resolved'
  data?: RmxData
}

type ActiveRenderOptions = RenderOptions & {
  data: RmxData
}

export function createFrame(root: FrameRoot, init: FrameInit): Frame {
  let container = createContainer(root)
  let contentRoot: VirtualRoot | undefined
  let reloadController: AbortController | undefined
  // The style registry is document-level and shared by every frame; only the
  // frame that created it (the runtime root) disposes it.
  let ownsStyleManager = !init.styleManager
  let reloadAbortUnsubscribe: (() => void) | undefined
  let reloadKind: 'direct' | 'ancestor' | undefined
  let styleManager = init.styleManager ?? createStyleManager()
  let modulePreloader = getDocumentModulePreloader(container.doc)
  let currentMarker = init.marker
  let displayedContentStatus: 'pending' | 'resolved' = init.marker?.status ?? 'resolved'
  let pendingTemplateMarkerId: string | undefined
  let pendingTemplateObserver: MutationObserver | undefined
  let pendingTemplateUnsubscribe: (() => void) | undefined
  let inheritedReloadPending = false
  let inheritedReloadAbortUnsubscribe: (() => void) | undefined
  let disposed = false
  let lifecycleController = new AbortController()

  if (isDocumentNode(container.root)) {
    modulePreloader.adoptInitialPreloadLinks(container.root)
  } else {
    modulePreloader.consumePreloadLinks(container.root)
  }

  // Merge any rmx-data found in the current document once at startup.
  mergeRmxDataFromDocument(init.data, container.doc)

  let runtime = createFrameRuntime({ ...init, styleManager, reloadForNavigation: reload })

  let frame = createFrameHandle({
    src: init.src,
    $runtime: runtime,
    reload: async () => (await reload()).signal,
    replace: async (content: FrameContent) => {
      await render(content)
    },
  })
  runtime.topFrame = runtime.topFrame ?? init.topFrame ?? frame

  let frameName = init.marker?.name ?? init.name
  if (frameName) {
    init.namedFrames.set(frameName, frame)
  }

  let context: FrameContext = {
    topFrame: runtime.topFrame,
    errorTarget: init.errorTarget,
    loadModule: init.loadModule,
    resolveFrame: init.resolveFrame,
    pendingClientEntries: init.pendingClientEntries,
    scheduler: init.scheduler,
    frame,
    styleManager,
    data: init.data,
    moduleCache: init.moduleCache,
    moduleLoads: init.moduleLoads,
    frameInstances: init.frameInstances,
    namedFrames: init.namedFrames,
    lifecycleSignal: lifecycleController.signal,
    regionTailRef: container.regionTailRef,
    regionParent: container.regionParent,
  }

  async function render(content: InternalFrameContent, options?: RenderOptions): Promise<void> {
    if (disposed || lifecycleController.signal.aborted || options?.signal?.aborted) return
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
          linkedAbort.controller.signal,
        )
      } finally {
        linkedAbort.disconnect()
      }
      return
    }

    if (isRemixNodeFrameContent(content)) {
      if (!contentRoot) {
        let currentNodes = getContentNodes()
        removeVirtualRoots(currentNodes)
        disposeSubFrames(currentNodes, context)
        clearFrameContent()
        contentRoot = createFrameContentRoot()
      }

      if (isRenderAborted(options.signal)) return
      let previousServerFrameReload = runtime.serverFrameReload
      if (options.signal) {
        runtime.serverFrameReload = {
          signal: options.signal,
          reconciliationTracker: options.reconciliationTracker,
        }
      }

      try {
        contentRoot.render(content)
        await new Promise<void>((resolve) => context.scheduler.enqueueCommitPhase([resolve]))
      } finally {
        runtime.serverFrameReload = previousServerFrameReload
      }

      if (isRenderAborted(options.signal)) return
      displayedContentStatus = options.contentStatus ?? 'resolved'
      return
    }

    if (contentRoot) {
      contentRoot.dispose()
      contentRoot = undefined
    }

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
    }

    let htmlContent = typeof content === 'string' ? stripDoctypeMarkup(content) : undefined

    let isFullDocumentReload =
      container.root instanceof Document &&
      htmlContent !== undefined &&
      options.flushKind === 'document'

    if (isFullDocumentReload && htmlContent !== undefined) {
      let parsed = new DOMParser().parseFromString(htmlContent, 'text/html')
      modulePreloader.consumePreloadLinks(parsed)
      let responseData = options.data
      mergeRmxDataFromDocument(responseData, parsed)
      let responseContext = {
        ...context,
        data: responseData,
        reconciliationTracker: options.reconciliationTracker,
      }
      context.styleManager.adoptServerStyles(
        collectFrameServerStyleTags(createElementContainer(parsed)),
      )

      syncElementAttributes(container.doc.documentElement, parsed.documentElement)

      diffNodes([container.doc.head], [parsed.head], {
        ...responseContext,
        regionParent: container.doc.documentElement,
        regionTailRef: null,
        signal: options.signal,
        isActiveModulePreload: modulePreloader.hasActivePreloads()
          ? modulePreloader.isActivePreload
          : undefined,
      })
      diffNodes([container.doc.body], [parsed.body], {
        ...responseContext,
        regionParent: container.doc.documentElement,
        regionTailRef: null,
        signal: options.signal,
      })

      let bodyContainer = createElementContainer(container.doc.body)
      if (isRenderAborted(options.signal)) return
      scheduleHydrationInContainer(
        bodyContainer,
        responseContext,
        options.reconciliationTracker,
        options.signal,
      )
      await createSubFrames(bodyContainer.childNodes, responseContext, options)
      if (isRenderAborted(options.signal)) return
      displayedContentStatus = options.contentStatus ?? 'resolved'
      return
    }

    let fragment =
      htmlContent !== undefined ? createFragmentFromString(container.doc, htmlContent) : content
    modulePreloader.consumePreloadLinks(fragment)
    context.styleManager.adoptServerStyles(
      collectFrameServerStyleTags(createElementContainer(fragment)),
    )
    removeEmptyHeads(fragment)
    let responseData = options.data
    mergeRmxDataFromFragment(responseData, fragment)
    let responseContext = {
      ...context,
      data: responseData,
      reconciliationTracker: options.reconciliationTracker,
    }

    let nextContainer = createContainer(fragment)

    if (isRenderAborted(options.signal)) return

    diffNodes(container.childNodes, Array.from(nextContainer.childNodes), {
      ...responseContext,
      regionTailRef: container.regionTailRef,
      regionParent: container.regionParent,
      signal: options.signal,
    })

    scheduleHydrationInContainer(
      container,
      responseContext,
      options.reconciliationTracker,
      options.signal,
    )
    await createSubFrames(container.childNodes, responseContext, options)
    if (isRenderAborted(options.signal)) return
    displayedContentStatus = options.contentStatus ?? 'resolved'
  }

  function isRenderAborted(signal?: AbortSignal): boolean {
    return disposed || lifecycleController.signal.aborted || signal?.aborted === true
  }

  function createFrameContentRoot(): VirtualRoot {
    let virtualRoot: VirtualRoot
    if (container.root instanceof Document) {
      virtualRoot = createRoot(container.doc.body, {
        scheduler: context.scheduler,
        frame,
        styleManager: context.styleManager,
      })
    } else {
      invariant(Array.isArray(root), 'Expected comment-bounded frame root')
      virtualRoot = createRangeRoot(root, {
        scheduler: context.scheduler,
        frame,
        styleManager: context.styleManager,
      })
    }

    virtualRoot.addEventListener('error', (event: Event) => {
      if (context.errorTarget === virtualRoot) return
      context.errorTarget.dispatchEvent(createComponentErrorEvent(getComponentError(event)))
    })

    return virtualRoot
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

    context.styleManager.adoptServerStyles(collectFrameServerStyleTags(container))
    let subFramesReady = createSubFrames(container.childNodes, context)
    scheduleHydrationInContainer(container, context, reconciliationTracker)

    try {
      await subFramesReady

      if (disposed || context.lifecycleSignal.aborted) return

      if (currentMarker?.status === 'pending') {
        await watchPendingFrameTemplate(currentMarker, reconciliationTracker)
      }

      reconciliationTracker.finalize()
      await reconciliationTracker.ready()
    } finally {
      clearRmxData(context.data)
    }
  }

  function dispose(): void {
    if (disposed) return
    disposed = true
    lifecycleController.abort()
    clearRmxData(context.data)
    reloadController?.abort()
    reloadController = undefined
    reloadAbortUnsubscribe?.()
    reloadAbortUnsubscribe = undefined
    reloadKind = undefined
    contentRoot?.dispose()
    contentRoot = undefined
    clearPendingFrameTemplateWatch()

    // Remove hydrated virtual roots in this frame's region.
    removeVirtualRoots(container.childNodes)

    // Dispose sub-frames recursively.
    disposeSubFrames(container.childNodes, context)
    if (ownsStyleManager) {
      context.styleManager.dispose()
    }

    if (frameName) {
      if (init.namedFrames.get(frameName) === frame) {
        init.namedFrames.delete(frameName)
      }
    }
  }

  let readyPromise = hydrateInitial()

  return {
    render,
    ready: () => readyPromise,
    flush: () => context.scheduler.dequeue(),
    clearPendingTemplateWatch: clearPendingFrameTemplateWatch,
    isDisplayingResolvedContent: () => displayedContentStatus === 'resolved',
    beginClientFrameReloadForAncestorReload,
    cancelReload,
    startInheritedReload,
    updateMarker,
    renderMarkerContent,
    matchesIdentity: (src, name) => !disposed && frame.src === src && frameName === name,
    dispose,
    handle: frame,
  }

  async function updateMarker(marker: FrameMarkerData, options?: RenderOptions): Promise<void> {
    if (disposed || context.lifecycleSignal.aborted || options?.signal?.aborted) return
    let previousMarker = currentMarker
    let isInheritedReload = previousMarker !== undefined && previousMarker.id !== marker.id
    currentMarker = marker

    if (isInheritedReload) {
      startInheritedReload(options?.signal)
    }

    if (marker.status === 'pending') {
      await watchPendingFrameTemplate(
        marker,
        options?.reconciliationTracker,
        options?.signal,
        isInheritedReload
          ? () => {
              completeInheritedReload()
            }
          : undefined,
      )
    } else {
      clearPendingFrameTemplateWatch()
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
    if (disposed || context.lifecycleSignal.aborted || options?.signal?.aborted) return
    let previousMarker = currentMarker
    let isInheritedReload = previousMarker !== undefined && previousMarker.id !== marker.id
    currentMarker = marker

    if (isInheritedReload) {
      startInheritedReload(options?.signal)
    }

    clearPendingFrameTemplateWatch()
    await render(content, { ...options, contentStatus: 'resolved' })

    if (
      isInheritedReload &&
      !disposed &&
      !context.lifecycleSignal.aborted &&
      !options?.signal?.aborted
    ) {
      completeInheritedReload()
    }
  }

  async function reload(options?: FrameReloadOptions): Promise<FrameReloadResult> {
    let controller = startReload(options?.signal)
    return await resolveAndRenderReload(controller, options)
  }

  function startReload(signal?: AbortSignal): AbortController {
    let controller = replaceReloadController(signal)
    reloadKind = 'direct'
    frame.dispatchEvent(new Event('reloadStart'))
    startSubFrameInheritedReloads(getContentNodes(), controller.signal)
    return controller
  }

  function beginClientFrameReloadForAncestorReload(signal: AbortSignal): {
    controller: AbortController
    complete: () => void
  } {
    let inheritedReloadStarted = reuseInheritedReloadStart()
    let continuingAncestorReload = reloadKind === 'ancestor'
    let controller = replaceReloadController(signal)
    reloadKind = 'ancestor'

    if (!inheritedReloadStarted && !continuingAncestorReload) {
      frame.dispatchEvent(new Event('reloadStart'))
      startSubFrameInheritedReloads(getContentNodes(), controller.signal)
    }

    return {
      controller,
      complete: () => completeReload(controller),
    }
  }

  function cancelReload(): void {
    let controller = reloadController
    if (!controller) return
    controller.abort()
    completeReload(controller)
  }

  function replaceReloadController(signal?: AbortSignal): AbortController {
    reloadController?.abort()
    reloadAbortUnsubscribe?.()
    reloadAbortUnsubscribe = undefined

    let controller = new AbortController()
    reloadController = controller

    if (signal) {
      if (signal.aborted) {
        controller.abort()
      } else {
        let abort = () => controller.abort()
        signal.addEventListener('abort', abort, { once: true })
        reloadAbortUnsubscribe = () => signal.removeEventListener('abort', abort)
      }
    }

    return controller
  }

  async function resolveAndRenderReload(
    controller: AbortController,
    options?: FrameReloadOptions,
  ): Promise<FrameReloadResult> {
    try {
      let resolution = await init.resolveFrame(frame.src, {
        ...options,
        signal: controller.signal,
        target: frameName,
      })
      if (reloadController !== controller || controller.signal.aborted) {
        return { signal: controller.signal }
      }
      let { content, redirectedTo } = await unwrapFrameResolution(resolution)
      if (reloadController !== controller || controller.signal.aborted) {
        return { signal: controller.signal }
      }
      let reconciliationTracker = createReconciliationTracker()
      await render(content, {
        signal: controller.signal,
        reconciliationTracker,
      })
      reconciliationTracker.finalize()
      await reconciliationTracker.ready()
      return {
        signal: controller.signal,
        redirectedTo:
          reloadController === controller && !controller.signal.aborted ? redirectedTo : undefined,
      }
    } catch (error) {
      if (reloadController !== controller || controller.signal.aborted) {
        return { signal: controller.signal }
      }
      init.errorTarget.dispatchEvent(createComponentErrorEvent(error))
      throw error
    } finally {
      completeReload(controller)
    }
  }

  function completeReload(controller: AbortController): void {
    if (reloadController !== controller || reloadKind === undefined) return
    reloadAbortUnsubscribe?.()
    reloadAbortUnsubscribe = undefined
    reloadKind = undefined
    frame.dispatchEvent(new Event('reloadComplete'))
  }

  function startInheritedReload(signal?: AbortSignal): void {
    if (signal?.aborted) return
    if (!inheritedReloadPending) {
      inheritedReloadPending = true
      frame.dispatchEvent(new Event('reloadStart'))
      startSubFrameInheritedReloads(getContentNodes(), signal)
    }

    inheritedReloadAbortUnsubscribe?.()
    inheritedReloadAbortUnsubscribe = undefined
    if (signal) {
      let abort = () => completeInheritedReload()
      signal.addEventListener('abort', abort, { once: true })
      inheritedReloadAbortUnsubscribe = () => {
        signal.removeEventListener('abort', abort)
      }
    }
  }

  function reuseInheritedReloadStart(): boolean {
    if (!inheritedReloadPending) return false
    inheritedReloadPending = false
    inheritedReloadAbortUnsubscribe?.()
    inheritedReloadAbortUnsubscribe = undefined
    return true
  }

  function completeInheritedReload(): void {
    if (!inheritedReloadPending) return
    inheritedReloadPending = false
    inheritedReloadAbortUnsubscribe?.()
    inheritedReloadAbortUnsubscribe = undefined
    frame.dispatchEvent(new Event('reloadComplete'))
  }

  function startSubFrameInheritedReloads(nodes: Node[], signal?: AbortSignal): void {
    for (let i = 0; i < nodes.length; i++) {
      if (signal?.aborted) break

      let node = nodes[i]

      if (isFrameStart(node)) {
        let end = findEndMarker(node, isFrameStart, isFrameEnd)
        context.frameInstances.get(node)?.startInheritedReload(signal)
        i = findMarkerRangeEndIndex(nodes, end, i)
        continue
      }

      if (node.childNodes && node.childNodes.length > 0) {
        startSubFrameInheritedReloads(Array.from(node.childNodes), signal)
      }
    }
  }

  function clearPendingFrameTemplateWatch(): void {
    pendingTemplateUnsubscribe?.()
    pendingTemplateUnsubscribe = undefined
    pendingTemplateObserver?.disconnect()
    pendingTemplateObserver = undefined
    pendingTemplateMarkerId = undefined
  }

  async function watchPendingFrameTemplate(
    marker: FrameMarkerData,
    reconciliationTracker?: ReconciliationTracker,
    signal?: AbortSignal,
    onResolved?: () => void,
  ): Promise<void> {
    if (disposed || context.lifecycleSignal.aborted || signal?.aborted) return
    if (pendingTemplateMarkerId === marker.id) return

    clearPendingFrameTemplateWatch()
    pendingTemplateMarkerId = marker.id

    let early = consumeFrameTemplate(marker.id) ?? getEarlyFrameContent(marker.id)
    if (early) {
      clearPendingFrameTemplateWatch()
      await render(early, { reconciliationTracker, signal, contentStatus: 'resolved' })
      if (!disposed && !context.lifecycleSignal.aborted && !signal?.aborted) onResolved?.()
      return
    }

    if (disposed || context.lifecycleSignal.aborted || signal?.aborted) {
      clearPendingFrameTemplateWatch()
      return
    }

    let observer = setupTemplateObserver()
    pendingTemplateObserver = observer
    let unsubscribe = subscribeFrameTemplate(marker.id, async (fragment) => {
      if (disposed || context.lifecycleSignal.aborted || signal?.aborted) return
      if (pendingTemplateMarkerId !== marker.id) return
      clearPendingFrameTemplateWatch()
      await render(fragment, { signal, contentStatus: 'resolved' })
      if (!disposed && !context.lifecycleSignal.aborted && !signal?.aborted) onResolved?.()
    })
    pendingTemplateUnsubscribe = unsubscribe

    signal?.addEventListener(
      'abort',
      () => {
        if (pendingTemplateMarkerId === marker.id) {
          clearPendingFrameTemplateWatch()
        }
      },
      { once: true },
    )

    let buffered = consumeFrameTemplate(marker.id)
    if (buffered) {
      clearPendingFrameTemplateWatch()
      await render(buffered, { reconciliationTracker, signal, contentStatus: 'resolved' })
      if (!disposed && !context.lifecycleSignal.aborted && !signal?.aborted) onResolved?.()
    }
  }
}

export function createFrameRuntime(init: {
  topFrame?: FrameHandle
  errorTarget: EventTarget
  loadModule: LoadModule
  resolveFrame: ResolveFrame
  pendingClientEntries: PendingClientEntries
  scheduler: Scheduler
  styleManager: StyleManager
  moduleCache: Map<string, ElementFunction>
  moduleLoads: Map<string, Promise<ElementFunction | undefined>>
  frameInstances: WeakMap<Comment, Frame>
  namedFrames: Map<string, FrameHandle>
  reloadForNavigation?: (options?: FrameReloadOptions) => Promise<FrameReloadResult>
}): FrameRuntime {
  return {
    [FRAME_RUNTIME]: true,
    topFrame: init.topFrame,
    errorTarget: init.errorTarget,
    loadModule: init.loadModule,
    resolveFrame: init.resolveFrame,
    pendingClientEntries: init.pendingClientEntries,
    scheduler: init.scheduler,
    styleManager: init.styleManager,
    moduleCache: init.moduleCache,
    moduleLoads: init.moduleLoads,
    frameInstances: init.frameInstances,
    namedFrames: init.namedFrames,
    serverFrameReload: undefined,
    reloadForNavigation: init.reloadForNavigation,
  }
}

export type ReconciliationTracker = {
  track: () => () => void
  waitFor: (task: Promise<void>) => void
  finalize: () => void
  ready: () => Promise<void>
}

function createReconciliationTracker(): ReconciliationTracker {
  let pending = 0
  let finalized = false
  let failed = false
  let failure: unknown

  let ready = Promise.withResolvers<void>()

  function maybeSettle() {
    if (!finalized || pending !== 0) return
    if (failed) ready.reject(failure)
    else ready.resolve()
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
      return ready.promise
    },
  }
}

function mergeRmxDataFromDocument(into: RmxData, doc: Document): void {
  let scripts = Array.from(doc.querySelectorAll('script#rmx-data'))
  for (let script of scripts) {
    if (!(script instanceof HTMLScriptElement)) continue
    mergeRmxData(into, parseRmxDataScript(script))
    script.remove()
  }
}

function mergeRmxDataFromFragment(into: RmxData, fragment: DocumentFragment): void {
  let scripts = Array.from(fragment.querySelectorAll('script#rmx-data'))
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

function collectFrameServerStyleTags(container: FrameContainer): HTMLStyleElement[] {
  let styles: HTMLStyleElement[] = []
  let nodes =
    container.root instanceof Document
      ? [...Array.from(container.doc.head.childNodes), ...Array.from(container.doc.body.childNodes)]
      : container.childNodes

  collectOwnedServerStyleTags(nodes, styles)
  return styles
}

function collectOwnedServerStyleTags(nodes: Node[], styles: HTMLStyleElement[]): void {
  for (let i = 0; i < nodes.length; i++) {
    let node = nodes[i]

    if (isFrameStart(node)) {
      let end = findEndMarker(node, isFrameStart, isFrameEnd)
      i = findMarkerRangeEndIndex(nodes, end, i)
      continue
    }

    if (node instanceof HTMLStyleElement && node.matches('style[data-rmx-style]')) {
      styles.push(node)
      continue
    }

    if (node.childNodes.length > 0) {
      collectOwnedServerStyleTags(Array.from(node.childNodes), styles)
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
  if (from.h) {
    if (!into.h) into.h = {}
    copyOwnRmxEntries(into.h, from.h)
  }

  if (from.f) {
    if (!into.f) into.f = {}
    copyOwnRmxEntries(into.f, from.f)
  }
}

function copyOwnRmxEntries<T>(target: Record<string, T>, source: Record<string, T>): void {
  for (let key of Object.keys(source)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue
    if (!Object.hasOwn(source, key)) continue
    target[key] = source[key]!
  }
}

function scheduleHydrationInContainer(
  container: FrameContainer,
  context: FrameContext,
  reconciliationTracker?: ReconciliationTracker,
  signal?: AbortSignal,
): void {
  let hydrationMarkers = findHydrationMarkers(container)
  if (hydrationMarkers.length === 0) return

  let hydrationData = context.data.h
  if (!hydrationData) return

  for (let marker of hydrationMarkers) {
    let entry = hydrationData[marker.id]
    if (!entry) continue
    scheduleHydrationMarker(marker, entry, context, reconciliationTracker, signal)
  }
}

function scheduleHydrationMarker(
  marker: HydrationMarker,
  entry: HydrationData,
  context: FrameContext,
  reconciliationTracker?: ReconciliationTracker,
  signal?: AbortSignal,
): void {
  if (signal?.aborted || context.lifecycleSignal.aborted) return

  let done = reconciliationTracker?.track()
  let key = `${entry.moduleUrl}#${entry.exportName}`
  let identity: ClientEntryIdentity = {
    moduleUrl: entry.moduleUrl,
    exportName: entry.exportName,
  }
  let props: Record<string, unknown> | undefined = entry.props
  let completed = false

  let complete = () => {
    if (completed) return
    completed = true
    props = undefined
    signal?.removeEventListener('abort', complete)
    context.lifecycleSignal.removeEventListener('abort', complete)
    done?.()
  }

  signal?.addEventListener('abort', complete, { once: true })
  context.lifecycleSignal.addEventListener('abort', complete, { once: true })

  let hydrateWithComponent = (component: ElementFunction) => {
    if (signal?.aborted || context.lifecycleSignal.aborted) return
    if (!isHydrationMarkerLive(marker, context)) return
    if (!props) return
    let vElement = createElement(component, props)
    context.pendingClientEntries.set(marker.start, [marker.end, vElement])
    hydrateRegion(vElement, marker.start, marker.end, identity, context, signal)
  }

  let cached = context.moduleCache.get(key)
  if (cached) {
    hydrateWithComponent(cached)
    complete()
    return
  }

  getOrStartModuleLoad(key, identity, marker.id, context)
    .then((component) => {
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

function reviveSerializedValue(value: unknown): unknown {
  if (value === null || value === undefined) return value
  if (typeof value !== 'object') return value

  if (Array.isArray(value)) {
    return value.map((item) => reviveSerializedValue(item))
  }

  if (!isRecord(value)) return value
  let record = value

  if (record.$rmxFrame === true) {
    let props = reviveSerializedObject(record.props)
    let key = reviveSerializedValue(record.key)
    return jsx(Frame, props, key)
  }

  if (record.$rmx === true && typeof record.type === 'string') {
    let props = reviveSerializedObject(record.props)
    let key = reviveSerializedValue(record.key)
    return jsx(record.type, props, key)
  }

  let revived: Record<string, unknown> = {}
  for (let key in record) {
    revived[key] = reviveSerializedValue(record[key])
  }
  return revived
}

function reviveSerializedObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  let revived = reviveSerializedValue(value)
  if (!revived || typeof revived !== 'object' || Array.isArray(revived)) return {}
  return isRecord(revived) ? revived : {}
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hydrateRegion(
  vElement: RemixElement,
  start: Comment,
  end: Comment,
  identity: ClientEntryIdentity,
  context: FrameContext,
  signal?: AbortSignal,
): void {
  if (signal?.aborted) return

  context.pendingClientEntries.delete(start)

  // During a server frame reload, expose the reload signal and reconciliation
  // tracker to client frames created while this entry renders so blocking
  // frames keep the reload pending until their content arrives.
  let renderEntry = (root: Pick<VirtualRoot, 'render'>) => {
    if (!signal) {
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
      signal,
      reconciliationTracker: context.reconciliationTracker,
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

  let root = createRangeRoot([start, end], {
    scheduler: context.scheduler,
    frame: context.frame,
    styleManager: context.styleManager,
  })
  root.addEventListener('error', (event) => {
    if (context.errorTarget === root) return
    context.errorTarget.dispatchEvent(createComponentErrorEvent(getComponentError(event)))
  })

  setClientEntryBoundaryOwner(start, identity, root)
  renderEntry(root)
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
      let end = findEndMarker(node, isFrameStart, isFrameEnd)
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
            src: frameMarker.src,
            marker: frameMarker,
            topFrame: context.topFrame,
            errorTarget: context.errorTarget,
            loadModule: context.loadModule,
            resolveFrame: context.resolveFrame,
            pendingClientEntries: context.pendingClientEntries,
            scheduler: context.scheduler,
            styleManager: context.styleManager,
            data: context.data,
            moduleCache: context.moduleCache,
            moduleLoads: context.moduleLoads,
            frameInstances: context.frameInstances,
            namedFrames: context.namedFrames,
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

  let startText = marker.start.data.trim()
  if (startText !== `rmx:h:${marker.id}`) return false
  if (marker.end.data.trim() !== '/rmx:h') return false

  let parent = marker.start.parentNode
  if (!parent) return false

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
  for (let i = 0; i < nodes.length; i++) {
    let node = nodes[i]

    if (isCommentNode(node) && isHydrationStart(node) && disposeClientEntryBoundary(node)) {
      let end = findEndMarker(node, isHydrationStart, isHydrationEnd)
      i = findMarkerRangeEndIndex(nodes, end, i)
      continue
    }

    if (node.childNodes && node.childNodes.length > 0) {
      removeVirtualRoots(Array.from(node.childNodes))
    }
  }
}

function disposeSubFrames(nodes: Node[], context: FrameContext): void {
  for (let i = 0; i < nodes.length; i++) {
    let node = nodes[i]

    if (isFrameStart(node)) {
      let end = findEndMarker(node, isFrameStart, isFrameEnd)
      let subFrame = context.frameInstances.get(node)
      if (subFrame) {
        subFrame.dispose()
        context.frameInstances.delete(node)
      }
      i = findMarkerRangeEndIndex(nodes, end, i)
      continue
    }

    if (node.childNodes && node.childNodes.length > 0) {
      disposeSubFrames(Array.from(node.childNodes), context)
    }
  }
}

function getEarlyFrameContent(id: string): DocumentFragment | null {
  let template = document.querySelector(`template#${id}`)
  if (template instanceof HTMLTemplateElement) {
    let fragment = template.content
    template.remove()
    return fragment
  }
  return null
}

function setupTemplateObserver(): MutationObserver {
  let root = document.body ?? document.documentElement ?? document
  let observer = new MutationObserver((mutations) => {
    for (let mutation of mutations) {
      for (let node of mutation.addedNodes) {
        collectAndPublishTemplates(node)
      }
    }
  })

  observer.observe(root, { childList: true, subtree: true })
  return observer
}

function collectAndPublishTemplates(node: Node): void {
  if (node instanceof HTMLTemplateElement) {
    publishFrameTemplateElement(node)
    return
  }

  if (!(node instanceof Element)) return
  let templates = Array.from(node.querySelectorAll('template'))
  for (let template of templates) {
    if (!(template instanceof HTMLTemplateElement)) continue
    publishFrameTemplateElement(template)
  }
}

function publishFrameTemplateElement(template: HTMLTemplateElement): void {
  if (!template.id) return
  template.remove()
  publishFrameTemplate(template.id, template.content)
}

export function publishFrameTemplate(id: string, fragment: DocumentFragment): void {
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
    listener(clone)
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
  /<template\b[^>]*\bid=(?:"([^"]+)"|'([^']+)')[^>]*>[\s\S]*?<\/template>/gi

function extractTemplatesFromBuffer(
  doc: Document,
  buffer: string,
  onTemplate: (id: string, fragment: DocumentFragment) => void,
): StreamTemplateParseResult {
  let html = ''
  let cursor = 0
  let hadMatch = false

  COMPLETE_TEMPLATE_WITH_ID_PATTERN.lastIndex = 0
  let match = COMPLETE_TEMPLATE_WITH_ID_PATTERN.exec(buffer)

  while (match) {
    hadMatch = true
    let index = match.index
    let fullMatch = match[0]
    let id = match[1] ?? match[2]
    let matchEnd = index + fullMatch.length

    html += buffer.slice(cursor, index)

    if (id) {
      let parsed = createFragmentFromString(doc, fullMatch)
      let template = parsed.querySelector('template')
      if (template instanceof HTMLTemplateElement && template.id) {
        onTemplate(template.id, template.content)
      }
    }

    cursor = matchEnd
    match = COMPLETE_TEMPLATE_WITH_ID_PATTERN.exec(buffer)
  }

  let tail = buffer.slice(cursor)
  if (tail === '') return { html, remainder: '' }

  let tailStart = tail.toLowerCase().lastIndexOf('<template')
  if (tailStart === -1) {
    return { html: html + tail, remainder: '' }
  }

  if (!hadMatch) {
    return {
      html: buffer.slice(0, tailStart),
      remainder: buffer.slice(tailStart),
    }
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

  try {
    while (true) {
      let { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      let parsed = extractTemplatesFromBuffer(doc, buffer, publishFrameTemplate)
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
    html += parsed.html
    buffer = parsed.remainder
    if (buffer !== '') {
      html += buffer
      buffer = ''
    }

    if (html !== '') {
      await applyHtml(html, 'fragment')
      appliedOnce = true
    }

    // A frame stream can legitimately resolve to empty content. Ensure the
    // existing frame region is cleared instead of treated as a no-op.
    if (html === '' && !appliedOnce) {
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

  let getChildNodesBetween = (): Node[] => {
    let nodes: Node[] = []
    let node = start.nextSibling
    while (node && node !== end) {
      nodes.push(node)
      node = node.nextSibling
    }
    return nodes
  }

  return {
    doc,
    root: parent,
    get childNodes() {
      return getChildNodesBetween()
    },
    regionTailRef: end,
    regionParent: parent,
  }
}

function createFragmentFromString(doc: Document, content: string): DocumentFragment {
  let template = doc.createElement('template')
  template.innerHTML = stripDoctypeMarkup(content).trim()
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
}

function findHydrationMarkers(container: FrameContainer): HydrationMarker[] {
  let results: HydrationMarker[] = []

  forEachComment(container, (comment) => {
    let trimmed = comment.data.trim()
    if (!trimmed.startsWith('rmx:h:')) return

    let id = trimmed.slice('rmx:h:'.length)
    let end = findEndMarker(comment, isHydrationStart, isHydrationEnd)
    results.push({ id, start: comment, end })
  })

  return results
}

function forEachComment(container: FrameContainer, cb: (comment: Comment) => void): void {
  walkCommentsInNodes(container.childNodes, cb)
}

function walkCommentsInNodes(nodes: Node[], cb: (comment: Comment) => void): void {
  for (let i = 0; i < nodes.length; i++) {
    let node = nodes[i]

    // Frame ownership boundary: hydration markers inside nested frame regions
    // are discovered and hydrated by the nested frame instance only.
    if (isFrameStart(node)) {
      let end = findEndMarker(node, isFrameStart, isFrameEnd)
      i = findMarkerRangeEndIndex(nodes, end, i)
      continue
    }

    if (isCommentNode(node)) cb(node)
    if (node.childNodes && node.childNodes.length > 0) {
      walkCommentsInNodes(Array.from(node.childNodes), cb)
    }
  }
}

function isHydrationStart(node: Comment): boolean {
  return node.data.trim().startsWith('rmx:h:')
}

function isHydrationEnd(node: Comment): boolean {
  return node.data.trim() === '/rmx:h'
}

function isFrameStart(node: Node): node is Comment {
  return isCommentNode(node) && node.data.trim().startsWith('rmx:f:')
}

function isFrameEnd(node: Comment): boolean {
  return node.data.trim() === '/rmx:f'
}

function getFrameId(start: Comment): string {
  let trimmed = start.data.trim()
  invariant(trimmed.startsWith('rmx:f:'), 'Invalid frame start marker')
  return trimmed.slice('rmx:f:'.length)
}

function findMarkerRangeEndIndex(nodes: Node[], end: Comment, startIndex: number): number {
  // The snapshot may not contain an end marker moved by a DOM update.
  return Math.max(startIndex, nodes.indexOf(end))
}

function findEndMarker(
  start: Comment,
  isStart: (node: Comment) => boolean,
  isEnd: (node: Comment) => boolean,
): Comment {
  let node: Node | null = start.nextSibling
  let depth = 1

  while (node) {
    if (isCommentNode(node)) {
      let comment = node
      if (isStart(comment)) depth++
      else if (isEnd(comment)) {
        depth--
        if (depth === 0) return comment
      }
    }
    node = node.nextSibling
  }

  throw new Error('End marker not found')
}

function isCommentNode(node: Node | null | undefined): node is Comment {
  return node?.nodeType === Node.COMMENT_NODE
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
