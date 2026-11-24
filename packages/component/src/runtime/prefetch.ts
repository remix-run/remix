import { getNamedFrame, pendingPrefetchLinks } from './frame.ts'
import {
  getInterceptableNavigation,
  getSameOriginUrl,
  hasNoReferrer,
  isObject,
} from './navigation.ts'

/** Options for a URL prefetch trigger. */
export interface PrefetchOptions {
  /** Name of the destination frame, sent as `X-Remix-Target` by the default strategy. */
  target?: string
  /** Cancels only this caller's prefetch; the shared fetch signal may remain active. */
  signal?: AbortSignal
}

/** Frame request options forwarded through prefetch handlers and {@link defaultPrefetch}. */
export interface PrefetchFrameOptions extends PrefetchOptions {
  /** Triggering element for this caller; automatic triggers and anchor calls supply their link. */
  element?: Element
}

/** Cancellation options for prefetching an anchor's navigation destination. */
export interface PrefetchAnchorOptions {
  /** Cancels this caller's prefetch, retaining work shared with other callers. */
  signal?: AbortSignal
}

/** A same-origin nested frame source discovered in prefetched HTML. */
export interface PrefetchFrameReference {
  /** Absolute frame source URL without a hash. */
  readonly src: string
  /** Destination frame name, when provided. */
  readonly target?: string
  /** Initial frame loading mode (`eager` when unspecified). */
  readonly loading: 'eager' | 'lazy'
  /** Whether the frame declares fallback content, even if its resolved HTML has already arrived. */
  readonly fallback: boolean
}

/** References to prefetch, with defaults for omitted fields and `[]` to skip a category. */
export interface PrefetchReferences {
  /** Original asset elements to prefetch; `[]` skips asset hints (defaults to discovered assets). */
  assets?: readonly Element[]
  /**
   * Nested frame requests to fetch using the same overrides. Does not change asset selection
   * (defaults to none).
   */
  frames?: readonly Pick<PrefetchFrameReference, 'src' | 'target'>[]
}

/** The parsed, detached HTML and references available to a custom prefetch hook. */
export interface ProcessFrameContext {
  /** Requested absolute frame source URL. */
  src: string
  /** Destination frame name, when provided. */
  target: string | undefined
  /**
   * First caller's live triggering element. Nested requests inherit it, and later callers joining
   * shared work do not replace it. It may be disconnected or point elsewhere while another caller
   * retains the work.
   */
  readonly element: Element | undefined
  /** Same as this frame's `fetch` `init.signal`; aborts when all callers cancel or runtime is disposed. */
  signal: AbortSignal
  /** Original response, whose body has been consumed into the fragment. */
  response: Response
  /** Inert HTML fragment, including templates; it is never mounted by Remix. */
  fragment: DocumentFragment
  /**
   * Original script and link declarations supported by native prefetch hints, including inside
   * templates. Responsive image and track preloads are omitted; query `fragment` for custom loading.
   */
  assets: readonly Element[]
  /** All discovered same-origin nested frame requests, resolved against the response's base URL. */
  frames: readonly PrefetchFrameReference[]
}

/** Request and discovered-reference handling overrides for {@link defaultPrefetch}. */
export interface DefaultPrefetchOverrides {
  /**
   * Fetches each prepared HTML request (defaults to `globalThis.fetch`). Capture the initiating
   * element from the outer prefetch handler's options. Use `init.signal` for queues and retries:
   * the caller's options signal may abort while another caller still needs the shared request.
   * Nested requests inherit the hook and element, but have their own URL, target header, and signal.
   *
   * @param url Prepared absolute frame source URL.
   * @param init Frame headers, `X-Remix-Prefetch: true`, GET method, low priority, and shared abort
   * signal (always supplied).
   * @returns The unconsumed response for validation and parsing.
   */
  fetch?(url: string, init: RequestInit): Promise<Response>
  /**
   * Handles each parsed response. Call `prefetchReferences()` to prefetch discovered assets without
   * fetching nested sources. Passing an object overrides only the fields supplied: `assets` defaults
   * to discovered assets and `frames` defaults to `[]`. Selecting `frames` alone retains default
   * assets; pass `assets: []` to skip them. Returning without delegating skips Remix's work.
   * Responsive image and track preloads are skipped by native hints; the hook may perform and
   * await its own image loading or other prefetching instead.
   *
   * @param prefetchReferences Starts selected default work while the hook is active.
   * @param context Parsed HTML, source elements, frame references, and cancellation context.
   * @returns Optional asynchronous custom work to finish before the prefetch completes.
   */
  processFrame?(
    prefetchReferences: (references?: PrefetchReferences) => Promise<void>,
    context: ProcessFrameContext,
  ): void | Promise<void>
}

