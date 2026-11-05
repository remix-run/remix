import type { Dispatched } from '../event-types.ts'
import type { FormSubmissionEvent } from '../form-submission-event.ts'
import { on } from './on-mixin.ts'

type SubmissionListener<target extends HTMLElement> = (
  event: Dispatched<FormSubmissionEvent, target>,
  signal: AbortSignal,
) => void | Promise<void>

/**
 * Follows Remix frame submissions on a submit button, form, or ancestor element.
 *
 * The handler receives a noncancelable {@link FormSubmissionEvent}. Its signal aborts when the
 * same element receives another submission or the mixin is removed, as with {@link on}.
 * Reload cancellation resolves `event.finished` with an aborted signal; failures reject it.
 * Use `on('submit', handler)` to intercept or cancel a native form submission.
 *
 * @param handler Submission handler with the host element as `event.currentTarget`.
 * @param captureBoolean Whether to listen during capture (defaults to `false`).
 * @returns A mixin descriptor for the target element.
 */
export function onSubmission<target extends HTMLElement = HTMLElement>(
  handler: SubmissionListener<target>,
  captureBoolean?: boolean,
): ReturnType<typeof on<target, 'rmx:submission'>> {
  return on<target, 'rmx:submission'>('rmx:submission', handler, captureBoolean)
}
