import type { ReloadDetails } from './reload-details.ts'
import type { FrameReloadStartEventInit } from './reload-start-event.ts'

/**
 * Noncancelable `SubmitEvent` dispatched when a form submission starts a frame reload, after the
 * frame's `reloadStart`. It shares that event's request details, `formData`, and `finished` promise.
 * The event targets the submit button and bubbles through its owning form, or targets the form
 * when there is no submitter. External or detached submitters receive a non-bubbling event before
 * a separate bubbling event on the form. Cancel submissions with the native `submit` event.
 */
export type FormSubmissionEvent = SubmitEvent & ReloadDetails

export type FormSubmissionEventInit = FrameReloadStartEventInit & {
  bubbles?: boolean
}

export function createFormSubmissionEvent(init: FormSubmissionEventInit): FormSubmissionEvent {
  return Object.assign(
    new SubmitEvent('rmx:submission', {
      bubbles: init.bubbles ?? true,
      cancelable: false,
      submitter: init.submitter ?? null,
    }),
    {
      src: init.src,
      method: init.method,
      encType: init.encType,
      formData: init.formData ?? null,
      element: init.element ?? null,
      finished: init.finished,
    },
  )
}

declare global {
  interface HTMLElementEventMap {
    'rmx:submission': FormSubmissionEvent
  }
}