/**
 * Starts loading same-origin frame content so a later navigation can reuse the response.
 *
 * @param src Absolute URL of the page to prefetch, without a hash.
 * @param options Destination frame, cancellation signal, and triggering element.
 */
export type PrefetchFrame = (src: string, options?: PrefetchFrameOptions) => void

type PrefetchRequest = [src: string, options?: PrefetchFrameOptions]

const INTENT_DELAY_MS = 100
const SCROLL_SETTLE_MS = 150
const IDLE_TIMEOUT_MS = 1000
const PRELOAD_DESTINATIONS = ['fetch', 'font', 'image', 'script', 'style']

const initialPrefetch = createFramePrefetch()
let defaultPrefetchFrame = initialPrefetch
let prefetchFrame: (src: string, options?: PrefetchFrameOptions) => void | Promise<void> =
  prefetchPage
const initialAnchorPrefetch = createAnchorPrefetching()
let prefetchAnchor = initialAnchorPrefetch

function prefetchPage(
  src: string,
  options?: PrefetchFrameOptions,
  overrides?: FramePrefetchOverrides,
): Promise<void> {
  let href = getSameOriginHref(src)
  return href ? defaultPrefetchFrame(href, options, overrides) : Promise.resolve()
}

/**
 * Prefetches frame content so a later navigation can reuse the response. By default this
 * fetches HTML and discovers external JavaScript, CSS, and explicit preloads. Assets use
 * `<link rel="prefetch">` hints; responsive image and track preloads require a custom
 * `processFrame` hook.
 * Responses use the browser HTTP cache; even uncacheable HTML can reveal cacheable assets. Pass
 * `prefetch` to `run()` to change this behavior, or delegate to {@link defaultPrefetch} with overrides.
 * Custom `processFrame` hooks can select nested sources to prefetch using the same strategy.
 * Cross-origin URLs, the current untargeted page, and browsers where Remix doesn't handle navigations are skipped.
 *
 * Anchor calls read link source and target metadata, supply the triggering element, and cancel
 * this caller when the anchor disconnects or its navigation destination or eligibility changes.
 * Anchor options only accept a cancellation signal. Anchors must be connected and eligible for
 * frame navigation; no prefetch marker is required.
 *
 * @param href URL resolved against the document base URL, or the connected link to prefetch.
 * @param options Cancellation signal for this caller.
 */
export function prefetch(href: HTMLAnchorElement, options?: PrefetchAnchorOptions): void
/**
 * Prefetches a URL with an optional destination frame and cancellation signal.
 *
 * @param href URL resolved against the document base URL.
 * @param options Destination frame and cancellation signal.
 */
export function prefetch(href: string, options?: PrefetchOptions): void
/**
 * Prefetches a URL or anchor with an optional cancellation signal.
 *
 * @param href URL resolved against the document base URL, or the connected link to prefetch.
 * @param options Cancellation signal for this caller.
 */
export function prefetch(href: string | HTMLAnchorElement, options?: PrefetchAnchorOptions): void
export function prefetch(href: string | HTMLAnchorElement, options?: PrefetchOptions): void {
  if (typeof href === 'string') {
    let request = getPrefetchRequest(
      href,
      options && { target: options.target, signal: options.signal },
    )
    if (request) dispatchPrefetch(request)
  } else {
    let request = getAnchorPrefetchRequest(href, options?.signal)
    if (request && hasPrefetchTarget(request)) prefetchAnchor(request, href)
  }
}

function dispatchPrefetch(request: PrefetchRequest): void | Promise<void> {
  let [src, options] = request
  let result = options ? prefetchFrame(src, options) : prefetchFrame(src)
  void Promise.resolve(result).catch(() => {})
  return result
}

