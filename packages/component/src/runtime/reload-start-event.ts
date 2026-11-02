/**
 * Event dispatched when a direct or ancestor-driven reload of a frame starts.
 */
export type FrameReloadStartEvent = Event & {
  /**
   * Submitted form entries, for a non-GET form submission or a POST reload with a body. `null`
   * otherwise, as on `NavigateEvent`.
   */
  readonly formData: FormData | null
  /**
   * The link, form or submit button whose navigation started this reload, as on `NavigateEvent`.
   * `null` for a reload that no element's navigation started, such as `frame.reload()`.
   */
  readonly sourceElement: Element | null
  /**
   * Resolves once this reload's content has rendered, as `NavigationTransition.finished` does once
   * a navigation finishes. Rejects with the failure when the reload fails, and with an
   * `AbortError` `DOMException` when it is cancelled, a newer reload of the frame replaces it, or
   * the frame is removed. A newer reload doesn't dispatch `reloadComplete` for the one it replaces, so
   * this is how a listener learns how its own reload ended.
   */
  readonly finished: Promise<void>
}

/**
 * What a `reloadStart` event describes: the navigation that started the reload, if any, and the
 * reload's outcome.
 */
export type FrameReloadStartEventInit = {
  formData?: FormData
  sourceElement?: Element
  finished: Promise<void>
}

/**
 * Creates a `reloadStart` event.
 *
 * @param init The reload's submission and outcome.
 * @returns A `reloadStart` event carrying the reload's details.
 */
export function createFrameReloadStartEvent(
  init: FrameReloadStartEventInit,
): FrameReloadStartEvent {
  return Object.assign(new Event('reloadStart'), {
    formData: init.formData ?? null,
    sourceElement: init.sourceElement ?? null,
    finished: init.finished,
  })
}
