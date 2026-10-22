type SourceElementNavigateEvent = NavigateEvent & {
  sourceElement?: Element | null
}

type FormNavigateEvent = SourceElementNavigateEvent & {
  formData?: FormData | null
}

type SubmitterElement = HTMLButtonElement | HTMLInputElement

type PendingFormSubmission = {
  form: HTMLFormElement
  submitter: SubmitterElement | null
  formData?: FormData
  timeout: ReturnType<typeof setTimeout>
  removeFormDataListener(): void
}

/** Browser-provided data for an intercepted form submission. */
export interface FormSubmission {
  /** Submitted form entries for non-GET submissions, when available. */
  formData: FormData | undefined
  /** Effective form method, including submitter overrides. */
  method: string
  /** Effective form encoding type, including submitter overrides. */
  encType: string
}

/** Metadata and deferred submission data for an intercepted form navigation. */
export interface FormNavigation {
  /** Checks the submitter before the form for a submission attribute. */
  hasAttribute(name: string): boolean
  /** Reads a submission attribute, preferring the submitter-specific name when provided. */
  getAttribute(name: string, submitterName?: string): string | null
  /** Resolves browser-generated data for a non-GET submission. */
  getSubmission: (() => Promise<FormSubmission>) | undefined
  /** The submission as reported by `navigation.current`, with an upper-case method. */
  submission: FormSubmission
}

const PENDING_FORM_SUBMISSION_TIMEOUT = 1000

/**
 * Tracks native form events and resolves their corresponding Navigation API events.
 *
 * @param signal Signal used to stop tracking form events.
 * @returns A function that resolves form metadata for a navigation event.
 */
export function createFormNavigationResolver(
  signal: AbortSignal,
): (event: NavigateEvent) => FormNavigation | undefined {
  // Index each submission by its form and submitter so detached submitters can still find their form.
  let pendingSubmissions = new WeakMap<HTMLFormElement | SubmitterElement, PendingFormSubmission>()

  function clearPending(pending: PendingFormSubmission) {
    clearTimeout(pending.timeout)
    pending.removeFormDataListener()
    if (pendingSubmissions.get(pending.form) === pending) {
      pendingSubmissions.delete(pending.form)
    }
    if (pending.submitter && pendingSubmissions.get(pending.submitter) === pending) {
      pendingSubmissions.delete(pending.submitter)
    }
  }

  // Cache the authoritative submitter and native data for the matching `navigate` event.
  // Unmatched submits expire.
  document.addEventListener(
    'submit',
    (event) => {
      let form = event.target
      if (!(form instanceof HTMLFormElement)) return

      let eventSubmitter = event instanceof SubmitEvent ? event.submitter : null
      let submitter =
        eventSubmitter instanceof HTMLButtonElement || eventSubmitter instanceof HTMLInputElement
          ? eventSubmitter
          : null
      function onFormData(formDataEvent: FormDataEvent) {
        // Native formdata follows an uncanceled submit. Ignore snapshots made in submit handlers
        // or after cancellation, and stop listening before later snapshots can replace this data.
        if (event.eventPhase !== Event.NONE || event.defaultPrevented) return
        // A canceled retry must not replace a submission whose navigation is still pending.
        let existing = pendingSubmissions.get(pending.form)
        if (existing) clearPending(existing)
        pending.formData = formDataEvent.formData
        pendingSubmissions.set(pending.form, pending)
        if (submitter) pendingSubmissions.set(submitter, pending)
        pending.removeFormDataListener()
      }
      let pending: PendingFormSubmission = {
        form,
        submitter,
        timeout: setTimeout(() => clearPending(pending), PENDING_FORM_SUBMISSION_TIMEOUT),
        removeFormDataListener() {
          form.removeEventListener('formdata', onFormData)
        },
      }
      form.addEventListener('formdata', onFormData, { signal })
    },
    { capture: true, signal },
  )

  return (event) => {
    let sourceElement = (event as SourceElementNavigateEvent).sourceElement
    if (!(sourceElement instanceof Element)) return

    let form = getSourceForm(sourceElement, pendingSubmissions)
    if (!form) return

    let pending = pendingSubmissions.get(form)
    let submitter = pending?.submitter ?? null
    let method = getFormMethod(form, submitter)
    let encType = getFormEncType(form, submitter)
    let target = getSubmissionAttribute(form, submitter, 'target', 'formtarget')
    if (method === 'dialog' || target?.toLowerCase() === '_blank') return

    let formEvent = event as FormNavigateEvent
    let isGet = method.toLowerCase() === 'get'
    let submission: FormSubmission = {
      formData: isGet ? undefined : (formEvent.formData ?? pending?.formData),
      method: method.toUpperCase(),
      encType,
    }
    let getSubmission: FormNavigation['getSubmission']
    if (isGet) {
      if (pending) clearPending(pending)
    } else {
      getSubmission = async () => {
        if (pending) clearPending(pending)
        return {
          formData: formEvent.formData ?? pending?.formData,
          method,
          encType,
        }
      }
    }
    return {
      hasAttribute(name) {
        return submitter?.hasAttribute(name) === true || form.hasAttribute(name)
      },
      getAttribute(name, submitterName) {
        return getSubmissionAttribute(form, submitter, name, submitterName)
      },
      getSubmission,
      submission,
    }
  }
}

function getSourceForm(
  sourceElement: Element,
  pendingSubmissions: WeakMap<HTMLFormElement | SubmitterElement, PendingFormSubmission>,
): HTMLFormElement | undefined {
  // A form navigation's source element is the submitted form or its submit button.
  // https://html.spec.whatwg.org/multipage/nav-history-apis.html#dom-navigateevent-sourceelement
  if (sourceElement instanceof HTMLFormElement) return sourceElement
  if (sourceElement instanceof HTMLButtonElement || sourceElement instanceof HTMLInputElement) {
    // `sourceElement.form` is null when the button was detached before the `navigate` event fired
    // (e.g. a temporary button appended, clicked, and immediately removed). Fall back to the form
    // reference captured at `submit` time when the button was still attached.
    return sourceElement.form ?? pendingSubmissions.get(sourceElement)?.form
  }
}

function getSubmissionAttribute(
  form: HTMLFormElement,
  submitter: SubmitterElement | null,
  name: string,
  submitterName?: string,
): string | null {
  submitterName ??= name
  if (submitter?.hasAttribute(submitterName)) {
    return submitter.getAttribute(submitterName)
  }
  return form.getAttribute(name)
}

function getFormMethod(form: HTMLFormElement, submitter: SubmitterElement | null): string {
  if (submitter?.hasAttribute('formmethod')) {
    return submitter.formMethod
  }
  return form.method
}

function getFormEncType(form: HTMLFormElement, submitter: SubmitterElement | null): string {
  if (submitter?.hasAttribute('formenctype')) {
    return submitter.formEnctype
  }
  return form.enctype
}