function createAnchorPrefetching(
  signal?: AbortSignal,
  updateViewport?: (anchor: HTMLAnchorElement) => void,
): (request: PrefetchRequest, anchor: HTMLAnchorElement, declarative?: boolean) => void {
  interface Caller {
    controller: AbortController
    src: string
    target: string | undefined
    declarative: boolean
  }
  let pending = new WeakMap<HTMLAnchorElement, Set<Caller>>()
  let count = 0
  let mutations: MutationObserver | undefined

  function update(anchor: HTMLAnchorElement): void {
    let callers = pending.get(anchor)
    if (callers) {
      let request = getAnchorPrefetchRequest(anchor)
      let marker = anchor.getAttribute('data-rmx-prefetch')
      for (let caller of callers) {
        if (
          !request ||
          !hasPrefetchTarget(request) ||
          caller.src !== request[0] ||
          caller.target !== request[1]?.target ||
          (caller.declarative && marker !== 'intent' && marker !== 'viewport')
        ) {
          caller.controller.abort()
        }
      }
    }
    updateViewport?.(anchor)
  }

  function scan(node: Node): void {
    if (!(node instanceof Element)) return
    if (node instanceof HTMLAnchorElement) update(node)
    for (let anchor of node.querySelectorAll('a')) update(anchor)
  }

  function observe(): void {
    if (mutations) return
    mutations = new MutationObserver((records) => {
      if (signal?.aborted) return
      for (let record of records) {
        if (record.type === 'attributes' && record.target instanceof HTMLAnchorElement) {
          update(record.target)
        }
        for (let node of record.removedNodes) scan(node)
        for (let node of record.addedNodes) scan(node)
      }
    })
    mutations.observe(document, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        'href',
        'data-rmx-prefetch',
        'download',
        'data-rmx-document',
        'rel',
        'referrerpolicy',
        'data-rmx-target',
        'data-rmx-src',
        'target',
      ],
    })
  }

  signal?.addEventListener('abort', () => mutations?.disconnect(), { once: true })
  if (updateViewport) {
    observe()
    scan(document.documentElement)
  }

  return function prefetch([src, options], anchor, declarative = false) {
    if (signal?.aborted || options?.signal?.aborted || !anchor.isConnected) return
    observe()
    let controller = new AbortController()
    let signals = [controller.signal]
    if (signal) signals.push(signal)
    if (options?.signal) signals.push(options.signal)
    let callerSignal = AbortSignal.any(signals)
    let reference = new WeakRef(anchor)
    let callers = pending.get(anchor) ?? new Set<Caller>()
    let caller: Caller = {
      controller,
      src,
      target: options?.target,
      declarative,
    }
    callers.add(caller)
    pending.set(anchor, callers)
    count++

    function finish(): void {
      if (!callers.delete(caller)) return
      callerSignal.removeEventListener('abort', finish)
      let element = reference.deref()
      if (callers.size === 0 && element) pending.delete(element)
      if (--count === 0 && !updateViewport) {
        mutations?.disconnect()
        mutations = undefined
      }
    }

    callerSignal.addEventListener('abort', finish, { once: true })
    try {
      let result = dispatchPrefetch([src, { ...options, element: anchor, signal: callerSignal }])
      // Void callbacks can leave custom work queued; retain their weakly tracked caller until abort.
      if (result && typeof result.then === 'function') {
        void Promise.resolve(result).then(finish, finish)
      }
    } catch {
      finish()
    }
  }
}

/**
 * Prefetches marked links on mouse/keyboard intent or when they enter the viewport.
 *
 * @param signal Abort signal used to remove the listeners.
 * @param prefetchOverride Replaces how pages are prefetched while the listeners are active.
 */
export function startPrefetching(signal: AbortSignal, prefetchOverride?: PrefetchFrame): void {
  if (signal.aborted) return
  let canIntercept = getInterceptableNavigation()
  let strategy = createFramePrefetch(signal)
  prefetchAnchor = createAnchorPrefetching(
    signal,
    canIntercept ? startViewportPrefetching(signal) : undefined,
  )
  defaultPrefetchFrame = strategy
  prefetchFrame = prefetchOverride ?? prefetchPage
  signal.addEventListener(
    'abort',
    () => {
      if (defaultPrefetchFrame === strategy) {
        defaultPrefetchFrame = initialPrefetch
        prefetchFrame = prefetchPage
        prefetchAnchor = initialAnchorPrefetch
      }
    },
    { once: true },
  )
  if (!canIntercept) return

  // Hover and focus share an intent on the same link until both inputs leave it.
  interface Intent {
    anchor: HTMLAnchorElement
    timer: ReturnType<typeof setTimeout> | undefined
    prefetched: boolean
  }
  let intents: { pointer?: Intent; focus?: Intent } = {}
  function enter(kind: keyof typeof intents, target: EventTarget | null): Intent | undefined {
    let anchor = getIntentAnchor(target)
    if (!anchor) return
    let intent = intents.pointer?.anchor === anchor ? intents.pointer : intents.focus
    if (intent?.anchor !== anchor) {
      intent = { anchor, timer: undefined, prefetched: false }
      let next = intent
      intent.timer = setTimeout(() => trigger(next), INTENT_DELAY_MS)
    }
    setIntent(kind, intent)
    return intent
  }
  function setIntent(kind: keyof typeof intents, next?: Intent) {
    let previous = intents[kind]
    intents[kind] = next
    if (previous && previous !== intents.pointer && previous !== intents.focus)
      clearTimeout(previous.timer)
  }
  function trigger(intent: Intent) {
    clearTimeout(intent.timer)
    intent.timer = undefined
    if (
      intent.prefetched ||
      intent.anchor.getAttribute('data-rmx-prefetch') !== 'intent' ||
      !canPrefetchAutomatically()
    ) {
      return
    }
    intent.prefetched = true
    let request = getAnchorPrefetchRequest(intent.anchor)
    if (request && hasPrefetchTarget(request)) prefetchAnchor(request, intent.anchor, true)
  }
  function leave(kind: keyof typeof intents, event: PointerEvent | FocusEvent) {
    let anchor = intents[kind]?.anchor
    if (
      event.target instanceof Node &&
      anchor?.contains(event.target) &&
      !(event.relatedTarget instanceof Node && anchor.contains(event.relatedTarget))
    ) {
      setIntent(kind)
    }
  }
  document.addEventListener(
    'pointerover',
    (event) => {
      if (event.pointerType === 'mouse') enter('pointer', event.target)
    },
    { signal },
  )
  document.addEventListener('focusin', (event) => enter('focus', event.target), { signal })
  document.addEventListener('pointerout', (event) => leave('pointer', event), { signal })
  document.addEventListener('focusout', (event) => leave('focus', event), { signal })
  document.addEventListener(
    'pointerdown',
    (event) => {
      // Other buttons and modifier keys open new tabs, which can't reuse the prefetch.
      let opensHere =
        event.isPrimary &&
        event.button === 0 &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.shiftKey
      let intent = opensHere && enter('pointer', event.target)
      if (intent) trigger(intent)
    },
    { passive: true, signal },
  )
  signal.addEventListener(
    'abort',
    () => {
      setIntent('pointer')
      setIntent('focus')
    },
    { once: true },
  )
}

