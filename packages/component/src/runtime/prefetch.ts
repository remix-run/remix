import { getNamedFrame, pendingPrefetchLinks } from './frame.ts'
import { getInterceptableNavigation, getSameOriginUrl } from './navigation.ts'

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

/** References to delegate to Remix's native asset hints and nested frame fetching. */
export interface PrefetchReferences {
  /** Original asset elements to prefetch (defaults to discovered asset declarations). */
  assets?: readonly Element[]
  /** Nested frame requests to fetch using the same overrides (defaults to none). */
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
   * Handles each parsed response. Call `prefetchReferences()` to prefetch discovered assets,
   * or pass selected arrays. Omitted assets use discovered defaults; omitted frames are not fetched.
   * Pass `frames` explicitly to prefetch nested sources. Returning without delegating skips Remix's
   * work. Responsive image and track preloads are skipped by native hints; the hook may perform and
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

const initialPrefetch = createDefaultPrefetch()
let defaultPrefetchFrame = initialPrefetch
let prefetchFrame: (src: string, options?: PrefetchFrameOptions) => void | Promise<void> =
  defaultPrefetch
const initialAnchorPrefetch = createAnchorPrefetching()
let prefetchAnchor = initialAnchorPrefetch

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
  let request =
    typeof href === 'string'
      ? getPrefetchRequest(
          href,
          options ? { target: options.target, signal: options.signal } : undefined,
        )
      : getAnchorPrefetchRequest(href, options?.signal)
  if (request && (typeof href === 'string' || hasPrefetchTarget(request))) {
    dispatchPrefetch(request, typeof href === 'string' ? undefined : href)
  }
}

function dispatchPrefetch(
  request: PrefetchRequest,
  anchor?: HTMLAnchorElement,
  trigger?: 'intent' | 'viewport',
): void | Promise<void> {
  if (anchor) return prefetchAnchor(request, anchor, trigger)
  let [src, options] = request
  let result = options ? prefetchFrame(src, options) : prefetchFrame(src)
  void Promise.resolve(result).catch(() => {})
  return result
}

