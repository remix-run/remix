import type { Handle } from './component.ts'

/**
 * Noncancelable event dispatched when Remix accepts a frame navigation, before `reloadStart`.
 * It bubbles from the initiating link, submitter, or form, and crosses shadow roots. Navigations
 * without a connected source notify `window` directly. Notifications for one operation share
 * `finished`, including external submitter and form copies. Redirects do not dispatch another event.
 */
export interface NavigationEvent extends Event {
  /** Source passed to `resolveFrame` for the initiating load, unchanged through redirects. */
  readonly frameSrc: string
  /** Effective HTTP method in lowercase. */
  readonly method: string
  /** Initiating link or owning form, or null for programmatic navigation and history traversal. */
  readonly element: HTMLAnchorElement | HTMLAreaElement | SVGAElement | HTMLFormElement | null
  /** Actual submit button, when the form has a submitter. */
  readonly submitter?: HTMLElement
  /** Effective form encoding, only present for POST submissions. */
  readonly encType?: string
  /** Submitted entries, only present for POST submissions. Shared with the request. */
  readonly formData?: FormData
  /**
   * Resolves after rendering, redirects, scroll, and focus handling, or with an aborted signal
   * on cancellation or replacement. Rejects on failure.
   */
  readonly finished: Promise<AbortSignal>
  /** Initial browser destination, unchanged through redirects. */
  readonly to: string
  /** Effective history behavior of the original navigation, preserved through redirects. */
  readonly navigationType: NavigationType
  /** Original history entry being left, preserved through redirects. */
  readonly from: NavigationHistoryEntry
  /** Named destination frame, or undefined for the top frame. */
  readonly frameTarget: string | undefined
}

export type NavigationState = {
  target: string | undefined
  src: string
  resetScroll?: NavigationOptions['resetScroll']
  resetFocus?: NavigationOptions['resetFocus']
  $rmx: true
}
// Frames of the most recently started run() runtime, for module-level helpers that have no
// runtime reference: targeted prefetching and updateUrl().
export let appFrames: Handle['frames'] | undefined

export function setAppFrames(frames: Handle['frames']): () => void {
  appFrames = frames
  return () => {
    if (appFrames === frames) appFrames = undefined
  }
}

/**
 * Options for client-side frame-aware navigation.
 */
export type NavigationOptions = {
  /**
   * Same-origin source override for a mounted named frame, resolved against the document base URL.
   * Invalid or cross-origin values fall back to document navigation. Top-frame navigations use
   * `href` to keep the frame source in sync with the browser URL.
   */
  src?: string
  /**
   * Mounted named frame to reload. When omitted, the top frame reloads. An unmatched name falls
   * back to document navigation.
   */
  target?: string
  /** How the destination updates browser history. */
  history?: 'push' | 'replace'
  /**
   * Scroll behavior. `true` aliases `"after-transition"` and `false` aliases `"manual"`.
   * (default: `"after-transition"`)
   */
  resetScroll?: NavigationInterceptOptions['scroll'] | boolean
  /**
   * Focus reset behavior. `true` aliases `"after-transition"` and `false` aliases `"manual"`.
   * (default: `"after-transition"`)
   */
  resetFocus?: NavigationInterceptOptions['focusReset'] | boolean
}

/**
 * Performs a Navigation API transition understood by Remix frame runtime state.
 * Invalid or cross-origin sources fall back to document navigation.
 *
 * @param href Destination URL.
 * @param options Navigation options.
 * @returns A promise that settles when the Navigation API transition finishes.
 */
export async function navigate(href: string, options?: NavigationOptions) {
  let state = {
    target: options?.target,
    src: options?.src ?? href,
    resetScroll: normalizeResetBehavior(options?.resetScroll),
    resetFocus: normalizeResetBehavior(options?.resetFocus),
    $rmx: true,
  } satisfies NavigationState
  let navigation = getInterceptableNavigation()
  if (!navigation) {
    if (options?.history === 'replace') {
      window.location.replace(href)
    } else {
      window.location.assign(href)
    }
    return
  }

  let transition = navigation.navigate(href, { state, history: options?.history })
  await transition.finished
}

export function getInterceptableNavigation(): Navigation | undefined {
  let navigation = window.navigation
  if (
    !navigation ||
    typeof NavigateEvent === 'undefined' ||
    !('sourceElement' in NavigateEvent.prototype)
  ) {
    return
  }
  return navigation
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value != null
}

export function isRuntimeNavigation(info: unknown): info is NavigationState {
  return isObject(info) && '$rmx' in info
}

export function getSameOriginUrl(src: string, baseURL = document.baseURI): URL | undefined {
  try {
    let url = new URL(src, baseURL)
    if (url.origin === window.location.origin) return url
  } catch {
    // Invalid URLs can't be same-origin.
  }
}

export function hasNoReferrer(element: Element): boolean {
  // A form control named getAttribute can shadow the method on its form.
  let rel = Element.prototype.getAttribute.call(element, 'rel')
  return (
    rel !== null &&
    rel
      .toLowerCase()
      .split(/[\t\n\f\r ]+/)
      .includes('noreferrer')
  )
}

export function normalizeResetBehavior(
  value: string | boolean | null | undefined,
): 'after-transition' | 'manual' {
  return value === false || value === 'false' || value === 'manual' ? 'manual' : 'after-transition'
}

declare global {
  interface GlobalEventHandlersEventMap {
    'rmx:navigation': NavigationEvent
  }
}
