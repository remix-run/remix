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
  if (!getInterceptableNavigation()) return

  let url = getPrefetchUrl(href)
  if (url) prefetchFrame(url.href)
}

function getPrefetchUrl(href: string): URL | undefined {
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

  return url
}

/**
 * Starts automatic prefetching for links marked with `data-rmx-prefetch`.
 *
 * @param signal Abort signal used to remove listeners and disconnect observers.
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
  startObservedPrefetching(signal)

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
    if (intent.prefetched) return
    intent.prefetched = true
    prefetchAnchor(intent.anchor)
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

function getIntentAnchor(target: EventTarget | null): HTMLAnchorElement | null {
  if (!(target instanceof Element)) return null
  let anchor = target.closest('a[href][data-rmx-prefetch="intent"]')
  return anchor instanceof HTMLAnchorElement ? anchor : null
}

function prefetchAnchor(anchor: HTMLAnchorElement): boolean {
  // Only links that reload the top frame on click can reuse a prefetch.
  if (
    anchor.hasAttribute('download') ||
    anchor.hasAttribute('data-rmx-document') ||
    anchor.hasAttribute('data-rmx-target') ||
    (anchor.target !== '' && anchor.target !== '_self')
  ) {
    return false
  }
  let url = getPrefetchUrl(anchor.href)
  if (!url) return false
  prefetchFrame(url.href)
  return true
}

function startObservedPrefetching(signal: AbortSignal): void {
  interface LinkState {
    href: string
    mode: 'render' | 'viewport'
    prefetched: boolean
  }
  let links = new Map<HTMLAnchorElement, LinkState>()
  let viewport =
    typeof IntersectionObserver === 'function'
      ? new IntersectionObserver((entries) => {
          if (signal.aborted) return
          for (let entry of entries) {
            let anchor = entry.target
            if (!(anchor instanceof HTMLAnchorElement) || !anchor.isConnected) continue
            let state = links.get(anchor)
            if (
              entry.isIntersecting &&
              state?.mode === 'viewport' &&
              !state.prefetched &&
              anchor.href === state.href &&
              anchor.getAttribute('data-rmx-prefetch') === 'viewport'
            ) {
              state.prefetched = prefetchAnchor(anchor)
              if (state.prefetched) viewport?.unobserve(anchor)
            }
          }
        })
      : undefined

  function forget(anchor: HTMLAnchorElement) {
    viewport?.unobserve(anchor)
    links.delete(anchor)
  }

  function update(anchor: HTMLAnchorElement) {
    if (signal.aborted) return
    let mode = anchor.getAttribute('data-rmx-prefetch')
    if (
      !anchor.isConnected ||
      !anchor.hasAttribute('href') ||
      (mode !== 'render' && mode !== 'viewport')
    ) {
      forget(anchor)
      return
    }
    let state = links.get(anchor)
    if (state?.href !== anchor.href || state.mode !== mode) {
      state = { href: anchor.href, mode, prefetched: false }
      links.set(anchor, state)
    }
    viewport?.unobserve(anchor)
    if (state.prefetched) return
    if (mode === 'render') {
      state.prefetched = prefetchAnchor(anchor)
    } else {
      viewport?.observe(anchor)
    }
  }

  function visit(node: Node, callback: (anchor: HTMLAnchorElement) => void) {
    if (!(node instanceof Element)) return
    if (node instanceof HTMLAnchorElement) callback(node)
    for (let anchor of node.querySelectorAll('a')) callback(anchor)
  }

  let mutations = new MutationObserver((records) => {
    if (signal.aborted) return
    for (let record of records) {
      if (record.type === 'attributes' && record.target instanceof HTMLAnchorElement) {
        update(record.target)
      }
      for (let node of record.removedNodes) {
        if (!node.isConnected) visit(node, forget)
      }
      for (let node of record.addedNodes) {
        if (node.isConnected) visit(node, update)
      }
    }
  })
  mutations.observe(document, {
    subtree: true,
    childList: true,
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
  signal.addEventListener(
    'abort',
    () => {
      mutations.disconnect()
      viewport?.disconnect()
      links.clear()
    },
    { once: true },
  )
  visit(document.documentElement, update)
}
