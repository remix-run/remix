import { getNamedFrame, pendingPrefetchLinks } from './frame.ts'
import { getInterceptableNavigation, getSameOriginUrl } from './navigation.ts'

/** Options for prefetching frame content. */
export interface PrefetchOptions {
  /** Name of the destination frame, sent as `X-Remix-Target` by the default strategy. */
  target?: string
  /** Cancels this caller's prefetch, retaining work shared with other callers. */
  signal?: AbortSignal
  /**
   * Triggering elements to associate with this caller; automatic prefetches supply their link.
   * The default strategy copies the array while retaining live element references.
   */
  elements?: readonly Element[]
}

/** Shared frame request and triggering-element context for prefetch hooks. */
export interface PrefetchContext {
  /** Requested absolute frame source URL. */
  src: string
  /** Destination frame name, when provided. */
  target: string | undefined
  /**
   * Current uncancelled callers' triggering elements, deduplicated by identity. Read again to see
   * callers joining or cancelling. Nested requests inherit these origins; DOM removal alone does
   * not remove an element or cancel work.
   */
  readonly elements: readonly Element[]
  /** Aborts when all callers cancel or the runtime is disposed. */
  signal: AbortSignal
}

/** A nested frame source discovered in HTML from a `<Frame prefetch>` declaration. */
export interface PrefetchFrameReference {
  /** Absolute frame source URL without a hash. */
  readonly src: string
  /** Destination frame name, when provided. */
  readonly target?: string
}

/** References to delegate to Remix's native asset hints and nested frame fetching. */
export interface PrefetchReferences {
  /** Original asset elements, including supported elements selected from the fragment. */
  assets?: readonly Element[]
  /** Nested frame requests to fetch using the same overrides. */
  frames?: readonly PrefetchFrameReference[]
}

/** The parsed, detached HTML and references available to a custom prefetch hook. */
export interface PrefetchFrameContext extends PrefetchContext {
  /** Original response, whose body has been consumed into the fragment. */
  response: Response
  /** Inert HTML fragment, including templates; it is never mounted by Remix. */
  fragment: DocumentFragment
  /** Original script and link declarations, including those inside templates. */
  assets: readonly Element[]
  /** Opted-in nested frame requests, resolved against `baseURL`. */
  frames: readonly PrefetchFrameReference[]
  /** Final response URL resolved with the first `<base href>`, when present. */
  baseURL: string
}

/** Request and discovered-reference handling overrides for {@link defaultPrefetch}. */
export interface DefaultPrefetchOverrides {
  /**
   * Fetches each prepared HTML request (defaults to `globalThis.fetch`). Two-argument Fetch
   * implementations remain supported; the third argument provides shared request origins.
   *
   * @param url Prepared absolute frame source URL.
   * @param init Frame headers, GET method, priority, and cancellation signal.
   * @param context Shared frame request and current triggering elements.
   * @returns The unconsumed response for validation and parsing.
   */
  fetch?(url: string, init: RequestInit, context: PrefetchContext): Promise<Response>
  /**
   * Handles each parsed response. Call `prefetchReferences()` to delegate all discovered references,
   * or pass selected arrays; omitted arrays retain their discovered defaults. Returning without
   * delegating skips Remix's work. The hook may perform and await its own prefetching instead.
   *
   * @param prefetchReferences Starts selected default work while the hook is active.
   * @param context Parsed HTML, source elements, frame references, and cancellation context.
   * @returns Optional asynchronous custom work to finish before the prefetch completes.
   */
  frame?(
    prefetchReferences: (references?: PrefetchReferences) => Promise<void>,
    context: PrefetchFrameContext,
  ): void | Promise<void>
}

/**
 * Starts loading same-origin frame content so a later navigation can reuse the response.
 *
 * @param src Absolute URL of the page to prefetch, without a hash.
 * @param options Destination frame, cancellation signal, and triggering elements.
 */
export type PrefetchFrame = (src: string, options?: PrefetchOptions) => void

type PrefetchRequest = [src: string, options?: PrefetchOptions]

const INTENT_DELAY_MS = 100

const initialPrefetch = createDefaultPrefetch()
let defaultPrefetchFrame = initialPrefetch
let prefetchFrame: PrefetchFrame = defaultPrefetch

