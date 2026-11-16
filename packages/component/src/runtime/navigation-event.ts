import type { FrameReloadStartEventInit } from './component.ts'

/**
 * Noncancelable event dispatched when a link or form starts a frame navigation, after
 * `reloadStart`. It bubbles from the link, submitter, or form. External or detached submitters
 * receive a non-bubbling event before a separate bubbling event on the owning form.
 */
export interface NavigationEvent extends Event {
  /** Requested frame source, including GET submission values in the query. */
  readonly frameSrc: string
  /** Effective HTTP method in lowercase. */
  readonly method: string
  /** Initiating HTML or SVG link, image-map area, or owning form. */
  readonly element: HTMLAnchorElement | HTMLAreaElement | SVGAElement | HTMLFormElement
  /** Actual submit button, when the form has a submitter. */
  readonly submitter?: HTMLElement
  /** Effective form encoding, only present for POST submissions. */
  readonly encType?: string
  /** Submitted entries, only present for POST submissions. Shared with the request. */
  readonly formData?: FormData
  /**
   * Resolves with the reload's signal after rendering, or an aborted signal on cancellation,
   * replacement, or frame removal. Rejects on failure. Shares the target frame's reloadStart promise.
   */
  readonly finished: Promise<AbortSignal>
}

export function createNavigationEvent(
  init: FrameReloadStartEventInit & { element: NavigationEvent['element']; bubbles?: boolean },
): NavigationEvent {
  return Object.assign(new Event('rmx:navigation', { bubbles: init.bubbles ?? true }), {
    frameSrc: init.src,
    method: init.method,
    element: init.element,
    ...(init.submitter ? { submitter: init.submitter } : {}),
    ...(init.method === 'post'
      ? { encType: init.encType ?? undefined, formData: init.formData }
      : {}),
    finished: init.finished,
  })
}

declare global {
  interface GlobalEventHandlersEventMap {
    'rmx:navigation': NavigationEvent
  }
}
