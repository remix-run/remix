import { createDefaultPrefetch } from './default-prefetch.ts'
import { getInterceptableNavigation } from './navigation.ts'

/**
 * Starts loading a same-origin page so a later top-frame navigation to it can reuse the response.
 *
 * @param src Absolute URL of the page to prefetch, without a hash.
 */
export type PrefetchFrame = (src: string) => void

const INTENT_DELAY_MS = 100

const defaultPrefetch = createDefaultPrefetch()
let prefetchFrame: PrefetchFrame = defaultPrefetch

/**
 * Prefetches a page so a later top-frame navigation to it can reuse the response. By default this
 * fetches HTML and discovers external JavaScript, CSS, and explicit image and font preloads for
 * `<link rel="prefetch">` hints.
 * Responses use the browser HTTP cache; even uncacheable HTML can reveal cacheable assets. Pass
 * `prefetch` to `run()` to change this behavior. Cross-origin URLs, the current page, and
 * browsers where Remix doesn't handle navigations are skipped.
 *
 * @param href URL to prefetch, resolved against the document base URL.
 */
export function prefetch(href: string): void {
  let src = getPrefetchHref(href)
  if (src) prefetchFrame(src)
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
    let src = getAnchorPrefetchHref(intent.anchor)
    if (src) prefetchFrame(src)
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

  function getHref(anchor: HTMLAnchorElement): string | undefined {
    if (anchor.getAttribute('data-rmx-prefetch') !== 'viewport') return
    return getAnchorPrefetchHref(anchor)
  }

  let viewport = new IntersectionObserver((entries) => {
    if (signal.aborted) return
    for (let { target, isIntersecting } of entries) {
      if (!isIntersecting || !(target instanceof HTMLAnchorElement)) continue
      let href = getHref(target)
      if (!href || completed.get(target) === href) continue
      completed.set(target, href)
      viewport.unobserve(target)
      prefetchFrame(href)
    }
  })

  function update(anchor: HTMLAnchorElement): void {
    viewport.unobserve(anchor)
    if (!anchor.isConnected) {
      completed.delete(anchor)
      return
    }
    let href = getHref(anchor)
    if (href && completed.get(anchor) !== href) viewport.observe(anchor)
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

function getAnchorPrefetchHref(anchor: HTMLAnchorElement): string | undefined {
  // Only links that reload the top frame on click can reuse a prefetch.
  if (
    !anchor.isConnected ||
    !anchor.hasAttribute('href') ||
    anchor.hasAttribute('download') ||
    anchor.hasAttribute('data-rmx-document') ||
    anchor.hasAttribute('data-rmx-target') ||
    (anchor.target !== '' && anchor.target !== '_self')
  ) {
    return
  }
  return getPrefetchHref(anchor.href)
}

function getPrefetchHref(href: string): string | undefined {
  if (!getInterceptableNavigation()) return

  let url: URL
  try {
    url = new URL(href, document.baseURI)
  } catch {
    return
  }
  url.hash = ''
  let currentUrl = new URL(window.location.href)
  currentUrl.hash = ''
  if (url.origin !== currentUrl.origin || url.href === currentUrl.href) return

  return url.href
}
