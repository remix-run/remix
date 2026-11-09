import { getNamedFrame, pendingPrefetchLinks } from './frame.ts'
import { getInterceptableNavigation, getSameOriginUrl } from './navigation.ts'

/** Options for prefetching frame content. */
export interface PrefetchOptions {
  /** Name of the destination frame, sent as `X-Remix-Target` by the default strategy. */
  target?: string
}

/**
 * Starts loading same-origin frame content so a later navigation can reuse the response.
 *
 * @param src Absolute URL of the page to prefetch, without a hash.
 * @param options Destination frame for the request.
 */
export type PrefetchFrame = (src: string, options?: PrefetchOptions) => void

/**
 * Loads a page for the default prefetch strategy. Remix still shares pending loads, discovers
 * assets, adds hints, and follows `<Frame prefetch>` frames; this decides when and how each request is made.
 *
 * @param src Absolute URL of the page to load, without a hash.
 * @param options Destination frame and the runtime's abort signal, which aborts when it is disposed.
 * @returns The page's response. Responses that aren't OK HTML are skipped.
 */
export type PrefetchFetch = (
  src: string,
  options: { target?: string; signal?: AbortSignal },
) => Promise<Response>

type PrefetchRequest = [src: string, options?: PrefetchOptions]

const INTENT_DELAY_MS = 100

const defaultPrefetch = createDefaultPrefetch()
let prefetchFrame: PrefetchFrame = defaultPrefetch

/**
 * Prefetches frame content so a later navigation can reuse the response. By default this
 * fetches HTML and discovers external JavaScript, CSS, and explicit image and font preloads for
 * `<link rel="prefetch">` hints.
 * Responses use the browser HTTP cache; even uncacheable HTML can reveal cacheable assets. Set
 * `prefetch={true}` on nested `<Frame>` components to also fetch their HTML and discover their assets.
 * Pass `{ prefetch: { fetch } }` to `run()` to control how each page loads, or a `prefetch` handler
 * to replace the strategy. Cross-origin URLs, the current untargeted page, and browsers where Remix
 * doesn't handle navigations are skipped.
 *
 * @param href URL to prefetch, resolved against the document base URL.
 * @param options Destination frame for the request.
 */
export function prefetch(href: string, options?: PrefetchOptions): void {
  let request = getPrefetchRequest(href, options)
  if (request) prefetchFrame(...request)
}

/**
 * Prefetches marked links on mouse/keyboard intent or when they enter the viewport.
 *
 * @param signal Abort signal used to remove the listeners.
 * @param prefetch Replaces how pages are prefetched while the listeners are active, or `{ fetch }`
 * to load each page for the default strategy.
 */
