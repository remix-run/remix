/**
 * Noncancelable event dispatched when Remix accepts a frame navigation, before `reloadStart`.
 * It bubbles from the initiating link, submitter, or form, and crosses shadow roots. Navigations
 * without a connected source and redirect updates notify `window` directly. Notifications for
 * one operation share `signal` and `finished`, including external submitter and form copies.
 */
export interface NavigationEvent extends Event {
  /** Originally requested frame source, including GET submission values in the query. */
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
  /** Browser destination for this notification. Redirects emit another event with the updated URL. */
  readonly to: string
  /** Effective history behavior of the original navigation, preserved through redirects. */
  readonly navigationType: NavigationType
  /** Original history entry being left, preserved through redirects. */
  readonly from: NavigationHistoryEntry
  /** Named destination frame, or undefined for the top frame. */
  readonly frameTarget: string | undefined
  /** Aborts if this operation is cancelled, superseded, or fails; stays active after success. */
  readonly signal: AbortSignal
}

export type NavigationEventInit = Omit<NavigationEvent, keyof Event>

export function dispatchNavigationEvent(init: NavigationEventInit, fromSource = true): void {
  function dispatch(target: EventTarget, bubbles = true) {
    EventTarget.prototype.dispatchEvent.call(
      target,
      Object.assign(new Event('rmx:navigation', { bubbles, composed: true }), init),
    )
  }

  let element = fromSource ? init.element : null
  let target = element ? (init.submitter ?? element) : null
  if (!target || Node.prototype.getRootNode.call(target, { composed: true }) !== document) {
    dispatch(window)
  }
  if (!element || !target || init.signal.aborted) return

  // Form controls can shadow methods on their owning form.
  let bubbles = Node.prototype.contains.call(element, target)
  dispatch(target, bubbles)
  // External or detached submitters have no event path through their owning form.
  if (!bubbles && !init.signal.aborted) dispatch(element)
}

declare global {
  interface GlobalEventHandlersEventMap {
    'rmx:navigation': NavigationEvent
  }
}
