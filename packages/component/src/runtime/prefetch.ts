import { getNamedFrame, pendingPrefetchLinks } from './frame.ts'
import { getInterceptableNavigation, getSameOriginUrl } from './navigation.ts'

import { createPrefetchQueue } from './prefetch-queue.ts'
import type { PrefetchOwner } from './prefetch-queue.ts'
import { createPrefetchAssetQueue, createAssetPrefetch, assetKey } from './prefetch-assets.ts'

/** Options for prefetching frame content. */
export interface PrefetchOptions {
  /** Destination frame name, sent as `X-Remix-Target`. */
  target?: string
  /** Cancels this caller's work, including nested frames, while retaining other owners. */
  signal?: AbortSignal
}

/** Starts speculative frame loading using an absolute source URL without a hash. */
export type PrefetchFrame = (src: string, options?: PrefetchOptions) => void

/** How a pending HTML request was discovered. */
export type PrefetchTrigger = 'viewport' | 'intent' | 'imperative' | 'frame'

/** A shared pending HTML request offered to the links selector. */
export interface PrefetchLink {
  /** Absolute source URL without a hash. */
  readonly src: string
  /** Destination frame name, or `undefined` for an unnamed frame. */
  readonly target: string | undefined
  /** Discovery trigger; nested frames inherit their owners' default ordering. */
  readonly trigger: PrefetchTrigger
  /** Live anchors owning the request; imperative calls have no anchor of their own. */
  readonly anchors: readonly HTMLAnchorElement[]
}

/** The detached response being inspected by the asset selector. */
export interface PrefetchAssetContext {
  /** Requested absolute source URL. */
  src: string
  /** Destination frame name, or `undefined` for an unnamed frame. */
  target: string | undefined
  /** Final response URL resolved with the response's `<base href>`, when present. */
  baseURL: string
  /** Inert response fragment, including nested templates; inspect without mutating nodes. */
  fragment: DocumentFragment
}

/** Scheduling and concurrency for pending HTML requests. */
export interface PrefetchLinksConfig {
  /** Maximum HTML fetches through body consumption and parsing (default: 3). */
  concurrency?: number
  /**
   * Selects original pending candidates in start order; omitted candidates are dropped for this
   * attempt. Order is cached until discovery, ownership changes, or policy invalidation.
   */
  scheduler?(batch: readonly PrefetchLink[]): readonly PrefetchLink[]
}

/** Scheduling and global concurrency for assets from each parsed response. */
export interface PrefetchAssetsConfig {
  /** Maximum native asset hints awaiting load, error, or cancellation (default: 2). */
  concurrency?: number
  /**
   * Selects original supported elements from this fragment or its templates in submission order.
   * Called synchronously once per parsed response. Ordinary images require explicit selection.
   * Omitted, duplicate, unsupported, and foreign elements are ignored. Source nodes remain inert.
   */
  scheduler?(batch: readonly Element[], context: PrefetchAssetContext): readonly Element[]
}

/**
 * Selection and concurrency for Remix's built-in prefetch strategy.
 * Invalid concurrency limits throw `RangeError` during `run()`.
 */
export interface PrefetchConfig {
  /** Pending HTML selection and a global positive safe integer concurrency limit. */
  links?: PrefetchLinksConfig
  /** Per-response asset selection and a global positive safe integer concurrency limit. */
  assets?: PrefetchAssetsConfig
}

type PrefetchRequest = [src: string, options?: PrefetchOptions]

const INTENT_DELAY_MS = 100

const defaultPrefetch = createDefaultPrefetch()
let prefetchFrame: PrefetchFrame = defaultPrefetch