function createAnchorPrefetching(
  signal?: AbortSignal,
  updateViewport?: (anchor: HTMLAnchorElement) => void,
): (request: PrefetchRequest, anchor: HTMLAnchorElement, trigger?: 'intent' | 'viewport') => void {
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

  return function prefetch([src, options], anchor, trigger) {
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
      declarative: trigger !== undefined,
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
  let strategy = createDefaultPrefetch(signal)
  let anchorStrategy = createAnchorPrefetching(
    signal,
    getInterceptableNavigation() ? startViewportPrefetching(signal) : undefined,
  )
  prefetchAnchor = anchorStrategy
  defaultPrefetchFrame = strategy
  prefetchFrame = prefetchOverride ?? defaultPrefetch
  signal.addEventListener(
    'abort',
    () => {
      if (defaultPrefetchFrame === strategy) {
        defaultPrefetchFrame = initialPrefetch
        prefetchFrame = defaultPrefetch
        prefetchAnchor = initialAnchorPrefetch
      }
    },
    { once: true },
  )
  if (!getInterceptableNavigation()) return

  // Hover and focus share an intent on the same link until both inputs leave it.
  interface Intent {
    anchor: HTMLAnchorElement
    timer: ReturnType<typeof setTimeout> | undefined
    prefetched: boolean
  }
  let pointerIntent: Intent | undefined
  let focusIntent: Intent | undefined

  function rest(anchor: HTMLAnchorElement): Intent {
    if (pointerIntent?.anchor === anchor) return pointerIntent
    if (focusIntent?.anchor === anchor) return focusIntent
    let intent: Intent = { anchor, timer: undefined, prefetched: false }
    intent.timer = setTimeout(() => trigger(intent), INTENT_DELAY_MS)
    return intent
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
    if (request && hasPrefetchTarget(request)) dispatchPrefetch(request, intent.anchor, 'intent')
  }
  function stopResting(intent: Intent | undefined) {
    if (intent !== pointerIntent && intent !== focusIntent) clearTimeout(intent?.timer)
  }
  function leave(event: PointerEvent | FocusEvent, intent: Intent | undefined): Intent | undefined {
    if (!(event.target instanceof Node && intent?.anchor.contains(event.target))) return intent
    let next = event.relatedTarget
    return next instanceof Node && intent.anchor.contains(next) ? intent : undefined
  }

  document.addEventListener(
    'pointerover',
    (event) => {
      let anchor = getIntentAnchor(event.target)
      if (!anchor || event.pointerType !== 'mouse') return
      let previous = pointerIntent
      pointerIntent = rest(anchor)
      stopResting(previous)
    },
    { signal },
  )
  document.addEventListener(
    'focusin',
    (event) => {
      let anchor = getIntentAnchor(event.target)
      if (!anchor) return
      let previous = focusIntent
      focusIntent = rest(anchor)
      stopResting(previous)
    },
    { signal },
  )
  document.addEventListener(
    'pointerout',
    (event) => {
      let previous = pointerIntent
      pointerIntent = leave(event, pointerIntent)
      stopResting(previous)
    },
    { signal },
  )
  document.addEventListener(
    'focusout',
    (event) => {
      let previous = focusIntent
      focusIntent = leave(event, focusIntent)
      stopResting(previous)
    },
    { signal },
  )
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
      let anchor = getIntentAnchor(event.target)
      if (!anchor || !opensHere) return
      let previous = pointerIntent
      pointerIntent = rest(anchor)
      stopResting(previous)
      trigger(pointerIntent)
    },
    { passive: true, signal },
  )
  signal.addEventListener(
    'abort',
    () => {
      clearTimeout(pointerIntent?.timer)
      clearTimeout(focusIntent?.timer)
      pointerIntent = focusIntent = undefined
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

  function prefetchAnchor(anchor: HTMLAnchorElement): void {
    let request = getRequest(anchor)
    if (!request || !hasPrefetchTarget(request)) return
    let key = JSON.stringify(request)
    if (completed.get(anchor) === key) return
    completed.set(anchor, key)
    viewport.unobserve(anchor)
    dispatchPrefetch(request, anchor, 'viewport')
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
      prefetchAnchor(anchor)
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
    if (!anchor.isConnected) {
      completed.delete(anchor)
      return
    }
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
  if (!('connection' in navigator)) return true
  let connection = navigator.connection
  if (typeof connection !== 'object' || connection === null) return true
  if ('saveData' in connection && connection.saveData === true) return false
  if ('effectiveType' in connection) {
    return connection.effectiveType !== 'slow-2g' && connection.effectiveType !== '2g'
  }
  return true
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
    !anchor.hasAttribute('href') ||
    anchor.hasAttribute('download') ||
    anchor.hasAttribute('data-rmx-document') ||
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

export function fetchFrame(
  src: string,
  target: string | undefined,
  init: RequestInit,
  contentType?: string,
  fetchImpl: (url: string, init: RequestInit) => Promise<Response> = globalThis.fetch,
): Promise<Response> {
  let url = new URL(src, document.baseURI)
  url.hash = ''
  let headers = new Headers(init.headers)
  headers.set('Accept', 'text/html')
  headers.set('X-Remix-Frame', 'true')
  if (target != null) headers.set('X-Remix-Target', target)
  if (contentType) headers.set('Content-Type', contentType)
  return fetchImpl(url.href, { ...init, headers, mode: 'same-origin' })
}

interface FramePrefetchEntry {
  controller: AbortController
  owners: Set<PrefetchOwner>
  element: Element | undefined
  dependencies: Set<FramePrefetchEntry>
  ready: Promise<void>
  cancel(): void
}

interface PrefetchOwner {
  signal: AbortSignal
  element: Element | undefined
}

export function createDefaultPrefetch(
  signal?: AbortSignal,
): (
  src: string,
  options?: PrefetchFrameOptions,
  overrides?: DefaultPrefetchOverrides,
) => Promise<void> {
  let pending = new Map<string, FramePrefetchEntry>()
  let assets = new Map<string, { ready: Promise<void>; owners: Set<AbortSignal>; cancel(): void }>()

  function prefetchAsset(link: HTMLLinkElement, jobSignal: AbortSignal): Promise<void> {
    if (jobSignal.aborted || !link.relList.supports(link.rel)) return Promise.resolve()
    let key = assetKey(link)
    let existing = assets.get(key)
    if (existing) {
      if (!existing.owners.has(jobSignal)) {
        existing.owners.add(jobSignal)
        jobSignal.addEventListener('abort', existing.cancel, { once: true })
      }
      return existing.ready
    }
    let { promise: ready, resolve } = Promise.withResolvers<void>()
    let owners = new Set([jobSignal])
    function finish() {
      link.removeEventListener('load', finish)
      link.removeEventListener('error', finish)
      link.remove()
      pendingPrefetchLinks.delete(link)
      assets.delete(key)
      for (let owner of owners) owner.removeEventListener('abort', cancel)
      owners.clear()
      resolve()
    }
    function cancel() {
      for (let owner of owners) {
        if (owner.aborted) owners.delete(owner)
      }
      if (owners.size === 0) finish()
    }
    assets.set(key, { ready, owners, cancel })
    link.addEventListener('load', finish, { once: true })
    link.addEventListener('error', finish, { once: true })
    jobSignal.addEventListener('abort', cancel, { once: true })
    pendingPrefetchLinks.add(link)
    document.head.append(link)
    return ready
  }

  async function discover(
    src: string,
    target: string | undefined,
    overrides: DefaultPrefetchOverrides | undefined,
    entry: FramePrefetchEntry,
    visited: Set<string>,
  ): Promise<void> {
    let jobSignal = entry.controller.signal
    let nestedOwner: PrefetchOwner = {
      signal: jobSignal,
      element: entry.element,
    }
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
        undefined,
        overrides?.fetch,
      )
      if (
        jobSignal.aborted ||
        !response.ok ||
        !response.headers.get('Content-Type')?.toLowerCase().includes('text/html')
      ) {
        await response.body?.cancel()
        return
      }
      let html = await response.text()
      if (jobSignal.aborted) return
      await new Promise<void>((resolve) => {
        let cancelIdle: () => void
        if (typeof requestIdleCallback === 'function') {
          let handle = requestIdleCallback(finish, { timeout: IDLE_TIMEOUT_MS })
          cancelIdle = () => cancelIdleCallback(handle)
        } else {
          let handle = setTimeout(finish, 0)
          cancelIdle = () => clearTimeout(handle)
        }
        function finish() {
          cancelIdle()
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
      let allowed = new Set(elements)
      let discoveredAssets = Object.freeze(
        elements.filter((element) => isAssetReference(element, baseURL)),
      )
      let frames = Object.freeze(discoverFrames(elements, baseURL))
      let delegated: Promise<void>[] = []
      let selectedAssets = new Map<string, Promise<void>>()
      let selectedFrames = new Map<string, Promise<void>>()
      let accepting = true

      function prefetchReferences(references?: PrefetchReferences): Promise<void> {
        if (!accepting || jobSignal.aborted) return Promise.resolve()
        let activeAssets = new Set<string>()
        for (let element of document.querySelectorAll('link[href], script[src]')) {
          if (element instanceof HTMLLinkElement && pendingPrefetchLinks.has(element)) continue
          let link = createAssetPrefetch(element, element.baseURI)
          if (link) activeAssets.add(assetKey(link))
        }
        let requests: Promise<void>[] = []
        for (let element of references?.assets ?? discoveredAssets) {
          if (!allowed.has(element)) continue
          let link = createAssetPrefetch(element, baseURL)
          if (!link) continue
          let key = assetKey(link)
          if (activeAssets.has(key)) continue
          let ready = selectedAssets.get(key) ?? prefetchAsset(link, jobSignal)
          selectedAssets.set(key, ready)
          requests.push(ready)
        }
        for (let frame of references?.frames ?? []) {
          try {
            let url = new URL(frame.src, baseURL)
            if (url.protocol !== 'http:' && url.protocol !== 'https:') continue
            let href = getSameOriginHref(url.href)
            if (!href) continue
            let key = JSON.stringify([href, frame.target])
            let ready =
              selectedFrames.get(key) ??
              traverse(href, frame.target, nestedOwner, overrides, visited, entry)
            selectedFrames.set(key, ready)
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
        if (overrides?.processFrame) {
          await overrides.processFrame(prefetchReferences, {
            src,
            target,
            response,
            fragment,
            assets: discoveredAssets,
            frames,
            signal: jobSignal,
            element: entry.element,
          })
        } else {
          void prefetchReferences()
        }
      } finally {
        accepting = false
        await Promise.all(delegated)
      }
    } catch {
      // Speculative failures leave navigation to the default resolver.
    }
  }

  function traverse(
    src: string,
    target: string | undefined,
    owner: PrefetchOwner,
    overrides: DefaultPrefetchOverrides | undefined,
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
      if (!existing.owners.has(owner)) {
        existing.owners.add(owner)
        owner.signal.addEventListener('abort', existing.cancel, { once: true })
      }
      return existing.ready
    }
    if (visited.has(key)) return Promise.resolve()
    visited.add(key)
    let { promise: ready, resolve } = Promise.withResolvers<void>()
    let entry: FramePrefetchEntry = {
      controller: new AbortController(),
      owners: new Set([owner]),
      element: owner.element,
      dependencies: new Set(),
      ready,
      cancel() {
        for (let subscriber of entry.owners) {
          if (subscriber.signal.aborted) entry.owners.delete(subscriber)
        }
        if (entry.owners.size === 0 || signal?.aborted) entry.controller.abort()
      },
    }
    function finish() {
      if (pending.get(key) === entry) pending.delete(key)
      for (let subscriber of entry.owners)
        subscriber.signal.removeEventListener('abort', entry.cancel)
      entry.owners.clear()
      signal?.removeEventListener('abort', entry.cancel)
      entry.controller.signal.removeEventListener('abort', finish)
      resolve()
    }
    pending.set(key, entry)
    parent?.dependencies.add(entry)
    owner.signal.addEventListener('abort', entry.cancel, { once: true })
    signal?.addEventListener('abort', entry.cancel, { once: true })
    entry.controller.signal.addEventListener('abort', finish, { once: true })
    void discover(src, target, overrides, entry, visited).finally(finish)
    return ready
  }

  return function prefetch(
    src: string,
    options?: PrefetchFrameOptions,
    overrides?: DefaultPrefetchOverrides,
  ): Promise<void> {
    let owner: PrefetchOwner = {
      signal: options?.signal ?? new AbortController().signal,
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

function isAssetReference(element: Element, baseURL: string): boolean {
  if (element instanceof HTMLScriptElement) {
    return (
      getAssetHref(element.getAttribute('src'), baseURL) !== undefined &&
      ['', 'module', 'text/javascript', 'application/javascript'].includes(
        element.type.toLowerCase(),
      )
    )
  }
  return (
    element instanceof HTMLLinkElement &&
    !(
      element.relList.contains('preload') &&
      element.as === 'image' &&
      element.imageSrcset.trim() !== ''
    ) &&
    (element.relList.contains('modulepreload') ||
      element.relList.contains('stylesheet') ||
      (element.relList.contains('preload') && PRELOAD_DESTINATIONS.includes(element.as))) &&
    getAssetHref(element.getAttribute('href'), baseURL) !== undefined
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
    if (typeof data !== 'object' || data === null || !('f' in data)) continue
    if (typeof data.f !== 'object' || data.f === null || Array.isArray(data.f)) continue
    for (let frame of Object.values(data.f)) {
      if (
        typeof frame !== 'object' ||
        frame === null ||
        !('src' in frame) ||
        typeof frame.src !== 'string' ||
        !frame.src
      )
        continue
      let target = 'name' in frame ? frame.name : undefined
      if (target !== undefined && typeof target !== 'string') continue
      try {
        let url = new URL(frame.src, baseURL)
        if (url.protocol !== 'http:' && url.protocol !== 'https:') continue
        let src = getSameOriginHref(url.href)
        if (src) {
          let loading: PrefetchFrameReference['loading'] =
            'status' in frame && frame.status === 'lazy' ? 'lazy' : 'eager'
          let fallback =
            'fallback' in frame && typeof frame.fallback === 'boolean'
              ? frame.fallback
              : 'status' in frame && frame.status === 'pending'
          frames.push(Object.freeze({ src, target, loading, fallback }))
        }
      } catch {
        // Malformed frame references do not prevent other prefetches.
      }
    }
  }
  return frames
}

function createAssetPrefetch(element: Element, baseUrl: string): HTMLLinkElement | undefined {
  if (element instanceof HTMLLinkElement) {
    if (!isAssetReference(element, baseUrl)) return
    if (
      element.relList.contains('preload') &&
      element.media &&
      !matchMedia(element.media).matches
    ) {
      return
    }
  } else if (element instanceof HTMLScriptElement) {
    if (
      !['', 'module', 'text/javascript', 'application/javascript'].includes(
        element.type.toLowerCase(),
      )
    ) {
      return
    }
  } else if (!(element instanceof HTMLImageElement) || element.srcset) {
    return
  }
  let href = getAssetHref(
    element.getAttribute(element instanceof HTMLLinkElement ? 'href' : 'src'),
    baseUrl,
  )
  if (!href) return

  let isModule =
    element instanceof HTMLScriptElement
      ? element.type.toLowerCase() === 'module'
      : element instanceof HTMLLinkElement && element.relList.contains('modulepreload')
  let link = document.createElement('link')
  // Ordinary prefetches don't evaluate modules or resolve their imports in the current import map.
  link.rel = 'prefetch'
  link.fetchPriority = 'low'
  link.as = element instanceof HTMLImageElement ? 'image' : 'script'
  if (element instanceof HTMLLinkElement && !isModule) {
    link.as = element.relList.contains('stylesheet') ? 'style' : element.as
  }
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
