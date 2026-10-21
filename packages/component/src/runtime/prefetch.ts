import { pendingPrefetchLinks } from './prefetch-links.ts'
import { getInterceptableNavigation } from './navigation.ts'
import { getNamedFrame } from './run.ts'

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

type PrefetchRequest = [src: string, options?: PrefetchOptions]

const INTENT_DELAY_MS = 100

const defaultPrefetch = createDefaultPrefetch()
let prefetchFrame: PrefetchFrame = defaultPrefetch

/**
 * Prefetches frame content so a later navigation can reuse the response. By default this
 * fetches HTML and discovers external JavaScript, CSS, and explicit image and font preloads for
 * `<link rel="prefetch">` hints.
 * Responses use the browser HTTP cache; even uncacheable HTML can reveal cacheable assets. Pass
 * `prefetch` to `run()` to change this behavior. Cross-origin URLs, the current untargeted page, and
 * browsers where Remix doesn't handle navigations are skipped.
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
 * @param prefetchOverride Replaces how pages are prefetched while the listeners are active.
 */
export function startPrefetching(signal: AbortSignal, prefetchOverride?: PrefetchFrame): void {
  if (signal.aborted) return
  prefetchFrame = prefetchOverride ?? createDefaultPrefetch(signal)
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
    if (intent.prefetched || intent.anchor.getAttribute('data-rmx-prefetch') !== 'intent') return
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
    if (signal.aborted) return
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
  let url: URL
  try {
    url = new URL(href, document.baseURI)
  } catch {
    return
  }
  url.hash = ''
  if (url.origin !== window.location.origin) return

  return url.href
}

export function createDefaultPrefetch(
  signal?: AbortSignal,
): (src: string, options?: PrefetchOptions) => Promise<void> {
  let pending = new Map<string, Promise<void>>()
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

  async function discover(src: string, options?: PrefetchOptions): Promise<void> {
    try {
      let headers = new Headers({ Accept: 'text/html', 'X-Remix-Frame': 'true' })
      if (options?.target != null) headers.set('X-Remix-Target', options.target)
      let response = await fetch(src, {
        method: 'GET',
        mode: 'same-origin',
        priority: 'low',
        headers,
        signal,
      })
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
      await discoverAssets(template.content, baseUrl, activeAssets)
    } catch {
      // Speculative failures leave navigation to the default resolver.
    }
  }

  return function prefetch(src, options) {
    if (signal?.aborted) return Promise.resolve()
    let key = JSON.stringify([src, options?.target])
    let existing = pending.get(key)
    if (existing) return existing
    let ready = discover(src, options).finally(() => pending.delete(key))
    pending.set(key, ready)
    return ready
  }
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
