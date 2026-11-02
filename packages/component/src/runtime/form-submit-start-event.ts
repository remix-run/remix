/**
 * Event dispatched on a submit button, or on its form when no button submitted it, when the form's
 * submission starts a frame reload. It bubbles, so the form and its ancestors receive it too.
 */
export type FormSubmitStartEvent = Event & {
  /** Submitted form entries for a non-GET submission. `null` for a GET submission, as on `NavigateEvent`. */
  readonly formData: FormData | null
  /** The form, or the submit button that submitted it, as on `NavigateEvent`. */
  readonly sourceElement: Element
  /**
   * Resolves once the reload's content has rendered, as `NavigationTransition.finished` does once
   * a navigation finishes. Rejects with the failure when the reload fails, and with an
   * `AbortError` `DOMException` when it is cancelled, a newer reload of the frame replaces it, or
   * the frame is removed.
   */
  readonly finished: Promise<void>
}

/**
 * What a `rmx:form-submit-start` event describes: the submission and its reload's outcome.
 */
export type FormSubmitStartEventInit = {
  formData?: FormData
  sourceElement: Element
  finished: Promise<void>
}

/**
 * Creates a `rmx:form-submit-start` event.
 *
 * @param init The submission and its reload's outcome.
 * @returns A bubbling `rmx:form-submit-start` event carrying the submission's details.
 */
export function createFormSubmitStartEvent(init: FormSubmitStartEventInit): FormSubmitStartEvent {
  return Object.assign(new Event('rmx:form-submit-start', { bubbles: true }), {
    formData: init.formData ?? null,
    sourceElement: init.sourceElement,
    finished: init.finished,
  })
}

declare global {
  interface HTMLElementEventMap {
    'rmx:form-submit-start': FormSubmitStartEvent
  }
}