export function startPrefetching(
  signal: AbortSignal,
  prefetch?: PrefetchFrame | { fetch: PrefetchFetch },
): void {
  if (signal.aborted) return
  prefetchFrame =
    typeof prefetch === 'function' ? prefetch : createDefaultPrefetch(signal, prefetch?.fetch)
  signal.addEventListener(
    'abort',
    () => {
      prefetchFrame = defaultPrefetch
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
    if (request && hasPrefetchTarget(request)) prefetchFrame(...request)
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
      prefetchFrame(...request)
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
  if (options?.target) return [src, { target: options.target }]
  let currentUrl = new URL(window.location.href)
  currentUrl.hash = ''
  if (src !== currentUrl.href) return [src]
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
  let headers = new Headers(init.headers)
  headers.set('Accept', 'text/html')
  headers.set('X-Remix-Frame', 'true')
  if (target != null) headers.set('X-Remix-Target', target)
  if (contentType) headers.set('Content-Type', contentType)
  return fetch(src, { ...init, headers, mode: 'same-origin' })
}

export function createDefaultPrefetch(
  signal?: AbortSignal,
  fetchPage: PrefetchFetch = (src, { target, signal }) =>
    fetchFrame(src, target, {
      method: 'GET',
      // Not `Sec-Purpose`, which `fetch()` forbids; servers can use this to shed prefetches.
      headers: { Purpose: 'prefetch' },
      priority: 'low',
      signal,
    }),
): (src: string, options?: PrefetchOptions) => Promise<void> {
  let pending = new Map<
    string,
    Promise<{ source: DocumentFragment; baseUrl: string; assets: Promise<void[]> } | undefined>
  >()
  let assets = new Map<string, Promise<void>>()

  function prefetchAsset(link: HTMLLinkElement, activeAssets: Set<string>): Promise<void> {
    let key = assetKey(link)
    let existing = assets.get(key)
    if (existing) return existing
    if (activeAssets.has(key) || !link.relList.supports('prefetch')) return Promise.resolve()

    let ready = new Promise<void>((resolve) => {
      function finish() {
        link.remove()
        pendingPrefetchLinks.delete(link)
        assets.delete(key)
        signal?.removeEventListener('abort', finish)
        resolve()
      }
      link.addEventListener('load', finish, { once: true })
      link.addEventListener('error', finish, { once: true })
      signal?.addEventListener('abort', finish, { once: true })
      pendingPrefetchLinks.add(link)
      document.head.append(link)
    })
    assets.set(key, ready)
    return ready
  }

  function discoverAssets(
    source: DocumentFragment,
    baseUrl: string,
    activeAssets: Set<string>,
  ): Promise<void[]> {
    let requests: Promise<void>[] = []
    for (let element of source.querySelectorAll('link[href], script[src], template')) {
      if (element instanceof HTMLTemplateElement) {
        requests.push(discoverAssets(element.content, baseUrl, activeAssets).then(() => {}))
      } else {
        let link = createAssetPrefetch(element, baseUrl)
        if (link) requests.push(prefetchAsset(link, activeAssets))
      }
    }
    return Promise.all(requests)
  }

  function discoverFrames(
    source: DocumentFragment,
    baseUrl: string,
    visited: Set<string>,
  ): Promise<void[]> {
    let requests: Promise<void>[] = []
    for (let element of source.querySelectorAll(
      'script#rmx-data[type="application/json"], template',
    )) {
      if (element instanceof HTMLTemplateElement) {
        requests.push(discoverFrames(element.content, baseUrl, visited).then(() => {}))
        continue
      }
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
        requests.push(prefetch(url.href, target === undefined ? undefined : { target }, visited))
      }
    }
    return Promise.all(requests)
  }

  async function discover(src: string, options?: PrefetchOptions) {
    try {
      let response = await fetchPage(src, { target: options?.target, signal })
      if (
        !response.ok ||
        !response.headers.get('Content-Type')?.toLowerCase().includes('text/html')
      ) {
        await response.body?.cancel()
        return
      }
      let html = await response.text()
      if (signal?.aborted) return
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
      let activeAssets = new Set<string>()
      for (let element of document.querySelectorAll('link[href], script[src]')) {
        let link = createAssetPrefetch(element, element.baseURI)
        if (link) activeAssets.add(assetKey(link))
      }
      return {
        source: template.content,
        baseUrl,
        assets: discoverAssets(template.content, baseUrl, activeAssets),
      }
    } catch {
      // Speculative failures leave navigation to the default resolver.
    }
  }

  async function prefetch(
    src: string,
    options: PrefetchOptions | undefined,
    visited: Set<string>,
  ): Promise<void> {
    if (signal?.aborted) return
    let key = JSON.stringify([src, options?.target])
    if (visited.has(key)) return
    visited.add(key)
    let ready = pending.get(key)
    if (!ready) {
      // Share HTML and asset discovery, not recursive traversal promises, which can await each other.
      ready = discover(src, options)
      pending.set(key, ready)
    }
    try {
      let content = await ready
      if (!content || signal?.aborted) return
      await Promise.all([content.assets, discoverFrames(content.source, content.baseUrl, visited)])
    } finally {
      if (pending.get(key) === ready) pending.delete(key)
    }
  }

  return (src, options) => prefetch(src, options, new Set())
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
  } else {
    return
  }
  let href = element.getAttribute(element instanceof HTMLScriptElement ? 'src' : 'href')
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
      : element.relList.contains('modulepreload')
  let link = document.createElement('link')
  // Ordinary prefetches don't evaluate modules or resolve their imports in the current import map.
  link.rel = 'prefetch'
  link.fetchPriority = 'low'
  link.as = 'script'
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