function startViewportPrefetching(
  signal: AbortSignal,
): ((anchor: HTMLAnchorElement) => void) | undefined {
  if (typeof IntersectionObserver === 'undefined') return

  let completed = new WeakMap<HTMLAnchorElement, string>()
  // Keep observing queued links while scrolling or hidden so exits can still cancel them.
  let entered = new Set<HTMLAnchorElement>()
  let scrolling: ReturnType<typeof setTimeout> | undefined

  function getRequest(anchor: HTMLAnchorElement): PrefetchRequest | undefined {
    if (anchor.getAttribute('data-rmx-prefetch') !== 'viewport') return
    return getAnchorPrefetchRequest(anchor)
  }

  function prefetchEntered(anchor: HTMLAnchorElement): void {
    let request = getRequest(anchor)
    if (!request || !hasPrefetchTarget(request)) return
    let key = JSON.stringify(request)
    if (completed.get(anchor) === key) return
    completed.set(anchor, key)
    viewport.unobserve(anchor)
    prefetchAnchor(request, anchor, true)
  }

  function intersect(entries: IntersectionObserverEntry[]): void {
    if (signal.aborted) return
    for (let { target, isIntersecting } of entries) {
      if (!(target instanceof HTMLAnchorElement)) continue
      if (!isIntersecting) entered.delete(target)
      else entered.add(target)
    }
    flush()
  }

  function flush(): void {
    if (signal.aborted || document.hidden || scrolling !== undefined) return
    if (!canPrefetchAutomatically()) entered.clear()
    for (let anchor of entered) {
      if (signal.aborted || document.hidden || scrolling !== undefined) break
      entered.delete(anchor)
      prefetchEntered(anchor)
    }
  }

  let viewport = new IntersectionObserver(intersect)

  // Scroll events don't bubble, so a capturing listener also hears nested scrollers.
  document.addEventListener(
    'scroll',
    () => {
      clearTimeout(scrolling)
      scrolling = setTimeout(() => {
        // Keep deferring until queued entries and exits reflect the final scroll position.
        intersect(viewport.takeRecords())
        scrolling = undefined
        flush()
      }, SCROLL_SETTLE_MS)
    },
    { capture: true, passive: true, signal },
  )

  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.hidden) return
      // Layout may have changed while hidden. Reobserve queued links for fresh intersections.
      for (let { target } of viewport.takeRecords()) {
        if (target instanceof HTMLAnchorElement) entered.add(target)
      }
      for (let anchor of entered) update(anchor)
    },
    { signal },
  )

  function update(anchor: HTMLAnchorElement): void {
    viewport.unobserve(anchor)
    entered.delete(anchor)
    // Named frames can still be hydrating here; check their registration when the link enters view.
    let request = getRequest(anchor)
    if (!request) {
      completed.delete(anchor)
      return
    }
    if (completed.get(anchor) !== JSON.stringify(request)) viewport.observe(anchor)
  }

  signal.addEventListener(
    'abort',
    () => {
      clearTimeout(scrolling)
      entered.clear()
      viewport.disconnect()
    },
    { once: true },
  )
  return update
}