/**
 * Prefetches frame content so a later navigation can reuse the response. By default this
 * fetches HTML and discovers external JavaScript, CSS, and explicit image and font preloads for
 * native hints. Responsive declarations and selected images use `<link rel="preload" as="image">`.
 * Responses use the browser HTTP cache; even uncacheable HTML can reveal cacheable assets. Set
 * `prefetch={true}` on nested `<Frame>` components to also fetch their HTML and discover their assets.
 * Configure `run({ prefetch: { links, assets } })` to select work, or pass a function
 * to replace the complete strategy. Cross-origin URLs, the current
 * untargeted page, and browsers where Remix doesn't handle navigations are skipped.
 *
 * @param href URL to prefetch, resolved against the document base URL.
 * @param options Destination frame and optional cancellation signal.
 */
export function prefetch(href: string, options?: PrefetchOptions): void {
  let request = getPrefetchRequest(href, options)
  if (request) prefetchFrame(...request)
}

/**
 * Prefetches marked links on mouse/keyboard intent or when they enter the viewport.
 *
 * @param signal Abort signal used to remove the listeners.
 * @param config Queue policy or a replacement strategy while the listeners are active.
 * @returns Invalidates cached pending HTML selection.
 */
export function startPrefetching(
  signal: AbortSignal,
  config?: PrefetchFrame | PrefetchConfig,
): () => void {
  if (signal.aborted) return () => {}
  let strategy = typeof config === 'function' ? undefined : createDefaultPrefetch(signal, config)
  prefetchFrame = typeof config === 'function' ? config : (strategy ?? defaultPrefetch)
  let invalidate = () => strategy?.invalidate()
  function dispatch(
    request: PrefetchRequest,
    anchor: HTMLAnchorElement,
    trigger: 'intent' | 'viewport',
  ) {
    if (strategy) void strategy.enqueue(request[0], request[1], anchor, trigger)
    else prefetchFrame(...request)
  }
  signal.addEventListener(
    'abort',
    () => {
      prefetchFrame = defaultPrefetch
    },
    { once: true },
  )
  let navigation = getInterceptableNavigation()
  if (!navigation) return invalidate

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
    if (request && hasPrefetchTarget(request)) dispatch(request, intent.anchor, 'intent')
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
  startViewportPrefetching(signal, dispatch, invalidate)
  if (strategy) {
    window.addEventListener('scroll', invalidate, { capture: true, passive: true, signal })
    window.addEventListener('resize', invalidate, { passive: true, signal })
    let current: NavigateEvent | undefined
    navigation.addEventListener(
      'navigate',
      (event) => {
        current = event
        strategy.pause()
        event.signal.addEventListener(
          'abort',
          () => {
            queueMicrotask(() => {
              if (current === event) strategy.resume()
            })
          },
          { once: true },
        )
      },
      { signal },
    )
    navigation.addEventListener('navigatesuccess', () => strategy.resume(), { signal })
    navigation.addEventListener('navigateerror', () => strategy.resume(), { signal })
  }
  return invalidate
}