/**
 * Fetches and parses frame HTML, then prefetches discovered assets and opted-in nested frames.
 *
 * Overrides receive the prepared GET request and the inert parsed fragment. Native asset hints
 * never run scripts or apply styles. Pending requests are shared by source and target; the first
 * caller supplies the overrides. Completed responses are discarded. Failures and cancellation
 * finish without affecting navigation, and custom work must honor the provided signal.
 *
 * @param src Same-origin frame source, resolved against the document base URL.
 * @param options Destination frame, cancellation signal, and triggering elements.
 * @param overrides HTML fetch implementation and post-parse reference handling.
 * @returns Completes after the hook and delegated work finish, or when cancelled.
 */
export function defaultPrefetch(
  src: string,
  options?: PrefetchOptions,
  overrides?: DefaultPrefetchOverrides,
): Promise<void> {
  let href = getSameOriginHref(src)
  return href ? defaultPrefetchFrame(href, options, overrides) : Promise.resolve()
}

/**
 * Prefetches frame content so a later navigation can reuse the response. By default this
 * fetches HTML and discovers external JavaScript, CSS, and explicit image and font preloads for
 * `<link rel="prefetch">` hints.
 * Responses use the browser HTTP cache; even uncacheable HTML can reveal cacheable assets. Pass
 * `prefetch` to `run()` to change this behavior, or delegate to {@link defaultPrefetch} with overrides.
 * Opted-in nested `<Frame prefetch>` sources use the same strategy. Cross-origin URLs, the current
 * untargeted page, and browsers where Remix doesn't handle navigations are skipped.
 *
 * @param href URL to prefetch, resolved against the document base URL.
 * @param options Destination frame, cancellation signal, and triggering elements.
 */
export function prefetch(href: string, options?: PrefetchOptions): void {
  let request = getPrefetchRequest(href, options)
  if (request) dispatchPrefetch(request)
}