function canPrefetchAutomatically(): boolean {
  let { connection }: Navigator & { connection?: { saveData?: boolean; effectiveType?: string } } =
    navigator
  return (
    connection?.saveData !== true &&
    connection?.effectiveType !== 'slow-2g' &&
    connection?.effectiveType !== '2g'
  )
}

function getIntentAnchor(target: EventTarget | null): HTMLAnchorElement | null {
  if (!(target instanceof Element)) return null
  let anchor = target.closest('a[href][data-rmx-prefetch="intent"]')
  return anchor instanceof HTMLAnchorElement ? anchor : null
}

function getAnchorPrefetchRequest(
  anchor: HTMLAnchorElement,
  signal?: AbortSignal,
): PrefetchRequest | undefined {
  if (
    !anchor.isConnected ||
    !anchor.matches('[href]:not([download],[data-rmx-document],[referrerpolicy])') ||
    hasNoReferrer(anchor) ||
    (anchor.target !== '' && anchor.target !== '_self')
  ) {
    return
  }
  let href = getSameOriginHref(anchor.href)
  let src = getSameOriginHref(anchor.getAttribute('data-rmx-src') ?? anchor.href)
  if (!href || !src) return
  let target = anchor.getAttribute('data-rmx-target') ?? undefined
  let options = signal ? { signal } : undefined
  return getPrefetchRequest(target ? src : href, target ? { ...options, target } : options)
}

function hasPrefetchTarget(request: PrefetchRequest): boolean {
  let target = request[1]?.target
  return !target || getNamedFrame(target) != null
}

function getPrefetchRequest(href: string, options?: PrefetchOptions): PrefetchRequest | undefined {
  if (!getInterceptableNavigation()) return
  let src = getSameOriginHref(href)
  if (!src) return
  if (options?.target) return [src, options]
  let currentUrl = new URL(window.location.href)
  currentUrl.hash = ''
  if (src !== currentUrl.href)
    return options?.signal || options?.target !== undefined ? [src, options] : [src]
}

function getSameOriginHref(href: string): string | undefined {
  let url = getSameOriginUrl(href)
  if (!url) return
  url.hash = ''
  return url.href
}

export function isHtmlResponse(response: Response): boolean {
  return response.headers.get('Content-Type')?.toLowerCase().includes('text/html') ?? false
}

export function fetchFrame(
  src: string,
  target: string | undefined,
  init: RequestInit,
  fetchImpl: (url: string, init: RequestInit) => Promise<Response> = globalThis.fetch,
): Promise<Response> {
  let url = new URL(src, document.baseURI)
  url.hash = ''
  let headers = new Headers(init.headers)
  headers.set('Accept', 'text/html')
  headers.set('X-Remix-Frame', 'true')
  if (target != null) headers.set('X-Remix-Target', target)
  return fetchImpl(url.href, { ...init, headers, mode: 'same-origin' })
}

function createPrefetchOwners(first: AbortSignal, onEmpty: () => void) {
  let signals = new Set<AbortSignal>()
  function cancel() {
    for (let owner of signals) {
      if (owner.aborted) signals.delete(owner)
    }
    if (!signals.size) onEmpty()
  }
  function add(signal: AbortSignal) {
    if (signals.has(signal)) return
    signals.add(signal)
    signal.addEventListener('abort', cancel, { once: true })
  }
  add(first)
  return {
    add,
    clear() {
      for (let signal of signals) signal.removeEventListener('abort', cancel)
      signals.clear()
    },
  }
}

interface FramePrefetchEntry {
  controller: AbortController
  owners: ReturnType<typeof createPrefetchOwners>
  element: Element | undefined
  dependencies: Set<FramePrefetchEntry>
  ready: Promise<void>
}

interface PrefetchOwner {
  signal: AbortSignal
  element: Element | undefined
}

interface FramePrefetchOverrides {
  fetch?: DefaultPrefetchOverrides['fetch']
  process?(
    context: Omit<ProcessFrameContext, 'frames'>,
    elements: Element[],
    baseURL: string,
    prefetchAssets: (
      elements: readonly Element[],
      cache?: Map<string, Promise<void>>,
    ) => Promise<void>[],
    prefetchFrame: (src: string, target?: string) => Promise<void>,
  ): Promise<void>
}

