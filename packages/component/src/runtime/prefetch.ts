import { getInterceptableNavigation } from './navigation.ts'

/**
 * Starts loading a same-origin page so a later top-frame navigation to it can reuse the response.
 *
 * @param src Absolute URL of the page to prefetch, without a hash.
 */
export type PrefetchFrame = (src: string) => void

const INTENT_DELAY_MS = 100

let prefetchFrame: PrefetchFrame = prefetchWithLink
const pendingLinks = new Set<string>()

/**
 * Prefetches a page so a later top-frame navigation to it can reuse the response. By default this
 * adds a `<link rel="prefetch">`, which only helps when the response is HTTP-cacheable. Pass
 * `prefetch` to `run()` to change how pages are prefetched. Cross-origin URLs, the current page, and
 * browsers where Remix doesn't handle navigations are skipped.
 *
 * @param href URL to prefetch, resolved against the document base URL.
 */
export function prefetch(href: string): void {
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

  prefetchFrame(url.href)
}

/**
 * Prefetches links marked `data-rmx-prefetch="intent"` when the visitor rests on one with the
 * mouse or keyboard focus, or presses it.
 *
 * @param signal Abort signal used to remove the listeners.
 * @param prefetchOverride Replaces how pages are prefetched while the listeners are active.
 */
export function startPrefetching(signal: AbortSignal, prefetchOverride?: PrefetchFrame): void {
  prefetchFrame = prefetchOverride ?? prefetchWithLink
  signal.addEventListener(
    'abort',
    () => {
      prefetchFrame = prefetchWithLink
    },
    { once: true },
  )
  if (!getInterceptableNavigation()) return

  let resting: { anchor: HTMLAnchorElement; timer: ReturnType<typeof setTimeout> } | undefined
  function stopResting() {
    clearTimeout(resting?.timer)
    resting = undefined
  }
  function rest(anchor: HTMLAnchorElement) {
    if (resting?.anchor === anchor) return
    stopResting()
    let timer = setTimeout(() => {
      resting = undefined
      prefetchAnchor(anchor)
    }, INTENT_DELAY_MS)
    resting = { anchor, timer }
  }
  function leave(event: PointerEvent | FocusEvent) {
    let next = event.relatedTarget
    if (!(next instanceof Node && resting?.anchor.contains(next))) stopResting()
  }

  document.addEventListener(
    'pointerover',
    (event) => {
      let anchor = getIntentAnchor(event.target)
      if (anchor && event.pointerType === 'mouse') rest(anchor)
    },
    { signal },
  )
  document.addEventListener(
    'focusin',
    (event) => {
      let anchor = getIntentAnchor(event.target)
      if (anchor) rest(anchor)
    },
    { signal },
  )
  document.addEventListener('pointerout', leave, { signal })
  document.addEventListener('focusout', leave, { signal })
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
      stopResting()
      prefetchAnchor(anchor)
    },
    { passive: true, signal },
  )
  signal.addEventListener('abort', stopResting, { once: true })
}

function getIntentAnchor(target: EventTarget | null): HTMLAnchorElement | null {
  if (!(target instanceof Element)) return null
  let anchor = target.closest('a[href][data-rmx-prefetch="intent"]')
  return anchor instanceof HTMLAnchorElement ? anchor : null
}

function prefetchAnchor(anchor: HTMLAnchorElement): void {
  // Only links that reload the top frame on click can reuse a prefetch.
  if (
    anchor.hasAttribute('download') ||
    anchor.hasAttribute('data-rmx-document') ||
    anchor.hasAttribute('data-rmx-target') ||
    (anchor.target !== '' && anchor.target !== '_self')
  ) {
    return
  }
  prefetch(anchor.href)
}

function prefetchWithLink(src: string): void {
  if (pendingLinks.has(src)) return
  pendingLinks.add(src)

  let link = document.createElement('link')
  link.rel = 'prefetch'
  link.href = src
  // Once loaded, the response lives in the HTTP cache, so the element is no longer needed.
  function remove() {
    pendingLinks.delete(src)
    link.remove()
  }
  link.addEventListener('load', remove, { once: true })
  link.addEventListener('error', remove, { once: true })
  document.head.append(link)
}