function startViewportPrefetching(
  signal: AbortSignal,
  dispatch: (request: PrefetchRequest, anchor: HTMLAnchorElement, trigger: 'viewport') => void,
  invalidate: () => void,
): void {
  let completed = new WeakMap<HTMLAnchorElement, string>()

  function getRequest(anchor: HTMLAnchorElement): PrefetchRequest | undefined {
    if (anchor.getAttribute('data-rmx-prefetch') !== 'viewport') return
    return getAnchorPrefetchRequest(anchor)
  }

  let viewport =
    typeof IntersectionObserver === 'undefined'
      ? undefined
      : new IntersectionObserver((entries) => {
          if (signal.aborted || !canPrefetchAutomatically()) return
          for (let { target, isIntersecting } of entries) {
            if (!isIntersecting || !(target instanceof HTMLAnchorElement)) continue
            let request = getRequest(target)
            if (!request || !hasPrefetchTarget(request)) continue
            let key = JSON.stringify(request)
            if (completed.get(target) === key) continue
            completed.set(target, key)
            viewport?.unobserve(target)
            dispatch(request, target, 'viewport')
          }
        })

  function update(anchor: HTMLAnchorElement): void {
    viewport?.unobserve(anchor)
    if (!anchor.isConnected) {
      completed.delete(anchor)
      return
    }
    // Named frames can still be hydrating here; check their registration when the link enters view.
    let request = getRequest(anchor)
    if (request && completed.get(anchor) !== JSON.stringify(request)) viewport?.observe(anchor)
  }

  function scan(node: Node): void {
    if (!(node instanceof Element)) return
    if (node instanceof HTMLAnchorElement) update(node)
    for (let anchor of node.querySelectorAll('a')) update(anchor)
  }

  let mutations = new MutationObserver((records) => {
    if (signal.aborted) return
    let changed = false
    for (let record of records) {
      if (record.type === 'attributes' && record.target instanceof HTMLAnchorElement) {
        update(record.target)
      }
      if (record.type !== 'childList') changed = true
      for (let node of [...record.removedNodes, ...record.addedNodes]) {
        if (node instanceof HTMLLinkElement && pendingPrefetchLinks.has(node)) continue
        if (
          node instanceof HTMLLinkElement &&
          !node.isConnected &&
          ['prefetch', 'preload'].includes(node.rel)
        )
          continue
        changed = true
        scan(node)
      }
    }
    if (changed) invalidate()
  })
  mutations.observe(document, {
    childList: true,
    characterData: true,
    subtree: true,
    attributes: true,
    attributeFilter: [
      'href',
      'src',
      'data-rmx-prefetch',
      'download',
      'data-rmx-document',
      'data-rmx-target',
      'data-rmx-src',
      'target',
      'class',
      'style',
      'hidden',
    ],
  })
  scan(document.documentElement)

  signal.addEventListener(
    'abort',
    () => {
      mutations.disconnect()
      viewport?.disconnect()
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
  if (options?.signal?.aborted) return
  if (options?.target)
    return [
      src,
      options.signal
        ? { target: options.target, signal: options.signal }
        : { target: options.target },
    ]
  let currentUrl = new URL(window.location.href)
  currentUrl.hash = ''
  if (src !== currentUrl.href) return options?.signal ? [src, { signal: options.signal }] : [src]
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
): Promise<Response> {
  let headers = new Headers({ Accept: 'text/html', 'X-Remix-Frame': 'true' })
  if (target != null) headers.set('X-Remix-Target', target)
  if (contentType) headers.set('Content-Type', contentType)
  return fetch(src, { ...init, headers, mode: 'same-origin' })
}

export function createDefaultPrefetch(signal?: AbortSignal, config: PrefetchConfig = {}) {
  let assets = createPrefetchAssetQueue(signal, config.assets?.concurrency ?? 2)

  function discoverAssets(
    source: DocumentFragment,
    baseURL: string,
    src: string,
    target: string | undefined,
    jobSignal: AbortSignal,
  ): Promise<void> {
    let elements = getResponseElements(source)
    let activeAssets = new Set<string>()
    for (let element of document.querySelectorAll('link[href], script[src]')) {
      if (element instanceof HTMLLinkElement && pendingPrefetchLinks.has(element)) continue
      let link = createAssetPrefetch(element, element.baseURI)
      if (link) activeAssets.add(assetKey(link))
    }
    let batch = elements.filter(
      (element) =>
        !(element instanceof HTMLImageElement) &&
        createAssetPrefetch(element, baseURL) !== undefined,
    )
    let selected: readonly Element[]
    try {
      selected = config.assets?.scheduler
        ? config.assets.scheduler(Object.freeze(batch), { fragment: source, src, target, baseURL })
        : batch
      if (!Array.isArray(selected)) return Promise.resolve()
      selected = Array.from(selected)
    } catch {
      return Promise.resolve()
    }
    let allowed = new Set(elements)
    let seen = new Set<Element>()
    let links: HTMLLinkElement[] = []
    for (let element of selected) {
      if (!allowed.has(element) || seen.has(element)) continue
      seen.add(element)
      let link = createAssetPrefetch(element, baseURL)
      if (link && !activeAssets.has(assetKey(link))) links.push(link)
    }
    return assets.submit(links, jobSignal)
  }

  function getFrames(source: DocumentFragment, baseUrl: string): PrefetchRequest[] {
    let requests: PrefetchRequest[] = []
    for (let element of getResponseElements(source)) {
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
      let frames: unknown[] = Object.values(data.f)
      for (let frame of frames) {
        if (typeof frame !== 'object' || frame === null || !('prefetch' in frame)) continue
        if (frame.prefetch !== true || !('src' in frame)) continue
        if (typeof frame.src !== 'string' || !frame.src) continue
        let target = 'name' in frame ? frame.name : undefined
        if (target !== undefined && typeof target !== 'string') continue
        let url: URL
        try {
          url = new URL(frame.src, baseUrl)
        } catch {
          continue
        }
        if (url.origin !== window.location.origin) continue
        if (url.protocol !== 'http:' && url.protocol !== 'https:') continue
        url.hash = ''
        requests.push([url.href, target === undefined ? undefined : { target }])
      }
    }
    return requests
  }

  async function discover(
    src: string,
    options: PrefetchOptions | undefined,
    jobSignal: AbortSignal,
  ) {
    try {
      let response = await fetchFrame(src, options?.target, {
        method: 'GET',
        priority: 'low',
        signal: jobSignal,
      })
      if (
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
      let responseUrl = response.url || src
      let baseUrl = responseUrl
      let base = template.content.querySelector('base[href]')?.getAttribute('href')
      if (base != null) {
        try {
          baseUrl = new URL(base, responseUrl).href
        } catch {
          // An invalid base falls back to the response URL, as it would in a document.
        }
      }
      let frames = getFrames(template.content, baseUrl)
      return {
        frames,
        assets: discoverAssets(template.content, baseUrl, src, options?.target, jobSignal),
      }
    } catch {
      // Speculative failures leave navigation to the default resolver.
    }
  }

  let queue = createPrefetchQueue(signal, config, discover)

  async function traverse(
    src: string,
    options: PrefetchOptions | undefined,
    visited: Set<string>,
    owner: PrefetchOwner,
    priority?: number,
  ): Promise<void> {
    if (signal?.aborted || !owner.valid()) return
    let key = JSON.stringify([src, options?.target])
    if (visited.has(key)) return
    visited.add(key)
    // Only share response discovery: recursive traversal promises can await one another in cycles.
    let entry = queue.read(src, options, owner, priority)
    if (!entry) return
    try {
      let content = await entry.ready
      if (!content || !owner.valid()) return
      await Promise.all([
        content.assets,
        Promise.all(
          content.frames.map(([src, options]) =>
            traverse(src, options, visited, owner, entry.priority),
          ),
        ),
      ])
    } finally {
      queue.release(entry, owner)
    }
  }

  async function enqueue(
    src: string,
    options?: PrefetchOptions,
    anchor?: HTMLAnchorElement,
    trigger: 'intent' | 'viewport' | 'imperative' = 'imperative',
  ): Promise<void> {
    let owner: PrefetchOwner = {
      anchor,
      trigger,
      valid() {
        if (signal?.aborted || options?.signal?.aborted) return false
        if (!anchor) return true
        if (!canPrefetchAutomatically() || anchor.getAttribute('data-rmx-prefetch') !== trigger)
          return false
        let request = getAnchorPrefetchRequest(anchor)
        return (
          request !== undefined &&
          hasPrefetchTarget(request) &&
          request[0] === src &&
          request[1]?.target === options?.target
        )
      },
    }
    let prune = () => queue.prune()
    options?.signal?.addEventListener('abort', prune, { once: true })
    try {
      await traverse(src, options, new Set(), owner)
    } finally {
      options?.signal?.removeEventListener('abort', prune)
    }
  }

  return Object.assign((src: string, options?: PrefetchOptions) => enqueue(src, options), {
    enqueue,
    invalidate: () => queue.invalidate(),
    pause() {
      queue.pause()
      assets.pause()
    },
    resume() {
      queue.resume()
      assets.resume()
    },
  })
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