function createFramePrefetch(
  signal?: AbortSignal,
): (
  src: string,
  options?: PrefetchFrameOptions,
  overrides?: FramePrefetchOverrides,
) => Promise<void> {
  let pending = new Map<string, FramePrefetchEntry>()
  let assets = new Map<
    string,
    { ready: Promise<void>; owners: ReturnType<typeof createPrefetchOwners> }
  >()

  function prefetchAsset(link: HTMLLinkElement, jobSignal: AbortSignal): Promise<void> {
    if (jobSignal.aborted || !link.relList.supports(link.rel)) return Promise.resolve()
    let key = assetKey(link)
    let existing = assets.get(key)
    if (existing) {
      existing.owners.add(jobSignal)
      return existing.ready
    }
    let { promise: ready, resolve } = Promise.withResolvers<void>()
    let owners = createPrefetchOwners(jobSignal, finish)
    function finish() {
      link.removeEventListener('load', finish)
      link.removeEventListener('error', finish)
      link.remove()
      pendingPrefetchLinks.delete(link)
      assets.delete(key)
      owners.clear()
      resolve()
    }
    assets.set(key, { ready, owners })
    link.addEventListener('load', finish, { once: true })
    link.addEventListener('error', finish, { once: true })
    pendingPrefetchLinks.add(link)
    document.head.append(link)
    return ready
  }

  async function discover(
    src: string,
    target: string | undefined,
    overrides: FramePrefetchOverrides | undefined,
    entry: FramePrefetchEntry,
    visited: Set<string>,
  ): Promise<void> {
    let jobSignal = entry.controller.signal
    try {
      let response = await fetchFrame(
        src,
        target,
        {
          method: 'GET',
          headers: { 'X-Remix-Prefetch': 'true' },
          priority: 'low',
          signal: jobSignal,
        },
        overrides?.fetch,
      )
      if (jobSignal.aborted || !response.ok || !isHtmlResponse(response)) {
        await response.body?.cancel()
        return
      }
      let html = await response.text()
      if (jobSignal.aborted) return
      await new Promise<void>((resolve) => {
        let idle = typeof requestIdleCallback === 'function'
        let id = idle
          ? requestIdleCallback(finish, { timeout: IDLE_TIMEOUT_MS })
          : window.setTimeout(finish)
        function finish() {
          if (idle) cancelIdleCallback(id)
          else clearTimeout(id)
          jobSignal.removeEventListener('abort', finish)
          resolve()
        }
        jobSignal.addEventListener('abort', finish, { once: true })
      })
      if (jobSignal.aborted) return
      // Template contents stay inert, including scripts, styles, and nested frame templates.
      let template = document.createElement('template')
      template.innerHTML = html
      let fragment = template.content
      let responseURL = response.url || src
      let baseURL = responseURL
      let base = fragment.querySelector('base[href]')?.getAttribute('href')
      if (base != null) {
        try {
          baseURL = new URL(base, responseURL).href
        } catch {
          // An invalid base falls back to the response URL, as it would in a document.
        }
      }
      let elements = getResponseElements(fragment)
      let discoveredAssets = Object.freeze(
        elements.filter(
          (element) =>
            !(element instanceof HTMLImageElement) &&
            assetDestination(element) &&
            getElementHref(element, baseURL),
        ),
      )
      function prefetchAssets(
        elements: readonly Element[],
        cache?: Map<string, Promise<void>>,
      ): Promise<void>[] {
        let activeAssets = new Set<string>()
        for (let element of document.querySelectorAll('link[href], script[src]')) {
          if (element instanceof HTMLLinkElement && pendingPrefetchLinks.has(element)) continue
          let link = createAssetPrefetch(element, element.baseURI)
          if (link) activeAssets.add(assetKey(link))
        }
        let requests: Promise<void>[] = []
        for (let element of elements) {
          let link = createAssetPrefetch(element, baseURL)
          if (!link) continue
          let key = assetKey(link)
          if (activeAssets.has(key)) continue
          let ready = cache?.get(key) ?? prefetchAsset(link, jobSignal)
          cache?.set(key, ready)
          requests.push(ready)
        }
        return requests
      }

      if (overrides?.process) {
        await overrides.process(
          {
            src,
            target,
            response,
            fragment,
            assets: discoveredAssets,
            signal: jobSignal,
            element: entry.element,
          },
          elements,
          baseURL,
          prefetchAssets,
          (href, name) =>
            traverse(
              href,
              name,
              { signal: jobSignal, element: entry.element },
              overrides,
              visited,
              entry,
            ),
        )
      } else {
        await Promise.all(prefetchAssets(discoveredAssets))
      }
    } catch {
      // Speculative failures leave navigation to the default resolver.
    }
  }

  function traverse(
    src: string,
    target: string | undefined,
    owner: PrefetchOwner,
    overrides: FramePrefetchOverrides | undefined,
    visited: Set<string>,
    parent?: FramePrefetchEntry,
  ): Promise<void> {
    if (signal?.aborted || owner.signal.aborted) return Promise.resolve()
    let key = JSON.stringify([src, target])
    let existing = pending.get(key)
    if (existing) {
      visited.add(key)
      // Concurrent roots can discover one another; avoid waiting on a dependency cycle.
      if (parent && dependsOn(existing, parent)) return Promise.resolve()
      parent?.dependencies.add(existing)
      existing.owners.add(owner.signal)
      return existing.ready
    }
    if (visited.has(key)) return Promise.resolve()
    visited.add(key)
    let { promise: ready, resolve } = Promise.withResolvers<void>()
    let controller = new AbortController()
    let cancel = () => controller.abort()
    let entry: FramePrefetchEntry = {
      controller,
      owners: createPrefetchOwners(owner.signal, cancel),
      element: owner.element,
      dependencies: new Set(),
      ready,
    }
    function finish() {
      if (pending.get(key) === entry) pending.delete(key)
      entry.owners.clear()
      signal?.removeEventListener('abort', cancel)
      entry.controller.signal.removeEventListener('abort', finish)
      resolve()
    }
    pending.set(key, entry)
    parent?.dependencies.add(entry)
    signal?.addEventListener('abort', cancel, { once: true })
    entry.controller.signal.addEventListener('abort', finish, { once: true })
    void discover(src, target, overrides, entry, visited).finally(finish)
    return ready
  }

  return function prefetch(
    src: string,
    options?: PrefetchFrameOptions,
    overrides?: FramePrefetchOverrides,
  ): Promise<void> {
    let owner: PrefetchOwner = {
      signal: options?.signal ?? AbortSignal.any([]),
      element: options?.element,
    }
    let ready = traverse(src, options?.target, owner, overrides, new Set())
    if (!options?.signal || owner.signal.aborted) return ready
    return new Promise((resolve) => {
      let finish = () => {
        owner.signal.removeEventListener('abort', finish)
        resolve()
      }
      owner.signal.addEventListener('abort', finish, { once: true })
      void ready.then(finish)
    })
  }
}