function dispatchPrefetch([src, options]: PrefetchRequest, element?: Element): void {
  if (element) options = { ...options, elements: Object.freeze([element]) }
  let result = options ? prefetchFrame(src, options) : prefetchFrame(src)
  void Promise.resolve(result).catch(() => {})
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
  defaultPrefetchFrame = strategy
  prefetchFrame = prefetchOverride ?? defaultPrefetch
  signal.addEventListener(
    'abort',
    () => {
      if (defaultPrefetchFrame === strategy) {
        defaultPrefetchFrame = initialPrefetch
        prefetchFrame = defaultPrefetch
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
    if (request && hasPrefetchTarget(request)) dispatchPrefetch(request, intent.anchor)
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
  startViewportPrefetching(signal)
}

function startViewportPrefetching(signal: AbortSignal): void {
  if (typeof IntersectionObserver === 'undefined') return

  let completed = new WeakMap<HTMLAnchorElement, string>()

  function getRequest(anchor: HTMLAnchorElement): PrefetchRequest | undefined {
    if (anchor.getAttribute('data-rmx-prefetch') !== 'viewport') return
    return getAnchorPrefetchRequest(anchor)
  }

  let viewport = new IntersectionObserver((entries) => {
    if (signal.aborted || !canPrefetchAutomatically()) return
    for (let { target, isIntersecting } of entries) {
      if (!isIntersecting || !(target instanceof HTMLAnchorElement)) continue
      let request = getRequest(target)
      if (!request || !hasPrefetchTarget(request)) continue
      let key = JSON.stringify(request)
      if (completed.get(target) === key) continue
      completed.set(target, key)
      viewport.unobserve(target)
      dispatchPrefetch(request, target)
    }
  })

  function update(anchor: HTMLAnchorElement): void {
    viewport.unobserve(anchor)
    if (!anchor.isConnected) {
      completed.delete(anchor)
      return
    }
    // Named frames can still be hydrating here; check their registration when the link enters view.
    let request = getRequest(anchor)
    if (request && completed.get(anchor) !== JSON.stringify(request)) viewport.observe(anchor)
  }

  function scan(node: Node): void {
    if (!(node instanceof Element)) return
    if (node instanceof HTMLAnchorElement) update(node)
    for (let anchor of node.querySelectorAll('a')) update(anchor)
  }

  let mutations = new MutationObserver((records) => {
    if (signal.aborted) return
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
  scan(document.documentElement)

  signal.addEventListener(
    'abort',
    () => {
      mutations.disconnect()
      viewport.disconnect()
    },
    { once: true },
  )
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

function getAnchorPrefetchRequest(anchor: HTMLAnchorElement): PrefetchRequest | undefined {
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
  let target = anchor.getAttribute('data-rmx-target')
  return target ? getPrefetchRequest(src, { target }) : getPrefetchRequest(href)
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
  if (src !== currentUrl.href) return options?.signal || options?.elements ? [src, options] : [src]
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
  fetchImpl: typeof globalThis.fetch = globalThis.fetch,
): Promise<Response> {
  let headers = new Headers({ Accept: 'text/html', 'X-Remix-Frame': 'true' })
  if (target != null) headers.set('X-Remix-Target', target)
  if (contentType) headers.set('Content-Type', contentType)
  return fetchImpl(src, { ...init, headers, mode: 'same-origin' })
}

interface FramePrefetchEntry {
  controller: AbortController
  owners: Set<PrefetchOwner>
  dependencies: Set<FramePrefetchEntry>
  ready: Promise<void>
  cancel(): void
}

interface PrefetchOwner {
  signal: AbortSignal
  readonly elements: readonly Element[]
}

function getPrefetchElements(entry: FramePrefetchEntry): readonly Element[] {
  let elements = new Set<Element>()
  for (let owner of entry.owners) {
    if (owner.signal.aborted) continue
    for (let element of owner.elements) elements.add(element)
  }
  return Object.freeze(Array.from(elements))
}

export function createDefaultPrefetch(
  signal?: AbortSignal,
): (src: string, options?: PrefetchOptions, overrides?: DefaultPrefetchOverrides) => Promise<void> {
  let pending = new Map<string, FramePrefetchEntry>()
  let assets = new Map<string, { ready: Promise<void>; owners: Set<AbortSignal>; cancel(): void }>()

  function prefetchAsset(link: HTMLLinkElement, jobSignal: AbortSignal): Promise<void> {
    if (jobSignal.aborted || !link.relList.supports('prefetch')) return Promise.resolve()
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
    let context: PrefetchContext = {
      src,
      target,
      signal: jobSignal,
      get elements() {
        return getPrefetchElements(entry)
      },
    }
    let nestedOwner: PrefetchOwner = {
      signal: jobSignal,
      get elements() {
        return context.elements
      },
    }
    try {
      let fetchOverride = overrides?.fetch
      let response = await fetchFrame(
        src,
        target,
        { method: 'GET', priority: 'low', signal: jobSignal },
        undefined,
        fetchOverride ? (_url, init) => fetchOverride(src, init ?? {}, context) : undefined,
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
      let discoveredAssets = Object.freeze(elements.filter(isAssetReference))
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
        for (let frame of references?.frames ?? frames) {
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
        if (overrides?.frame) {
          await overrides.frame(prefetchReferences, {
            src,
            target,
            response,
            fragment,
            assets: discoveredAssets,
            frames,
            baseURL,
            signal: jobSignal,
            get elements() {
              return context.elements
            },
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
    options?: PrefetchOptions,
    overrides?: DefaultPrefetchOverrides,
  ): Promise<void> {
    let owner: PrefetchOwner = {
      signal: options?.signal ?? new AbortController().signal,
      elements: Object.freeze(Array.from(options?.elements ?? [])),
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

function isAssetReference(element: Element): boolean {
  if (element instanceof HTMLScriptElement) {
    return (
      element.hasAttribute('src') &&
      ['', 'module', 'text/javascript', 'application/javascript'].includes(
        element.type.toLowerCase(),
      )
    )
  }
  return (
    element instanceof HTMLLinkElement &&
    (element.relList.contains('modulepreload') ||
      element.relList.contains('stylesheet') ||
      (element.relList.contains('preload') &&
        ['script', 'style', 'image', 'font'].includes(element.as)))
  )
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
        !('prefetch' in frame) ||
        frame.prefetch !== true ||
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
        if (src) frames.push(Object.freeze({ src, target }))
      } catch {
        // Malformed frame references do not prevent other prefetches.
      }
    }
  }
  return frames
}

function createAssetPrefetch(element: Element, baseUrl: string): HTMLLinkElement | undefined {
  if (element instanceof HTMLLinkElement) {
    if (
      !element.relList.contains('modulepreload') &&
      !element.relList.contains('stylesheet') &&
      !(
        element.relList.contains('preload') &&
        ['script', 'style', 'image', 'font'].includes(element.as)
      )
    ) {
      return
    }
    // Prefetch hints cannot select a responsive candidate from imagesrcset.
    if (element.as === 'image' && element.imageSrcset) return
    if (
      ['image', 'font'].includes(element.as) &&
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
  let href = element.getAttribute(element instanceof HTMLLinkElement ? 'href' : 'src')
  if (!href) return
  let url: URL
  try {
    url = new URL(href, baseUrl)
  } catch {
    return
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return

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
  link.href = url.href
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