function dependsOn(entry: FramePrefetchEntry, target: FramePrefetchEntry): boolean {
  return (
    entry === target || Array.from(entry.dependencies).some((child) => dependsOn(child, target))
  )
}

function getResponseElements(source: DocumentFragment): Element[] {
  let elements: Element[] = []
  for (let element of source.querySelectorAll('*')) {
    elements.push(element)
    if (element instanceof HTMLTemplateElement)
      elements.push(...getResponseElements(element.content))
  }
  return elements
}

const javaScriptTypes = new Set(['', 'module', 'text/javascript', 'application/javascript'])

// Modules are prefetched as scripts with module credentials.
function assetDestination(element: Element): string | undefined {
  if (element instanceof HTMLScriptElement) {
    let type = element.type.toLowerCase()
    if (javaScriptTypes.has(type)) return type === 'module' ? 'module' : 'script'
  } else if (element instanceof HTMLImageElement) {
    if (!element.srcset) return 'image'
  } else if (element instanceof HTMLLinkElement) {
    let { relList, as } = element
    let preload = relList.contains('preload')
    if (preload && as === 'image' && element.imageSrcset.trim()) return
    if (relList.contains('modulepreload')) return 'module'
    if (relList.contains('stylesheet')) return 'style'
    if (preload && PRELOAD_DESTINATIONS.includes(as)) return as
  }
}

function getElementHref(element: Element, baseURL: string): string | undefined {
  return getAssetHref(
    element.getAttribute(element instanceof HTMLLinkElement ? 'href' : 'src'),
    baseURL,
  )
}

function getAssetHref(value: string | null, baseURL: string): string | undefined {
  if (!value?.trim()) return
  try {
    let url = new URL(value, baseURL)
    if (url.protocol === 'http:' || url.protocol === 'https:') return url.href
  } catch {
    // Incomplete or malformed declarations remain available through the fragment.
  }
}

function createAssetPrefetch(element: Element, baseUrl: string): HTMLLinkElement | undefined {
  let destination = assetDestination(element)
  if (!destination) return
  if (
    element instanceof HTMLLinkElement &&
    element.relList.contains('preload') &&
    element.media &&
    !matchMedia(element.media).matches
  )
    return
  let href = getElementHref(element, baseUrl)
  if (!href) return

  let isModule = destination === 'module'
  let link = document.createElement('link')
  // Ordinary prefetches don't evaluate modules or resolve their imports in the current import map.
  link.rel = 'prefetch'
  link.fetchPriority = 'low'
  link.as = isModule ? 'script' : destination
  link.href = href
  for (let name of ['integrity', 'referrerpolicy']) {
    let value = element.getAttribute(name)
    if (value !== null) link.setAttribute(name, value)
  }
  if (isModule || element.hasAttribute('crossorigin')) {
    link.crossOrigin =
      element.getAttribute('crossorigin')?.toLowerCase() === 'use-credentials'
        ? 'use-credentials'
        : 'anonymous'
  }
  return link
}

function assetKey(link: HTMLLinkElement): string {
  return JSON.stringify([link.href, link.as, link.crossOrigin, link.integrity, link.referrerPolicy])
}

/**
 * Fetches and parses frame HTML, then prefetches discovered assets.
 *
 * Prepared HTML requests use low priority and send `X-Remix-Prefetch: true`.
 * Overrides receive the prepared GET request and the inert parsed fragment. Native asset hints
 * never run scripts or apply styles. Pending requests are shared by source and target; the first
 * caller supplies the overrides. Nested sources are exposed to the `processFrame` hook and fetched
 * only when explicitly selected. Completed responses are discarded. Failures and cancellation
 * finish without affecting navigation, and custom work must honor the provided signal.
 *
 * @param src Same-origin frame source, resolved against the document base URL.
 * @param options Destination frame, cancellation signal, and triggering element.
 * @param overrides HTML fetch implementation and post-parse reference handling.
 * @returns Completes after the hook and delegated work finish, or when cancelled.
 */
export function defaultPrefetch(
  src: string,
  options?: PrefetchFrameOptions,
  overrides?: DefaultPrefetchOverrides,
): Promise<void> {
  return prefetchPage(src, options, prepareOverrides(overrides))
}

export function createDefaultPrefetch(signal?: AbortSignal) {
  let prefetch = createFramePrefetch(signal)
  return (src: string, options?: PrefetchFrameOptions, overrides?: DefaultPrefetchOverrides) =>
    prefetch(src, options, prepareOverrides(overrides))
}

function prepareOverrides(
  overrides?: DefaultPrefetchOverrides,
): FramePrefetchOverrides | undefined {
  if (!overrides) return
  return {
    get fetch() {
      return overrides.fetch
    },
    async process(context, elements, baseURL, prefetchAssets, prefetchFrame) {
      if (!overrides.processFrame) {
        await Promise.all(prefetchAssets(context.assets))
        return
      }
      let allowed = new Set(elements)
      let frames = Object.freeze(discoverFrames(elements, baseURL))
      let assetCache = new Map<string, Promise<void>>()
      let frameCache = new Map<string, Promise<void>>()
      let delegated: Promise<void>[] = []
      let accepting = true
      function prefetchReferences(references?: PrefetchReferences): Promise<void> {
        if (!accepting || context.signal.aborted) return Promise.resolve()
        let selected = references?.assets ?? context.assets
        let requests = prefetchAssets(
          selected.filter((element) => allowed.has(element)),
          assetCache,
        )
        for (let frame of references?.frames ?? []) {
          try {
            let href = getFrameHref(frame.src, baseURL)
            if (!href) continue
            let key = JSON.stringify([href, frame.target])
            let ready = frameCache.get(key) ?? prefetchFrame(href, frame.target)
            frameCache.set(key, ready)
            requests.push(ready)
          } catch {
            // A malformed selected reference does not discard the other references.
          }
        }
        let ready = Promise.all(requests).then(() => {})
        delegated.push(ready)
        return ready
      }
      try {
        await overrides.processFrame(prefetchReferences, { ...context, frames })
      } finally {
        accepting = false
        await Promise.all(delegated)
      }
    },
  }
}

function getFrameHref(src: string, baseURL: string): string | undefined {
  let url = getSameOriginUrl(src, baseURL)
  if (url && (url.protocol === 'http:' || url.protocol === 'https:')) {
    url.hash = ''
    return url.href
  }
}

function discoverFrames(elements: Element[], baseURL: string): PrefetchFrameReference[] {
  let frames: PrefetchFrameReference[] = []
  for (let element of elements) {
    if (
      !(element instanceof HTMLScriptElement) ||
      element.id !== 'rmx-data' ||
      element.type !== 'application/json'
    )
      continue
    let data: unknown
    try {
      data = JSON.parse(element.textContent ?? '')
    } catch {
      continue
    }
    if (!isObject(data) || !isObject(data.f) || Array.isArray(data.f)) continue
    for (let frame of Object.values(data.f)) {
      if (!isObject(frame) || typeof frame.src !== 'string' || !frame.src) continue
      let target = frame.name
      if (target !== undefined && typeof target !== 'string') continue
      let src = getFrameHref(frame.src, baseURL)
      if (!src) continue
      let loading: PrefetchFrameReference['loading'] = frame.status === 'lazy' ? 'lazy' : 'eager'
      let fallback =
        typeof frame.fallback === 'boolean' ? frame.fallback : frame.status === 'pending'
      frames.push(Object.freeze({ src, target, loading, fallback }))
    }
  }
  return frames
}
